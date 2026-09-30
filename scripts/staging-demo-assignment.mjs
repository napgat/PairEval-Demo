import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

const action = process.argv[2] ?? "create";
if (!["create", "status"].includes(action)) throw new Error("Use create or status");
process.loadEnvFile(".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== "staging" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}
const fixture = JSON.parse(await readFile(join(process.cwd(), ".verification", "staging-demo-access.json"), "utf8"));
const origin = "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const setupId = randomUUID(), token = randomBytes(32).toString("hex");
let setupCreated = false;
async function api(path, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    Cookie: `paireval_full_session=${token}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || response.status === 202) {
    throw new Error(`Preview API ${method} ${path}: HTTP ${response.status}, ${payload?.error?.code ?? "no code"}`);
  }
  return payload?.data;
}
try {
  if (action === "status") {
    const rows = await pool.query(`SELECT a.id,a.status,a.generation,p.side,
      count(p.id)::integer AS total_pairs,
      count(p.id) FILTER (WHERE p.evaluator_user_id=$2)::integer AS student_pairs
      FROM assignment a LEFT JOIN pair_assignment p ON p.assignment_id=a.id AND p.generation=a.generation
      WHERE a.classroom_id=$1 GROUP BY a.id,p.side ORDER BY p.side`, [fixture.classroomId, fixture.studentId]);
    console.log(JSON.stringify(rows.rows));
    process.exitCode = 0;
  } else {
  const classroom = await pool.query(`SELECT c.id, count(a.id)::integer AS assignments
    FROM classroom c LEFT JOIN assignment a ON a.classroom_id=c.id
    WHERE c.id=$1 AND c.slug=$2 AND c.created_by=$3
    GROUP BY c.id`, [fixture.classroomId, fixture.slug, fixture.teacherId]);
  if (classroom.rows[0]?.assignments !== 0) throw new Error("Preview classroom already has an assignment");
  const setupEmail = `staging-preview-setup-${setupId.slice(0, 8)}@example.test`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status)
      VALUES ($1,$2,$2,'Synthetic Preview Setup','ACTIVE')`, [setupId, setupEmail]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'CO_TEACHER')`, [randomUUID(), fixture.classroomId, setupId]);
    await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
      VALUES ($1,'synthetic-staging-v1')`, [setupId]);
    await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
      VALUES ($1,$2,$3,now()+interval '15 minutes')`,
    [randomUUID(), setupId, createHash("sha256").update(token).digest("hex")]);
    await client.query("COMMIT");
    setupCreated = true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }

  const input = { name: "งานประเมินตัวอย่าง", description: "งานสาธิตด้วยรายชื่อและผลงานสังเคราะห์ ไม่ใช่คะแนนจริง",
    groupMaxScore: 10, individualMaxScore: 10,
    groupDeadline: "2030-12-01T16:59:00+07:00", individualDeadline: "2030-12-01T16:59:00+07:00",
    targetCoverage: 2, maxWorkload: 10, instructorWeight: 1,
    criteria: [{ side: "GROUP", name: "ความชัดเจนของผลงาน", weightPct: 100 },
      { side: "INDIVIDUAL", name: "การมีส่วนร่วม", weightPct: 100 }], artifacts: [] };
  const assignment = await api(`/api/full-system/classrooms/${fixture.classroomId}/assignments`, "POST", input);
  const plan = await api(`/api/full-system/assignments/${assignment.id}/feasibility?seed=7`);
  if (!plan.feasible) throw new Error("Preview pairing is not feasible");
  const published = await api(`/api/full-system/assignments/${assignment.id}/publish`, "POST", { seed: "7" });
  let pairs = await pool.query(`SELECT side,count(*)::integer AS n FROM pair_assignment
    WHERE assignment_id=$1 AND evaluator_user_id=$2 AND generation=1 GROUP BY side`,
  [assignment.id, fixture.studentId]);
  if (!pairs.rows.some(row => row.side === "GROUP" && row.n > 0)) {
    const groupPair = await pool.query(`SELECT id FROM pair_assignment WHERE assignment_id=$1
      AND generation=1 AND side='GROUP' AND group_a_id<>$2 AND group_b_id<>$2 LIMIT 1`,
    [assignment.id, fixture.groups[0]]);
    if (groupPair.rowCount !== 1) throw new Error("No group comparison eligible for the enrolled student");
    await api(`/api/full-system/assignments/${assignment.id}/evaluators`, "POST",
      { pairId: groupPair.rows[0].id, mode: "STUDENT", count: 2 });
    pairs = await pool.query(`SELECT side,count(*)::integer AS n FROM pair_assignment
      WHERE assignment_id=$1 AND evaluator_user_id=$2 AND generation=1 GROUP BY side`,
    [assignment.id, fixture.studentId]);
  }
  if (!pairs.rows.some(row => row.side === "GROUP" && row.n > 0) ||
      !pairs.rows.some(row => row.side === "INDIVIDUAL" && row.n > 0)) {
    throw new Error("The enrolled student received no group or individual evaluation pair");
  }
  console.log(JSON.stringify({ published: true, generation: published.generation,
    pairAssignments: published.assignmentCount,
    studentGroupPairs: pairs.rows.find(row => row.side === "GROUP").n,
    studentIndividualPairs: pairs.rows.find(row => row.side === "INDIVIDUAL").n }));
  }
} finally {
  if (setupCreated) {
    await pool.query("DELETE FROM app_session WHERE user_id=$1", [setupId]).catch(() => {});
    await pool.query("DELETE FROM privacy_notice_acceptance WHERE user_id=$1", [setupId]).catch(() => {});
    await pool.query(`UPDATE classroom_member SET membership_status='WITHDRAWN',withdrawn_at=now()
      WHERE classroom_id=$1 AND user_id=$2`, [fixture.classroomId, setupId]).catch(() => {});
    await pool.query("UPDATE app_user SET status='DISABLED' WHERE id=$1", [setupId]).catch(() => {});
  }
  await pool.end();
}
