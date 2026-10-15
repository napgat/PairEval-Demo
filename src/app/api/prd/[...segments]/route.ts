import { NextRequest } from "next/server";
import { observeRoute } from "@/lib/observe-route";
import {
  assignmentActor,
  assignmentError,
} from "@/lib/full-system-assignment-http";
import {
  createAssignment,
  replaceDraftAssignment,
  feasibility,
  publishAssignment,
  unpublishAssignment,
  addPairEvaluators,
  AssignmentNotFoundError,
  AssignmentInputError,
} from "@/lib/full-system-assignments";
import {
  getEvaluation,
  saveEvaluationDraft,
  submitEvaluation,
} from "@/lib/full-system-evaluation";
import {
  createScoreRun,
  latestScoreRun,
  pseudonymousRawExport,
} from "@/lib/full-system-score-runs";
import { getMyScore } from "@/lib/full-system-my-score";
import { submitAppeal } from "@/lib/full-system-appeals";
import { databasePool } from "@/lib/full-system-postgres";
import {
  GET as classroomsGet,
  POST as classroomsPost,
} from "@/app/api/full-system/classrooms/route";
import { GET as rosterGet } from "@/app/api/full-system/classrooms/[id]/roster/route";
import { POST as membersPost } from "@/app/api/full-system/classrooms/[id]/members/route";
import { POST as exportsPost } from "@/app/api/full-system/assignments/[id]/exports/route";
import { POST as rawPost } from "@/app/api/full-system/assignments/[id]/exports/raw/route";
import { GET as auditGet } from "@/app/api/full-system/assignments/[id]/audit/route";
import { GET as assignmentGet } from "@/app/api/full-system/assignments/[id]/route";
import {
  importRoster,
  previewRosterChange,
} from "@/lib/full-system-classrooms";
import { classroomRole } from "@/lib/full-system-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ segments: string[] }> };
async function dispatch(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  const segments = (await context.params).segments;
  const [resource, key, sub] = segments,
    method = request.method;
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const json = (data: unknown, status = 200) =>
    Response.json({ data }, { status });
  if (resource === "classrooms" && !key) {
    if (method === "GET") return classroomsGet(request, undefined);
    if (method === "POST") return classroomsPost(request, undefined);
  }
  const auth = await assignmentActor(request, method !== "GET");
  if (auth.error) return auth.error;
  try {
    const actor = auth.actor;
    if (resource === "classrooms" && key) {
      if (sub === "roster" && method === "GET")
        return rosterGet(request, ctx(key));
      if (sub === "members" && method === "POST")
        return membersPost(request, ctx(key));
      if (sub === "roster:import" && method === "POST") {
        const role = await classroomRole(actor, key);
        if (!role) throw new AssignmentNotFoundError("Classroom not found");
        if (role === "STUDENT")
          return Response.json(
            { error: { code: "FORBIDDEN" } },
            { status: 403 },
          );
        const form = await request.formData(),
          file = form.get("file") ?? form.get("csv");
        const csv =
          typeof file === "string"
            ? file
            : file instanceof File
              ? await file.text()
              : "";
        const plan = await previewRosterChange(key, csv);
        if (plan.errors.length || !plan.digest || plan.version === null)
          throw new AssignmentInputError(plan.errors.join("; "));
        return json(
          await importRoster(actor, key, csv, plan.version, plan.digest),
        );
      }
    }
    if (resource === "assignments") {
      if (!key && method === "POST") {
        const body = await request.json();
        return json(await createAssignment(actor, body.classroomId, body), 201);
      }
      const [id, action] = key?.split(":") ?? [];
      if (id && !action && !sub) {
        if (method === "GET") return assignmentGet(request, ctx(id));
        if (method === "PATCH")
          return json(
            await replaceDraftAssignment(actor, id, await request.json()),
          );
      }
      if (id && method === "POST" && action) {
        if (action === "publish")
          return json(
            await publishAssignment(
              actor,
              id,
              (await request.json()).seed ?? "1",
            ),
          );
        if (action === "unpublish")
          return json(
            await unpublishAssignment(actor, id, (await request.json()).reason),
          );
        if (action === "finalize" || action === "recompute")
          return json(
            await createScoreRun(
              actor,
              id,
              action === "finalize" ? "FINAL" : "INTERIM",
            ),
          );
      }
      if (sub === "feasibility" && method === "GET")
        return json(
          await feasibility(
            actor,
            id,
            request.nextUrl.searchParams.get("seed") ?? "1",
          ),
        );
      if (sub === "my-evaluations" && method === "GET")
        return json(
          await getEvaluation(
            actor,
            id,
            request.nextUrl.searchParams.get("side") ?? "GROUP",
          ),
        );
      if (sub === "my-score" && method === "GET")
        return json(await getMyScore(actor, id));
      if (sub === "submissions" && method === "POST") {
        const body = await request.json();
        return json(
          await submitEvaluation(
            actor,
            id,
            body.side,
            request.headers.get("Idempotency-Key"),
          ),
        );
      }
      if (sub === "pairs:add-evaluators" && method === "POST") {
        const body = await request.json();
        return json(
          await addPairEvaluators(actor, id, {
            ...body,
            count: body.count ?? 1,
            mode: body.mode ?? "STUDENT",
          }),
        );
      }
      if (sub === "exports" && method === "POST") {
        const body = await request.clone().json();
        return body.report === "raw"
          ? rawPost(request, ctx(id))
          : exportsPost(request, ctx(id));
      }
      if (sub === "audit" && method === "GET")
        return auditGet(request, ctx(id));
      if (sub === "raw-pairs" && method === "GET") {
        const scope = await databasePool().query(
          "SELECT m.role,c.allowed_email_domains FROM assignment a JOIN classroom c ON c.id=a.classroom_id JOIN classroom_member m ON m.classroom_id=c.id WHERE a.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.membership_status='ACTIVE'",
          [id, actor.id],
        );
        const row = scope.rows[0];
        if (!row) throw new AssignmentNotFoundError("Assignment not found");
        if (!["OWNER", "CO_TEACHER"].includes(row.role))
          return Response.json(
            { error: { code: "FORBIDDEN" } },
            { status: 403 },
          );
        const raw = await pseudonymousRawExport(actor, id);
        return new Response(raw.csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      if (sub === "reports" && method === "GET") {
        const report = segments[3];
        if (!["group", "individual", "coverage", "quality"].includes(report))
          throw new AssignmentNotFoundError("Report not found");
        const snapshot = await latestScoreRun(actor, id);
        return json(
          snapshot
            ? {
                kind: snapshot.kind,
                snapshotNo: snapshot.snapshotNo,
                data:
                  report === "group"
                    ? snapshot.output.groups
                    : report === "individual"
                      ? snapshot.output.students
                      : report === "coverage"
                        ? snapshot.output.pairSummary
                        : snapshot.output.quality,
              }
            : null,
        );
      }
    }
    if (resource === "comparisons" && key && method === "PUT") {
      const found = await databasePool().query(
        "SELECT assignment_id,side FROM active_pair_assignment WHERE id=$1 AND evaluator_user_id=$2",
        [key, actor.id],
      );
      if (!found.rowCount)
        throw new AssignmentNotFoundError("Comparison not found");
      return json(
        await saveEvaluationDraft(
          actor,
          found.rows[0].assignment_id,
          found.rows[0].side,
          key,
          (await request.json()).choice,
        ),
      );
    }
    if (resource === "appeals" && method === "POST") {
      const body = await request.json();
      return json(await submitAppeal(actor, body.assignmentId, body.message));
    }
    throw new AssignmentNotFoundError("Endpoint not found");
  } catch (error) {
    return assignmentError(error);
  }
}
export const GET = observeRoute(dispatch);
export const POST = observeRoute(dispatch);
export const PATCH = observeRoute(dispatch);
export const PUT = observeRoute(dispatch);
