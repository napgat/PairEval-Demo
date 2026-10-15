import type { PoolClient } from "pg";
import type { FullActor } from "./full-system-auth";
import { databasePool } from "./full-system-postgres";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { editorScope } from "./full-system-score-runs";
import { rawComparisonCsv, type RawScoreInput } from "./full-system-raw-export";
import {
  AssignmentConflictError,
  AssignmentInputError,
  AssignmentForbiddenError,
} from "./full-system-assignments";

/** The only path that resolves an evaluator ID to a real identity. */
async function ownerScope(
  client: PoolClient,
  actor: FullActor,
  assignmentId: string,
) {
  const a = await editorScope(client, actor, assignmentId);
  const owner = await client.query(
    "SELECT 1 FROM classroom_member WHERE classroom_id=$1 AND user_id=$2 AND role='OWNER' AND membership_status='ACTIVE'",
    [a.classroom_id, actor.id],
  );
  if (!owner.rowCount)
    throw new AssignmentForbiddenError(
      "Only the classroom Owner can access evaluator identities",
    );
  return a;
}

export async function mayRevealIdentities(
  actor: FullActor,
  assignmentId: string,
): Promise<boolean> {
  const client = await databasePool().connect();
  try {
    await ownerScope(client, actor, assignmentId);
    return true;
  } catch (e) {
    if (e instanceof AssignmentForbiddenError) return false;
    throw e;
  } finally {
    client.release();
  }
}

export async function identifiedRawExport(
  actor: FullActor,
  assignmentId: string,
  input: { confirmed?: unknown; reason?: unknown },
) {
  if (
    input.confirmed !== true ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 10 ||
    input.reason.length > 2000
  ) {
    throw new AssignmentInputError(
      "Explicit identity confirmation and a 10–2000 character reason are required",
    );
  }
  const reason = input.reason.trim(),
    key = process.env.PAIR_EVAL_EXPORT_KEY ?? "";
  if (Buffer.byteLength(key) < 32)
    throw new AssignmentConflictError("Export key is not configured");
  // Access and export are distinct mandatory events. Fail closed before returning identity data.
  const accessed = await runAuditedMutation({
    prepare: async (client) => {
      const a = await ownerScope(client, actor, assignmentId);
      const result = await client.query<{
        input_json: RawScoreInput;
        snapshot_no: number;
      }>(
        `SELECT input_json,snapshot_no FROM score_snapshot WHERE assignment_id=$1 AND generation=$2 ORDER BY snapshot_no DESC LIMIT 1`,
        [assignmentId, a.generation],
      );
      if (!result.rowCount || result.rows[0].input_json.answers.length > 10000)
        throw new AssignmentConflictError(
          "Recompute before exporting, or reduce the export size",
        );
      return { a, snapshot: result.rows[0] };
    },
    intent: ({ a, snapshot }) => ({
      actorUserId: actor.id,
      classroomId: a.classroom_id,
      action: "EVALUATOR_IDENTITY_ACCESS_REQUESTED",
      resourceType: "assignment",
      resourceId: assignmentId,
      reason,
      before: { generation: a.generation, snapshotNo: snapshot.snapshot_no },
    }),
    mutate: async (client, { a, snapshot }) => {
      const ids = [
        ...new Set(snapshot.input_json.answers.map((row) => row.evaluatorId)),
      ];
      const users = await client.query<{
        id: string;
        name: string;
        email: string;
      }>(
        `SELECT id,display_name AS name,email_raw AS email FROM app_user WHERE id=ANY($1::uuid[])`,
        [ids],
      );
      return {
        a,
        snapshot,
        identities: new Map(
          users.rows.map((row) => [
            row.id,
            { name: row.name, email: row.email },
          ]),
        ),
      };
    },
    committedAfter: (result) => ({
      generation: result.a.generation,
      snapshotNo: result.snapshot.snapshot_no,
      count: result.identities.size,
    }),
  });
  return runAuditedMutation({
    prepare: (client) => ownerScope(client, actor, assignmentId),
    intent: (a) => ({
      actorUserId: actor.id,
      classroomId: a.classroom_id,
      action: "IDENTITY_EXPORT_REQUESTED",
      resourceType: "assignment",
      resourceId: assignmentId,
      reason,
      before: {
        generation: accessed.a.generation,
        snapshotNo: accessed.snapshot.snapshot_no,
      },
    }),
    mutate: async (_client, a) => {
      if (a.generation !== accessed.a.generation)
        throw new AssignmentConflictError("Assignment changed; confirm again");
      return {
        csv: rawComparisonCsv(
          accessed.snapshot.input_json,
          assignmentId,
          key,
          accessed.identities,
        ),
        filename: `${a.classroom_slug}_${a.slug}_raw-identities_${new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-")}.csv`,
      };
    },
    committedAfter: () => ({ identity: true, count: accessed.identities.size }),
  });
}
