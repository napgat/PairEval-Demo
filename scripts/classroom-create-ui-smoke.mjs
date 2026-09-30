import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium } from "@playwright/test";

process.loadEnvFile(".env.local");
if (process.env.PAIR_EVAL_ENV !== "development" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval development database guard failed");
}

const origin = "http://localhost:3102";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const suffix = randomUUID().slice(0, 8);
const teacherId = randomUUID();
const token = randomBytes(32).toString("hex");
const emails = [`classroom-ui-teacher-${suffix}@example.test`,
  `classroom-ui-student-1-${suffix}@example.test`, `classroom-ui-student-2-${suffix}@example.test`];
const classroomName = `Synthetic Classroom UI ${suffix}`;
const csv = ["email,group_name,student_id,display_name",
  `${emails[1]},Group A,S001,Synthetic Student One`,
  `${emails[2]},Group A,S002,Synthetic Student Two`].join("\n");
let browser;

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO app_user
      (id,email_lookup,email_raw,display_name,status,can_create_classroom)
      VALUES ($1,$2,$2,$3,'ACTIVE',true)`, [teacherId, emails[0], `Synthetic Teacher ${suffix}`]);
    await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
      VALUES ($1,'synthetic-staging-v1')`, [teacherId]);
    await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
      VALUES ($1,$2,$3,now()+interval '20 minutes')`, [randomUUID(), teacherId,
      createHash("sha256").update(token).digest("hex")]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: "paireval_full_session", value: token, url: origin }]);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${origin}/full-system`);
  await page.getByRole("heading", { name: "เลือกห้องเรียน" }).waitFor();
  await page.locator(".fs-create-classroom > summary").click();
  await page.getByLabel("ชื่อห้องเรียน").fill(classroomName);
  await page.getByLabel("เขตเวลาของห้องเรียน").selectOption("Asia/Bangkok");
  await page.getByLabel("รายชื่อนักศึกษา (CSV)").fill(csv);
  await page.getByRole("button", { name: "สร้างห้องเรียน", exact: true }).click();
  await page.getByText("สร้างห้องเรียนแล้ว · นักศึกษา 2 คน · 1 กลุ่ม", { exact: true }).waitFor();
  await page.getByRole("heading", { name: classroomName, exact: true }).waitFor();

  const result = await pool.query(
    "SELECT id FROM classroom WHERE name=$1 AND created_by=$2", [classroomName, teacherId]);
  if (result.rowCount !== 1) throw new Error(`Expected one created classroom, found ${result.rowCount}`);
  const classroomId = result.rows[0].id;
  const counts = await pool.query(`SELECT
      (SELECT count(*) FROM classroom_member WHERE classroom_id=$1 AND role='STUDENT') AS students,
      (SELECT count(*) FROM group_entity WHERE classroom_id=$1) AS groups`, [classroomId]);
  if (counts.rows[0].students !== "2" || counts.rows[0].groups !== "1") {
    throw new Error(`Unexpected roster after create: ${JSON.stringify(counts.rows[0])}`);
  }
  console.log("Development classroom-creation UI smoke passed: teacher submits synthetic roster, classroom and 2 students/1 group appear, database contents match");
  await context.close();
} finally {
  if (browser) await browser.close();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT id FROM classroom WHERE name=$1 AND created_by=$2", [classroomName, teacherId]);
    for (const row of found.rows) {
      await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [row.id]);
      await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [row.id]);
      await client.query("DELETE FROM classroom WHERE id=$1", [row.id]);
    }
    await client.query("DELETE FROM app_session WHERE user_id=$1", [teacherId]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=$1", [teacherId]);
    await client.query("DELETE FROM app_user WHERE email_lookup=ANY($1::text[])", [emails]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
