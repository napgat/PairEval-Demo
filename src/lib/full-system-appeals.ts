import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";

const validId = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
type Scope = { classroom_id: string; role: string; generation: number; status: string;
  window_open: boolean; allowed_email_domains: string[] };
async function scope(client: PoolClient, actor: FullActor, assignmentId: string,
    lock = false): Promise<Scope> {
  if (!validId(assignmentId)) throw new AssignmentInputError("Invalid assignment ID");
  const result = await client.query<Scope>(`SELECT a.classroom_id,a.generation,a.status,
    a.finalized_at IS NOT NULL AND clock_timestamp() < a.finalized_at + interval '7 days' AS window_open,
    m.role,c.allowed_email_domains FROM assignment a JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=c.id
    WHERE a.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.membership_status='ACTIVE'
      ${lock ? "FOR UPDATE OF a" : ""}`, [assignmentId, actor.id]);
  const row = result.rows[0];
  if (!row || !domainAllowed(actor.hostedDomain, row.allowed_email_domains)) {
    throw new AssignmentNotFoundError("Assignment not found");
  }
  return row;
}
export async function listAppeals(actor: FullActor, assignmentId: string) {
  const client = await databasePool().connect();
  try {
    const a = await scope(client, actor, assignmentId);
    const instructor = a.role === "OWNER" || a.role === "CO_TEACHER";
    if (!instructor && a.role !== "STUDENT") throw new AssignmentNotFoundError("Appeals not found");
    const rows = await client.query(`SELECT id,student_user_id,final_snapshot_id,message,status,
      resolution,created_at,resolved_at FROM appeal WHERE assignment_id=$1
      ${instructor ? "" : "AND student_user_id=$2"} ORDER BY created_at DESC,id DESC LIMIT 100`,
    instructor ? [assignmentId] : [assignmentId, actor.id]);
    return { windowOpen: a.status === "FINALIZED" && a.window_open,
      appeals: rows.rows.map(row => ({ id: row.id,
        ...(instructor ? { studentId: row.student_user_id } : {}),
        finalSnapshotId: row.final_snapshot_id, message: row.message, status: row.status,
        resolution: row.resolution, createdAt: row.created_at.toISOString(),
        resolvedAt: row.resolved_at?.toISOString() ?? null })) };
  } finally { client.release(); }
}
export async function submitAppeal(actor: FullActor, assignmentId: string, message: string) {
  if (typeof message !== "string" || message.trim().length < 20 || message.length > 4000) {
    throw new AssignmentInputError("Appeal must have 20–4000 characters");
  }
  const id = randomUUID();
  return runAuditedMutation({
    prepare: async client => {
      const a = await scope(client, actor, assignmentId, true);
      if (a.role !== "STUDENT") throw new AssignmentNotFoundError("Appeal not found");
      if (a.status !== "FINALIZED" || !a.window_open) {
        throw new AssignmentConflictError("Appeal window is closed");
      }
      const final = await client.query<{ id: string }>(`SELECT id FROM score_snapshot
        WHERE assignment_id=$1 AND generation=$2 AND kind='FINAL'
        ORDER BY snapshot_no DESC LIMIT 1`, [assignmentId, a.generation]);
      if (!final.rows[0]) throw new AssignmentConflictError("Final score is missing");
      return { ...a, snapshotId: final.rows[0].id };
    },
    intent: a => ({ actorUserId: actor.id, classroomId: a.classroom_id,
      action: "APPEAL_CREATE_REQUESTED", resourceType: "appeal", resourceId: id,
      after: { assignmentId, finalSnapshotId: a.snapshotId } }),
    mutate: async (client, a) => {
      const existing = await client.query(`SELECT 1 FROM appeal WHERE assignment_id=$1
        AND student_user_id=$2 AND status='OPEN'`, [assignmentId, actor.id]);
      if (existing.rowCount) throw new AssignmentConflictError("An appeal is already open");
      await client.query(`INSERT INTO appeal (id,assignment_id,student_user_id,final_snapshot_id,message)
        VALUES ($1,$2,$3,$4,$5)`, [id, assignmentId, actor.id, a.snapshotId, message.trim()]);
      return { id, status: "OPEN" as const };
    },
    committedAfter: result => result,
  });
}
export async function resolveAppeal(actor: FullActor, assignmentId: string, appealId: string,
    status: string, resolution: string) {
  if (!validId(appealId) || !["RESOLVED", "REJECTED"].includes(status) ||
      typeof resolution !== "string" || resolution.trim().length < 10 || resolution.length > 4000) {
    throw new AssignmentInputError("Invalid appeal resolution");
  }
  return runAuditedMutation({
    prepare: async client => {
      const a = await scope(client, actor, assignmentId, true);
      if (a.role !== "OWNER" && a.role !== "CO_TEACHER") {
        throw new AssignmentNotFoundError("Appeal not found");
      }
      const found = await client.query(`SELECT status FROM appeal WHERE id=$1 AND assignment_id=$2
        FOR UPDATE`, [appealId, assignmentId]);
      if (!found.rows[0]) throw new AssignmentNotFoundError("Appeal not found");
      if (found.rows[0].status !== "OPEN") throw new AssignmentConflictError("Appeal already resolved");
      if (a.status !== "FINALIZED") {
        throw new AssignmentConflictError("Finalize the current scores before resolving an appeal");
      }
      const latest = await client.query<{ id: string; kind: string }>(`SELECT id,kind FROM score_snapshot
        WHERE assignment_id=$1 AND generation=$2 ORDER BY snapshot_no DESC LIMIT 1`, [assignmentId, a.generation]);
      if (latest.rows[0]?.kind !== "FINAL") {
        throw new AssignmentConflictError("Finalize the current scores before resolving an appeal");
      }
      return { ...a, resolutionSnapshotId: latest.rows[0].id };
    },
    intent: a => ({ actorUserId: actor.id, classroomId: a.classroom_id,
      action: "APPEAL_RESOLVE_REQUESTED", resourceType: "appeal", resourceId: appealId,
      before: { status: "OPEN" }, after: { status, finalSnapshotId: a.resolutionSnapshotId }, reason: resolution.trim() }),
    mutate: async client => {
      await client.query(`UPDATE appeal SET status=$2,resolution=$3,resolved_by=$4,resolved_at=now()
        WHERE id=$1`, [appealId, status, resolution.trim(), actor.id]);
      return { id: appealId, status };
    },
    committedAfter: result => result,
  });
}
