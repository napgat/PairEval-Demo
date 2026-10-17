import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium } from "@playwright/test";

const environment = process.argv[2] ?? "development";
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational database guard failed");
}
const origin = environment === "development" ? "http://localhost:3101" :
  "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 30000 });
const [owner, outsider, ...students] = Array.from({ length: 7 }, () => randomUUID());
const users = [owner, outsider, ...students];
const room = randomUUID(), assignment = randomUUID(), generationId = randomUUID();
const groups = Array.from({ length: 3 }, () => randomUUID()).sort();
const criterion = randomUUID(), pairId = randomUUID();
const tokens = new Map(users.map(id => [id, randomBytes(32).toString("hex")]));
const suffix = randomUUID().slice(0, 8);
async function call(path, user, method = "GET", body) {
  const response = await fetch(origin + path, { method, headers: {
    Cookie: `paireval_full_session=${tokens.get(user)}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(method === "POST" && path.includes("/evaluation/") ? { "Idempotency-Key": randomUUID() } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  return { status: response.status, payload };
}
function status(result, expected, label) {
  if (result.status !== expected) throw new Error(`${label}: expected ${expected}, got ${result.status}, code=${result.payload?.error?.code}`);
  return result.payload?.data;
}
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [index, user] of users.entries()) {
      const email = `day7-${index}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [user, email, `Synthetic Day 7 ${index}`, index === 0]);
      await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
        VALUES ($1,'synthetic-staging-v1')`, [user]);
      await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '30 minutes')`,
      [randomUUID(), user, createHash("sha256").update(tokens.get(user)).digest("hex")]);
    }
    await client.query("INSERT INTO classroom (id,name,slug,created_by) VALUES ($1,$2,$3,$4)",
      [room, `Synthetic Day 7 ${suffix}`, `day7-${suffix}`, owner]);
    await client.query("INSERT INTO classroom_member (id,classroom_id,user_id,role) VALUES ($1,$2,$3,'OWNER')",
      [randomUUID(), room, owner]);
    for (const [index, group] of groups.entries()) {
      await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,$3)",
        [group, room, `G${index}`]);
      for (const user of students.slice(index * 1, index * 1 + 1)) await client.query(`INSERT INTO classroom_member
        (id,classroom_id,user_id,role,group_id) VALUES ($1,$2,$3,'STUDENT',$4)`,
      [randomUUID(), room, user, group]);
    }
    // Add the remaining students to the third group so two eligible extra evaluators exist.
    for (const user of students.slice(3)) await client.query(`INSERT INTO classroom_member
      (id,classroom_id,user_id,role,group_id) VALUES ($1,$2,$3,'STUDENT',$4)`,
    [randomUUID(), room, user, groups[2]]);
    await client.query(`INSERT INTO assignment (id,classroom_id,name,slug,group_max_score,
      individual_max_score,group_deadline_utc,target_coverage,max_workload,instructor_weight,
      generation,status,created_by) VALUES ($1,$2,'Synthetic Day 7','day7-instructor',10,
      0,now()+interval '1 day',1,8,0.5,1,'OPEN',$3)`, [assignment, room, owner]);
    await client.query(`INSERT INTO assignment_generation (id,assignment_id,generation,seed,status)
      VALUES ($1,$2,1,'day7','ACTIVE')`, [generationId, assignment]);
    await client.query(`INSERT INTO criterion (id,assignment_id,side,name,weight_pct,display_order)
      VALUES ($1,$2,'GROUP','Quality',100,0)`, [criterion, assignment]);
    await client.query(`INSERT INTO pair_assignment (id,assignment_id,criterion_id,side,
      group_a_id,group_b_id,evaluator_user_id,display_left,generation)
      VALUES ($1,$2,$3,'GROUP',$4,$5,$6,'A',1)`,
    [pairId, assignment, criterion, groups[0], groups[1], students[2]]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  const base = `/api/full-system/assignments/${assignment}`;
  status(await call(`${base}/evaluators`, outsider, "POST", { pairId, mode: "STUDENT", count: 1 }), 404,
    "outsider add denied");
  status(await call(`${base}/evaluators`, students[0], "POST", { pairId, mode: "STUDENT", count: 1 }), 404,
    "student add denied");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
    const page = await context.newPage();
    await page.goto(`${origin}/full-system/classrooms/${room}/assignments`);
    await page.getByRole("button", { name: /Synthetic Day 7/ }).filter({ hasText: "เปิดรับการประเมิน" }).click();
    await page.getByText("ตรวจแผน เพิ่มผู้ประเมิน และดูประวัติ", { exact: true }).click();
    await page.getByLabel("คู่และเกณฑ์").selectOption({ index: 1 });
    await page.getByRole("button", { name: "มอบคู่ให้ตนเอง" }).click();
    await page.getByText("เพิ่มคู่ประเมินของผู้สอนแล้ว").waitFor();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    if (width > 320) throw new Error(`Instructor controls overflow at 320 px: ${width}`);
    await context.close();
  } finally { await browser.close(); }
  status(await call(`${base}/evaluators`, owner, "POST", { pairId, mode: "INSTRUCTOR", count: 1 }), 409,
    "duplicate instructor denied");
  const added = status(await call(`${base}/evaluators`, owner, "POST", {
    pairId, mode: "STUDENT", count: 1 }), 200, "extra student assigned");
  if (added.added !== 1) throw new Error("Extra assignment count mismatch");
  const extra = await pool.query(`SELECT evaluator_user_id,source FROM pair_assignment
    WHERE assignment_id=$1 AND source='INSTRUCTOR_EXTRA'`, [assignment]);
  if (extra.rows.length !== 1 || extra.rows[0].evaluator_user_id === students[0] ||
      extra.rows[0].evaluator_user_id === students[1]) throw new Error("Extra evaluator eligibility failed");
  const notices = await pool.query(`SELECT recipient_user_id FROM app_notification
    WHERE assignment_id=$1 AND event_type='EXTRA_EVALUATOR'`, [assignment]);
  if (notices.rows.length !== 1 || notices.rows[0].recipient_user_id !== extra.rows[0].evaluator_user_id) {
    throw new Error("Extra evaluator notification missing");
  }
  const instructorPair = await pool.query(`SELECT id FROM pair_assignment
    WHERE assignment_id=$1 AND source='INSTRUCTOR_SELF'`, [assignment]);
  const evalPath = `${base}/evaluation/group`;
  status(await call(evalPath, owner, "PUT", { pairId: instructorPair.rows[0].id, choice: 6 }), 200,
    "instructor draft");
  status(await call(evalPath, owner, "POST"), 200, "instructor submit");
  status(await call(evalPath, students[2], "PUT", { pairId, choice: 1 }), 200,
    "student draft");
  status(await call(evalPath, students[2], "POST"), 200, "student submit");
  status(await call(`${base}/score-runs`, owner, "POST", { kind: "INTERIM" }), 200,
    "weighted score run");
  const snapshot = await pool.query(`SELECT output_json FROM score_snapshot WHERE assignment_id=$1
    ORDER BY snapshot_no DESC LIMIT 1`, [assignment]);
  const groupScore = snapshot.rows[0].output_json.groups.find(group => group.id === groups[0]);
  if (Math.abs(groupScore.criteria[0].q - 2 / 3) > 0.0001 ||
      groupScore.criteria[0].comparisons !== 2) throw new Error("Fractional instructor weight failed");
  const myScore = status(await call(`${base}/my-score`, students[0]), 200,
    "student weighted My Score");
  if (Math.abs(myScore.groupComponent - groupScore.component) > 0.0001) {
    throw new Error("Student My Score differs from weighted score snapshot");
  }
  console.log(`${environment} Day 7 instructor smoke passed: role denial, 320 px instructor UI,
    eligible extra assignment, notification, duplicate rejection, instructor/student submission,
    weighted q and comparison count`);
} finally {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM score_snapshot_item WHERE score_snapshot_id IN (SELECT id FROM score_snapshot WHERE assignment_id=$1)", [assignment]);
    await client.query("DELETE FROM score_snapshot WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM submission_answer WHERE revision_id IN (SELECT id FROM submission_revision WHERE assignment_id=$1)", [assignment]);
    await client.query("DELETE FROM submission_revision WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM evaluation_draft_answer WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM evaluation_draft WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM pair_assignment WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM criterion WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM assignment_generation WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM assignment WHERE id=$1", [assignment]);
    await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM classroom WHERE id=$1", [room]);
    await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [users]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [users]);
    await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [users]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
