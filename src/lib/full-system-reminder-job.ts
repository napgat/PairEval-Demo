import { randomUUID, timingSafeEqual } from "node:crypto";
import { databasePool } from "./full-system-postgres";

export function validCronAuthorization(header: string | null, secret: string | undefined) {
  if (!secret || Buffer.byteLength(secret, "utf8") < 16 || !header?.startsWith("Bearer ")) return false;
  const candidate = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** One bounded, idempotent sweep. A transaction advisory lock prevents overlapping invocations. */
export async function runReminderSweep() {
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock(23180409) AS acquired");
    if (!lock.rows[0]?.acquired) { await client.query("ROLLBACK"); return { skipped: true, due: 0, inserted: 0 }; }
    const due = await client.query<{ assignment_id: string; classroom_id: string;
      generation: number; side: string; deadline: Date; user_id: string }>(`SELECT a.id AS assignment_id,a.classroom_id,a.generation,
      s.side,s.deadline,m.user_id FROM assignment a
      JOIN classroom c ON c.id=a.classroom_id
      JOIN classroom_member m ON m.classroom_id=c.id
      JOIN app_user u ON u.id=m.user_id
      CROSS JOIN LATERAL (VALUES ('GROUP'::text,a.group_deadline_utc),
        ('INDIVIDUAL'::text,a.individual_deadline_utc)) AS s(side,deadline)
      WHERE a.status='OPEN' AND c.status='ACTIVE' AND m.role='STUDENT'
        AND m.membership_status='ACTIVE' AND u.status='ACTIVE'
        AND s.deadline > now() AND s.deadline <= now() + interval '48 hours'
        AND EXISTS (SELECT 1 FROM active_pair_assignment p WHERE p.assignment_id=a.id
          AND p.generation=a.generation AND p.side=s.side AND p.evaluator_user_id=m.user_id)
        AND (SELECT count(*) FROM active_pair_assignment p2 WHERE p2.assignment_id=a.id
          AND p2.generation=a.generation AND p2.side=s.side AND p2.evaluator_user_id=m.user_id)
          > (SELECT count(*) FROM submission_answer sa WHERE sa.revision_id=(
            SELECT r.id FROM submission_revision r WHERE r.assignment_id=a.id
              AND r.generation=a.generation AND r.side=s.side AND r.evaluator_user_id=m.user_id
            ORDER BY r.revision_number DESC LIMIT 1))
        AND NOT EXISTS (SELECT 1 FROM app_notification n WHERE n.dedupe_key=concat_ws(':',
          a.id::text,a.generation::text,
          CASE WHEN s.side='GROUP' THEN 'DEADLINE_48H_GROUP' ELSE 'DEADLINE_48H_INDIVIDUAL' END,
          to_char(s.deadline AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          m.user_id::text))
      ORDER BY s.deadline,a.id,m.user_id LIMIT 500`);
    let inserted = 0;
    for (const row of due.rows) {
      const event = row.side === "GROUP" ? "DEADLINE_48H_GROUP" : "DEADLINE_48H_INDIVIDUAL";
      const message = row.side === "GROUP" ? "เหลือไม่เกิน 48 ชั่วโมงก่อนปิดประเมินกลุ่ม" :
        "เหลือไม่เกิน 48 ชั่วโมงก่อนปิดประเมินบุคคล";
      const dedupe = [row.assignment_id,row.generation,event,row.deadline.toISOString(),row.user_id].join(":");
      const result = await client.query(`INSERT INTO app_notification
        (id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (dedupe_key) DO NOTHING`,
      [randomUUID(),row.user_id,row.assignment_id,row.generation,event,dedupe,message,
        `/full-system/classrooms/${row.classroom_id}/work`]);
      inserted += result.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return { skipped: false, due: due.rows.length, inserted, limited: due.rows.length === 500 };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
