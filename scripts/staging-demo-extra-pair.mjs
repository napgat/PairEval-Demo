import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

process.loadEnvFile(".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== "staging" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}
const fixture = JSON.parse(await readFile(join(process.cwd(), ".verification", "staging-demo-access.json"), "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const origin = "https://paireval-full-staging.vercel.app";
const token = randomBytes(32).toString("hex");
let setupId;
try {
  const assignment = await pool.query(`SELECT a.id,a.created_by,a.status,u.email_lookup
    FROM assignment a JOIN app_user u ON u.id=a.created_by
    WHERE a.classroom_id=$1`, [fixture.classroomId]);
  if (assignment.rowCount !== 1 || assignment.rows[0].status !== "OPEN" ||
      !/^staging-preview-setup-[0-9a-f]{8}@example\.test$/.test(assignment.rows[0].email_lookup)) {
    throw new Error("Expected one open synthetic setup assignment");
  }
  const id = assignment.rows[0].id;
  setupId = assignment.rows[0].created_by;
  const existing = await pool.query(`SELECT side,count(*)::integer AS n FROM pair_assignment
    WHERE assignment_id=$1 AND evaluator_user_id=$2 AND generation=1 GROUP BY side`, [id, fixture.studentId]);
  if (existing.rows.some(row => row.side === "GROUP" && row.n > 0)) {
    throw new Error("Student already has a group pair; refusing a duplicate extra evaluator");
  }
  const pair = await pool.query(`SELECT id FROM pair_assignment WHERE assignment_id=$1
    AND generation=1 AND side='GROUP' AND group_a_id<>$2 AND group_b_id<>$2 LIMIT 1`,
  [id, fixture.groups[0]]);
  if (pair.rowCount !== 1) throw new Error("No group comparison outside the student's group");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE app_user SET status='ACTIVE' WHERE id=$1 AND status='DISABLED'", [setupId]);
    await client.query(`UPDATE classroom_member SET membership_status='ACTIVE',withdrawn_at=NULL
      WHERE classroom_id=$1 AND user_id=$2 AND role='CO_TEACHER'`, [fixture.classroomId, setupId]);
    await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
      VALUES ($1,'synthetic-staging-v1') ON CONFLICT (user_id) DO UPDATE
      SET notice_version=EXCLUDED.notice_version`, [setupId]);
    await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
      VALUES ($1,$2,$3,now()+interval '10 minutes')`,
    [randomUUID(), setupId, createHash("sha256").update(token).digest("hex")]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }

  const response = await fetch(`${origin}/api/full-system/assignments/${id}/evaluators`, {
    method: "POST", headers: { Cookie: `paireval_full_session=${token}`, Origin: origin,
      "Content-Type": "application/json" },
    body: JSON.stringify({ pairId: pair.rows[0].id, mode: "STUDENT", count: 2 }),
  });
  const payload = await response.json().catch(() => null);
  if (response.status !== 200 || payload?.data?.added !== 2) {
    throw new Error(`Extra evaluator API failed: HTTP ${response.status}, ${payload?.error?.code ?? "no code"}`);
  }
  const result = await pool.query(`SELECT side,count(*)::integer AS n FROM pair_assignment
    WHERE assignment_id=$1 AND evaluator_user_id=$2 AND generation=1 GROUP BY side`, [id, fixture.studentId]);
  if (!result.rows.some(row => row.side === "GROUP" && row.n > 0) ||
      !result.rows.some(row => row.side === "INDIVIDUAL" && row.n > 0)) {
    throw new Error("Student still lacks a group or individual evaluation pair");
  }
  console.log(JSON.stringify({ assignmentOpen: true, studentPairs: result.rows }));
} finally {
  if (setupId) {
    await pool.query("DELETE FROM app_session WHERE user_id=$1", [setupId]).catch(() => {});
    await pool.query("DELETE FROM privacy_notice_acceptance WHERE user_id=$1", [setupId]).catch(() => {});
    await pool.query(`UPDATE classroom_member SET membership_status='WITHDRAWN',withdrawn_at=now()
      WHERE classroom_id=$1 AND user_id=$2`, [fixture.classroomId, setupId]).catch(() => {});
    await pool.query("UPDATE app_user SET status='DISABLED' WHERE id=$1", [setupId]).catch(() => {});
  }
  await pool.end();
}
