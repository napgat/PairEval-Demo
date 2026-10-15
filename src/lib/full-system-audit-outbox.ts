import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { appendAuditOutcome, AuditOutcomePendingError, type AuditIntent, type AuditIntentInput,
  writeAuditIntent } from "./full-system-audit";

type AuditOutcome = "COMMITTED" | "REJECTED";
type OutboxRow = {
  id: string; request_id: string; classroom_id: string | null; actor_user_id: string;
  action: string; resource_type: string; resource_id: string; before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null; reason: string | null; ip_address: string | null;
};

export function outcomeAction(action: string, outcome: AuditOutcome): string {
  if (!action.endsWith("_REQUESTED")) throw new Error("Audit intent action must end with _REQUESTED");
  return `${action.slice(0, -"_REQUESTED".length)}_${outcome}`;
}

async function enqueueOutcome(client: PoolClient, intent: AuditIntent, outcome: AuditOutcome,
    after?: Record<string, unknown>, reason?: string): Promise<void> {
  await client.query(`INSERT INTO audit_outbox
    (id,request_id,classroom_id,actor_user_id,action,resource_type,resource_id,before_json,after_json,reason,ip_address)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [randomUUID(), intent.requestId, intent.classroomId ?? null, intent.actorUserId,
    outcomeAction(intent.action, outcome), intent.resourceType, intent.resourceId,
    intent.before ?? null, after ?? intent.after ?? null, reason ?? intent.reason ?? null, intent.ipAddress ?? null]);
}

/** Safe to retry: the audit event ID is fixed by the outbox row. */
export async function deliverAuditOutcome(requestId: string): Promise<void> {
  const found = await databasePool().query<OutboxRow>(`SELECT id,request_id,classroom_id,actor_user_id,
    action,resource_type,resource_id,before_json,after_json,reason,ip_address
    FROM audit_outbox WHERE request_id=$1 AND delivered_at IS NULL`, [requestId]);
  const row = found.rows[0];
  if (!row) return;
  await appendAuditOutcome({ id: row.id, requestId: row.request_id,
    classroomId: row.classroom_id ?? undefined, actorUserId: row.actor_user_id,
    action: row.action, resourceType: row.resource_type, resourceId: row.resource_id,
    before: row.before_json ?? undefined, after: row.after_json ?? undefined,
    reason: row.reason ?? undefined, ipAddress: row.ip_address });
  await databasePool().query("UPDATE audit_outbox SET delivered_at=now() WHERE id=$1 AND delivered_at IS NULL", [row.id]);
}

/** Drains durable pending outcomes; intended for an operator job after policy approval. */
export async function drainAuditOutbox(limit = 100): Promise<{ delivered: number; pending: number }> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid audit drain limit");
  const rows = await databasePool().query<{ request_id: string }>(`SELECT request_id FROM audit_outbox
    WHERE delivered_at IS NULL ORDER BY created_at,id LIMIT $1`, [limit]);
  let delivered = 0;
  for (const row of rows.rows) {
    await deliverAuditOutcome(row.request_id);
    delivered++;
  }
  const remaining = await databasePool().query<{ n: number }>(
    "SELECT count(*)::integer AS n FROM audit_outbox WHERE delivered_at IS NULL");
  return { delivered, pending: remaining.rows[0].n };
}

/** Intent precedes the domain change; outcome is queued in the same operational transaction. */
export async function runAuditedMutation<Prepared, Result>(input: {
  prepare: (client: PoolClient) => Promise<Prepared>;
  intent: (prepared: Prepared) => AuditIntentInput;
  mutate: (client: PoolClient, prepared: Prepared) => Promise<Result>;
  committedAfter?: (result: Result, prepared: Prepared) => Record<string, unknown>;
}): Promise<Result> {
  const client = await databasePool().connect();
  let intent: AuditIntent | undefined;
  let commitAttempted = false;
  let result: Result;
  try {
    await client.query("BEGIN");
    const prepared = await input.prepare(client);
    intent = await writeAuditIntent(input.intent(prepared));
    result = await input.mutate(client, prepared);
    await enqueueOutcome(client, intent, "COMMITTED", input.committedAfter?.(result, prepared));
    commitAttempted = true;
    await client.query("COMMIT");
  } catch (error) {
    if (commitAttempted && intent) throw new AuditOutcomePendingError(intent.requestId, "UNKNOWN");
    await client.query("ROLLBACK").catch(() => {});
    if (intent) {
      try {
        // Rejections cannot be part of the rolled-back domain transaction.
        await enqueueOutcome(client, intent, "REJECTED", undefined,
          `rejected:${error instanceof Error ? error.name : "Unknown"}`);
        await deliverAuditOutcome(intent.requestId);
      } catch { console.error("Audit rejection outcome pending", intent.requestId); }
    }
    throw error;
  } finally { client.release(); }
  try { await deliverAuditOutcome(intent.requestId); }
  catch { throw new AuditOutcomePendingError(intent.requestId); }
  return result;
}
