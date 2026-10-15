import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, classroomRole, sameOrigin } from "@/lib/full-system-auth";
import { ClassroomConflictError, ClassroomInputError, importRoster, RosterVersionError } from "@/lib/full-system-classrooms";
import { AuditOutcomePendingError, AuditUnavailableError } from "@/lib/full-system-audit";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  const { id } = await context.params;
  const role = await classroomRole(actor, id);
  if (!role) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (!["OWNER", "CO_TEACHER", "TA"].includes(role)) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body?.csv !== "string" || typeof body?.confirmDigest !== "string" ||
        !Number.isSafeInteger(body?.expectedVersion) || body.expectedVersion < 0) throw new ClassroomInputError("Invalid roster request");
    const result = await importRoster(actor, id, body.csv, body.expectedVersion, body.confirmDigest);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuditOutcomePendingError) return NextResponse.json(
      { data: { status: error.commitState === "UNKNOWN" ? "COMMIT_UNKNOWN" : "AUDIT_PENDING",
        requestId: error.requestId } }, { status: 202, headers: { "Retry-After": "5" } });
    if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
    if (error instanceof RosterVersionError) return NextResponse.json({ error: { code: "ROSTER_CHANGED" } }, { status: 409 });
    if (error instanceof ClassroomConflictError) return NextResponse.json(
      { error: { code: "ASSIGNMENT_PUBLISHED", message: error.message } }, { status: 409 });
    if (error instanceof ClassroomInputError) return NextResponse.json({ error: { code: "ROSTER_INVALID", message: error.message } }, { status: 422 });
    return NextResponse.json({ error: { code: "ROSTER_IMPORT_FAILED" } }, { status: 500 });
  }
}

export const POST = observeRoute(POSTHandler);
