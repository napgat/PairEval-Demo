import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const environment = process.argv[2];
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
const assignmentFilter = process.argv[3] ?? null;
if (assignmentFilter && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(assignmentFilter)) {
  throw new Error("Invalid assignment filter");
}
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational database guard failed");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
  connectionTimeoutMillis: 30000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const due = await client.query(`SELECT a.id AS assignment_id,a.classroom_id,a.generation,
    s.side,s.deadline,m.user_id FROM assignment a
    JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=c.id
    JOIN app_user u ON u.id=m.user_id
    CROSS JOIN LATERAL (VALUES ('GROUP'::text,a.group_deadline_utc),
      ('INDIVIDUAL'::text,a.individual_deadline_utc)) AS s(side,deadline)
    WHERE a.status='OPEN' AND c.status='ACTIVE' AND m.role='STUDENT'
      AND m.membership_status='ACTIVE' AND u.status='ACTIVE'
      AND ($1::uuid IS NULL OR a.id=$1)
      AND s.deadline > now() AND s.deadline <= now() + interval '48 hours'
      AND EXISTS (SELECT 1 FROM pair_assignment p WHERE p.assignment_id=a.id
        AND p.generation=a.generation AND p.side=s.side AND p.evaluator_user_id=m.user_id)
      AND NOT EXISTS (SELECT 1 FROM submission_revision r WHERE r.assignment_id=a.id
        AND r.generation=a.generation AND r.side=s.side AND r.evaluator_user_id=m.user_id)`,
  [assignmentFilter]);
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
  console.log(`${environment} reminder job: due=${due.rows.length}, inserted=${inserted}`);
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
