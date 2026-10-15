import { randomUUID } from "node:crypto";
import { databasePool } from "./full-system-postgres";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { persistScheduledInterimScore, scheduledFinalizationReady } from "./full-system-score-runs";
import { latestScoreDue } from "./full-system-score-schedule";

const SYSTEM_ACTOR_ID = "00000000-0000-4000-8000-000000000026";

type Candidate = { id: string; classroom_id: string; generation: number; status: string;
  timezone: string; published_at: Date | null; last_deadline: Date | null };

class NotDue extends Error {}

/** The database row lock and schedule key make retries and overlapping calls safe. */
async function runOne(candidateId: string, now: Date) {
  return runAuditedMutation({
    prepare: async client => {
      const found = await client.query<Candidate>(`SELECT a.id,a.classroom_id,a.generation,
        a.status,a.published_at,c.timezone,GREATEST(a.group_deadline_utc,a.individual_deadline_utc) AS last_deadline FROM assignment a
        JOIN classroom c ON c.id=a.classroom_id
        WHERE a.id=$1 AND c.status='ACTIVE' FOR UPDATE OF a`, [candidateId]);
      const assignment = found.rows[0];
      if (!assignment || !["OPEN", "CLOSED"].includes(assignment.status) ||
          assignment.generation < 1 || !assignment.published_at) throw new NotDue();
      const due = latestScoreDue(now, assignment.timezone, assignment.published_at);
      if (!due) throw new NotDue();
      const existing = await client.query(`SELECT 1 FROM scheduled_score_run
        WHERE assignment_id=$1 AND generation=$2 AND local_date=$3::date`,
      [candidateId, assignment.generation, due.localDate]);
      if (existing.rowCount) throw new NotDue();
      const tryFinalize = !!assignment.last_deadline && now.getTime() >= assignment.last_deadline.getTime() + 14 * 86400000;
      return { assignment, due, tryFinalize, willFinalize: tryFinalize && await scheduledFinalizationReady(client,assignment.id) };
    },
    intent: ({ assignment, due, willFinalize }) => ({ actorUserId: SYSTEM_ACTOR_ID,
      classroomId: assignment.classroom_id, action: willFinalize ? "SCORE_FINALIZE_REQUESTED" : "SCORE_RECOMPUTE_REQUESTED",
      resourceType: "assignment", resourceId: candidateId,
      before: { generation: assignment.generation, scheduledFor: due.scheduledFor,
        localDate: due.localDate, timezone: due.timezone } }),
    mutate: async (client, { assignment, due, tryFinalize }) => {
      const snapshot = await persistScheduledInterimScore(client, assignment.id, SYSTEM_ACTOR_ID, tryFinalize);
      await client.query(`INSERT INTO scheduled_score_run
        (assignment_id,generation,local_date,timezone,scheduled_for,snapshot_id)
        VALUES ($1,$2,$3::date,$4,$5::timestamptz,$6)`,
      [assignment.id, assignment.generation, due.localDate, due.timezone,
        due.scheduledFor, snapshot.id]);
      return { snapshotId: snapshot.id, snapshotNo: snapshot.snapshotNo,
        localDate: due.localDate, timezone: due.timezone, autoFinalized: snapshot.autoFinalized };
    },
    committedAfter: result => result,
  });
}

/** Recompute the latest due local day; missed days coalesce into one snapshot. */
export async function runScheduledScoreSweep(now = new Date(), origin: "VERCEL_CRON" | "MANUAL" = "MANUAL") {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid score schedule clock");
  if (!["development", "staging", "production"].includes(process.env.PAIR_EVAL_ENV ?? "")) {
    throw new Error("Scheduled scoring is disabled in this environment");
  }
  const pool = databasePool();
  const id = randomUUID();
  await pool.query(`INSERT INTO score_job_invocation(id,origin,slot,status)
    VALUES ($1,$2,$3,'STARTED')`, [id, origin, now.toISOString()]);
  let scanned = 0; let created = 0; let alreadyDone = 0; let failed = 0;
  let cursor: string | null = null;
  try {
    // Keyset pagination prevents the first page of already-processed rows starving later work.
    for (;;) {
      const page: { rows: Array<{ id: string }> } = await pool.query<{ id: string }>(`SELECT a.id FROM assignment a
        JOIN classroom c ON c.id=a.classroom_id
        WHERE c.status='ACTIVE' AND a.status IN ('OPEN','CLOSED')
          AND a.generation > 0 AND a.published_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM assignment_generation g WHERE g.assignment_id=a.id
            AND g.generation=a.generation AND g.status='ACTIVE')
          AND EXISTS (SELECT 1 FROM classroom_member m WHERE m.classroom_id=c.id
            AND m.role='STUDENT' AND m.membership_status='ACTIVE')
          AND ($1::uuid IS NULL OR a.id > $1::uuid)
        ORDER BY a.id LIMIT 25`, [cursor]);
      if (!page.rows.length) break;
      for (const row of page.rows as Array<{ id: string }>) {
        cursor = row.id; scanned++;
        try { await runOne(row.id, now); created++; }
        catch (error) {
          if (error instanceof NotDue) alreadyDone++;
          else { failed++; console.error("Scheduled score failed", row.id, error); }
        }
      }
      if (page.rows.length < 25) break;
    }
    const result = { invocationId: id, scanned, created, alreadyDone, failed };
    await pool.query(`UPDATE score_job_invocation SET status=$2,finished_at=clock_timestamp(),
      result_json=$3 WHERE id=$1`, [id, failed ? "FAILED" : "COMPLETED", result]);
    return result;
  } catch (error) {
    await pool.query(`UPDATE score_job_invocation SET status='FAILED',finished_at=clock_timestamp(),
      result_json=$2 WHERE id=$1`, [id, { scanned, created, alreadyDone, failed: failed + 1 }])
      .catch(() => {});
    throw error;
  }
}
