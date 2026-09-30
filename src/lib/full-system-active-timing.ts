import { randomUUID } from "node:crypto";
import type { FullActor } from "./full-system-auth";
import { databasePool } from "./full-system-postgres";
import { requireTimingPair } from "./full-system-evaluation";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";

export function timingEvent(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AssignmentInputError("Timing event required");
  const v = raw as Record<string, unknown>;
  if (typeof v.leaseId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v.leaseId) ||
      !Number.isSafeInteger(v.sequence) || Number(v.sequence) < 1 || !Number.isSafeInteger(v.deltaMs) ||
      Number(v.deltaMs) < 0 || Number(v.deltaMs) > 5000 || typeof v.close !== "boolean") throw new AssignmentInputError("Invalid bounded timing event");
  return { leaseId: v.leaseId, sequence: Number(v.sequence), deltaMs: Number(v.deltaMs), close: v.close };
}
export async function startActiveTiming(actor: FullActor, assignmentId: string, side: string, pairId: string) {
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN"); const generation = await requireTimingPair(client, actor, assignmentId, side, pairId);
    const leaseId = randomUUID();
    await client.query(`INSERT INTO evaluation_active_session(id,pair_assignment_id,evaluator_user_id,generation)
      VALUES ($1,$2,$3,$4)`, [leaseId, pairId, actor.id, generation]);
    await client.query("COMMIT"); return { leaseId };
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
}
export async function recordActiveTiming(actor: FullActor, assignmentId: string, side: string, pairId: string, raw: unknown) {
  const event = timingEvent(raw); const client = await databasePool().connect();
  try {
    await client.query("BEGIN"); const generation = await requireTimingPair(client, actor, assignmentId, side, pairId);
    const result = await client.query(`SELECT *,floor(extract(epoch FROM (clock_timestamp()-opened_at))*1000)::bigint AS elapsed
      FROM evaluation_active_session WHERE id=$1 AND pair_assignment_id=$2 AND evaluator_user_id=$3 AND generation=$4 FOR UPDATE`,
      [event.leaseId, pairId, actor.id, generation]);
    const row = result.rows[0]; if (!row) throw new AssignmentNotFoundError("Timing lease not found");
    if (row.last_sequence === event.sequence && row.last_delta_ms === event.deltaMs && row.closed === event.close) {
      await client.query("COMMIT"); return { accepted: true, replayed: true };
    }
    if (row.closed || row.last_sequence + 1 !== event.sequence) throw new AssignmentConflictError("Timing sequence changed");
    if (row.active_ms + event.deltaMs > Math.min(86400000, Number(row.elapsed) + 1000)) throw new AssignmentInputError("Timing exceeds server wall budget");
    await client.query(`UPDATE evaluation_active_session SET active_ms=active_ms+$2,last_sequence=$3,
      last_delta_ms=$2,closed=$4,last_event_at=clock_timestamp() WHERE id=$1`, [event.leaseId, event.deltaMs, event.sequence, event.close]);
    await client.query("COMMIT"); return { accepted: true, replayed: false };
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
}
