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
const origin = environment === "development" ? "http://localhost:3101" : "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const suffix = randomUUID().slice(0, 8);
const owner = randomUUID(), outsider = randomUUID(), students = Array.from({ length: 9 }, () => randomUUID());
const users = [owner, outsider, ...students], room = randomUUID();
const groups = Array.from({ length: 3 }, () => randomUUID());
const tokens = new Map(users.map(id => [id, randomBytes(32).toString("hex")]));
let assignment;
async function api(path, user, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    Cookie: `paireval_full_session=${tokens.get(user)}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(method === "POST" && path.includes("/evaluation/") ? { "Idempotency-Key": randomUUID() } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, payload: await response.json() };
}
function check(result, status, name) {
  if (result.status !== status) throw new Error(`${name}: expected ${status}, got ${result.status} (${result.payload?.error?.code ?? "none"}: ${result.payload?.error?.message ?? "no details"})`);
  return result.payload.data;
}
try {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    for (const [index, id] of users.entries()) {
      const email = `day4-${index}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [id, email, `Synthetic Day 4 ${index}`, index === 0]);
      await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
        VALUES ($1,'synthetic-staging-v1')`, [id]);
      await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '20 minutes')`, [randomUUID(), id,
        createHash("sha256").update(tokens.get(id)).digest("hex")]);
    }
    await client.query("INSERT INTO classroom (id,name,slug,created_by) VALUES ($1,$2,$3,$4)",
      [room, `Synthetic Day 4 ${suffix}`, `day4-${suffix}`, owner]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), room, owner]);
    for (const [index, id] of groups.entries()) await client.query(`INSERT INTO group_entity
      (id,classroom_id,name) VALUES ($1,$2,$3)`, [id, room, `G${index}`]);
    for (const [index, id] of students.entries()) await client.query(`INSERT INTO classroom_member
      (id,classroom_id,user_id,role,group_id) VALUES ($1,$2,$3,'STUDENT',$4)`,
    [randomUUID(), room, id, groups[Math.floor(index / 3)]]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }

  check(await api(`/api/full-system/classrooms/${room}/student-assignments`, outsider), 404, "outsider classroom");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${origin}/full-system`);
    await page.getByRole("heading", { name: "เลือกห้องเรียน" }).waitFor();
    await page.getByRole("link", { name: "จัดการห้องเรียน" }).click();
    await page.getByRole("heading", { name: "จัดการงานประเมิน" }).waitFor();
    await page.getByRole("button", { name: "＋ สร้างงานใหม่", exact: true }).click();
    await page.getByLabel("ชื่องาน").fill("Synthetic evaluation");
    await page.getByLabel("คะแนนรายบุคคล").fill("10");
    await page.getByLabel(/กำหนดส่งกลุ่ม/).fill("2030-12-01T16:59");
    await page.getByLabel(/กำหนดส่งรายบุคคล/).fill("2030-12-01T16:59");
    await page.getByLabel("คะแนนรายบุคคล").fill("10");
    await page.getByLabel("ชื่อเกณฑ์").fill("Quality");
    await page.getByRole("button", { name: "เพิ่มเกณฑ์", exact: true }).click();
    const individualCriterion = page.locator(".criteria-row").nth(1);
    await individualCriterion.locator("select").selectOption("INDIVIDUAL");
    await individualCriterion.getByRole("textbox").fill("Individual quality");
    await individualCriterion.locator("input[type=number]").fill("100");
    await page.getByText("ตั้งค่าการจับคู่และน้ำหนักผู้ประเมิน", { exact: true }).click();
    await page.getByLabel("ผู้ประเมินต่อคู่ที่ต้องการ").fill("1");
    await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await page.getByText("บันทึกฉบับร่างแล้ว").waitFor();
    assignment = (await pool.query("SELECT id FROM assignment WHERE classroom_id=$1", [room])).rows[0]?.id;
    if (!assignment) throw new Error("UI did not persist DRAFT");
    await page.getByRole("button", { name: "ตรวจความพร้อมการจับคู่" }).click();
    await page.getByText("พร้อมเผยแพร่").waitFor();
    await page.getByRole("button", { name: "เผยแพร่และบันทึกคู่" }).click();
    await page.getByText("เผยแพร่และบันทึกคู่แล้ว").waitFor();
    await context.close();
  } finally { await browser.close(); }
  const path = `/api/full-system/assignments/${assignment}/evaluation/group`;
  const individualPath = `/api/full-system/assignments/${assignment}/evaluation/individual`;
  const pairRow = await pool.query(`SELECT id,evaluator_user_id,display_left FROM pair_assignment
    WHERE assignment_id=$1 AND side='GROUP' AND (group_a_id=$2 OR group_b_id=$2) ORDER BY id LIMIT 1`,
  [assignment, groups[0]]);
  if (!pairRow.rows[0]) throw new Error("Fixture lacks group pair");
  const pair = pairRow.rows[0], evaluator = pair.evaluator_user_id, targetStudent = students[0];
  const own = check(await api(path, evaluator), 200, "assigned pairs");
  if (!own.pairs.some(row => row.id === pair.id) || own.pairs.some(row => "evaluatorId" in row)) {
    throw new Error("Pair retrieval scope or anonymity failed");
  }
  const ownIndividual = check(await api(individualPath, evaluator), 200, "assigned Individual pairs");
  const individualPairId = ownIndividual.pairs[0]?.id;
  if (!individualPairId) throw new Error("Fixture lacks an Individual pair for the evaluator");
  check(await api(path, outsider), 404, "outsider evaluation");
  check(await api(path, students.find(id => id !== evaluator), "PUT", { pairId: pair.id, choice: 1 }), 404, "other student's pair");
  const scorePath = `/api/full-system/assignments/${assignment}/my-score`;
  const before = check(await api(scorePath, targetStudent), 200, "initial score");
  if (before.groupStatus !== "NO_DATA" || before.total !== null) throw new Error("No-data score leak");
  check(await api(path, evaluator, "PUT", { pairId: pair.id, choice: 1 }), 200, "save draft");
  if (check(await api(path, evaluator), 200, "draft refresh").pairs.find(row => row.id === pair.id)?.choice !== 1) {
    throw new Error("Draft not restored");
  }
  if (check(await api(scorePath, targetStudent), 200, "score excludes draft").groupStatus !== "NO_DATA") {
    throw new Error("Unsubmitted draft affected score");
  }
  let groupScoreAfterFirstSubmission = null;
  const studentBrowser = await chromium.launch({ headless: true });
  try {
    const context = await studentBrowser.newContext({ viewport: { width: 320, height: 700 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(evaluator), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on("dialog", dialog => void dialog.accept());
    await page.goto(`${origin}/full-system`);
    await page.getByRole("heading", { name: "ห้องเรียนของฉัน" }).waitFor();
    await page.getByRole("link", { name: "ดูงานของฉัน" }).click();
    await page.getByRole("heading", { name: "งานประเมินของฉัน" }).waitFor();
    await page.getByRole("link", { name: "ประเมินกลุ่ม" }).click();
    await page.getByRole("heading", { name: "เปรียบเทียบผลงานกลุ่ม" }).waitFor();
    const firstRadio = page.locator(`input[name="${pair.id}"]`).first();
    await firstRadio.focus();
    await page.keyboard.press("ArrowRight");
    if (!await page.locator(`input[name="${pair.id}"]`).nth(1).isChecked()) {
      throw new Error("Radio group did not support keyboard arrows");
    }
    const radioBox = await firstRadio.boundingBox();
    if (!radioBox || radioBox.width < 24 || radioBox.height < 24) {
      throw new Error("Radio target smaller than 24 px");
    }
    const horizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth);
    if (horizontalOverflow) throw new Error("Evaluation page overflows at 320 px");
    await page.locator(`input[name="${pair.id}"]`).nth(1).check();
    const saved = page.waitForResponse(response => response.url().endsWith(path) &&
      response.request().method() === "PUT" && response.status() === 200);
    await firstRadio.check();
    await saved;
    await page.getByText(/บันทึกแล้ว เมื่อ/).waitFor();
    await page.reload();
    if (!await page.locator(`input[name="${pair.id}"]`).first().isChecked()) throw new Error("UI draft not restored after refresh");
    await page.getByRole("button", { name: "ยืนยันส่งคำตอบ" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยันส่งคำตอบ", exact: true }).click();
    await page.getByText(/ส่งคำตอบรุ่น 1 แล้ว/).waitFor();

    const firstGroupScore = check(await api(scorePath, targetStudent), 200, "score after Group revision 1");
    if (firstGroupScore.groupStatus !== "AVAILABLE" || firstGroupScore.groupComponent === null) {
      throw new Error("Group revision 1 did not produce a visible score");
    }
    groupScoreAfterFirstSubmission = firstGroupScore.groupComponent;

    await page.getByRole("link", { name: "กลับไปงานประเมิน" }).click();
    await page.getByRole("heading", { name: "งานประเมินของฉัน" }).waitFor();
    await page.getByRole("link", { name: "ประเมินรายบุคคล" }).click();
    await page.getByRole("heading", { name: "เปรียบเทียบผลงานรายบุคคล" }).waitFor();
    const individualCard = page.locator(".evaluation-pair").first();
    if (await individualCard.getAttribute("data-pair-id") !== individualPairId) {
      throw new Error(`Individual pair UI mismatch: expected ${individualPairId}, got ${await individualCard.getAttribute("data-pair-id")}`);
    }
    const individualRadios = individualCard.locator('input[type="radio"]');
    if (await individualRadios.count() !== 6) throw new Error(`Individual pair rating controls missing: ${await individualRadios.count()}`);
    const individualSaved = page.waitForResponse(response => response.url().endsWith(individualPath) &&
      response.request().method() === "PUT" && response.status() === 200);
    await individualRadios.first().check();
    await individualSaved;
    await page.getByText(/บันทึกแล้ว เมื่อ/).waitFor();
    await page.reload();
    if (!await individualRadios.first().isChecked()) throw new Error("Individual draft did not survive page reload");
    await page.getByRole("button", { name: "ยืนยันส่งคำตอบ", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยันส่งคำตอบ", exact: true }).click();
    await page.getByText(/ส่งคำตอบรุ่น 1 แล้ว/).waitFor();
    const individualChanged = page.waitForResponse(response => response.url().endsWith(individualPath) &&
      response.request().method() === "PUT" && response.status() === 200);
    await individualRadios.nth(1).check();
    await individualChanged;
    await page.getByRole("button", { name: "ส่งฉบับแก้ไข", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ส่งฉบับแก้ไข", exact: true }).click();
    await page.getByText(/ส่งคำตอบรุ่น 2 แล้ว/).waitFor();
    await page.reload();
    if (!await individualRadios.nth(1).isChecked()) throw new Error("Individual revision 2 was not restored after reload");

    await page.getByRole("link", { name: "กลับไปงานประเมิน" }).click();
    await page.getByRole("heading", { name: "งานประเมินของฉัน" }).waitFor();
    await page.getByRole("link", { name: "ประเมินกลุ่ม" }).click();
    await page.getByRole("heading", { name: "เปรียบเทียบผลงานกลุ่ม" }).waitFor();
    const groupRadios = page.locator(`input[name="${pair.id}"]`);
    const changedGroupDraft = page.waitForResponse(response => response.url().endsWith(path) &&
      response.request().method() === "PUT" && response.status() === 200);
    await groupRadios.nth(5).check();
    await changedGroupDraft;
    await page.getByRole("button", { name: "ส่งฉบับแก้ไข", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ส่งฉบับแก้ไข", exact: true }).click();
    await page.getByText(/ส่งคำตอบรุ่น 2 แล้ว/).waitFor();
    await page.reload();
    if (!await groupRadios.nth(5).isChecked()) throw new Error("Group revision 2 was not restored after reload");
    await context.close();
  } finally { await studentBrowser.close(); }
  if (check(await api(path, evaluator), 200, "Group UI submissions").latestSubmission?.revision !== 2 ||
      check(await api(individualPath, evaluator), 200, "Individual UI submissions").latestSubmission?.revision !== 2) {
    throw new Error("UI submission or re-submit missing for Group/Individual");
  }
  const score1 = check(await api(scorePath, targetStudent), 200, "score after submit");
  if (score1.groupStatus !== "AVAILABLE" || score1.groupComponent === null ||
      JSON.stringify(score1).includes("evaluatorId")) throw new Error("Published own score missing or identity leak");
  if (groupScoreAfterFirstSubmission === null || score1.groupComponent === groupScoreAfterFirstSubmission) {
    throw new Error("Group re-submit did not update the visible score");
  }
  const scoreBrowser = await chromium.launch({ headless: true });
  try {
    const context = await scoreBrowser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(targetStudent), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${origin}/full-system/assignments/${assignment}/my-score`);
    await page.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
    await page.getByText("คะแนนระหว่างดำเนินงาน").waitFor();
    await page.getByText(score1.groupComponent.toFixed(2), { exact: true }).first().waitFor();
    if ((await page.locator("main").innerText()).includes("ผู้ประเมิน:") ||
        (await page.locator("main").innerText()).includes("เปลี่ยนจากเมื่อวาน")) {
      throw new Error("My Score UI exposed evaluator or delta");
    }
    await context.close();
  } finally { await scoreBrowser.close(); }
  const revisions = await pool.query(`SELECT r.side,r.revision_number,a.choice FROM submission_revision r
    JOIN submission_answer a ON a.revision_id=r.id
    WHERE r.assignment_id=$1 AND r.evaluator_user_id=$2 ORDER BY r.side,r.revision_number`, [assignment, evaluator]);
  const groupRevisions = revisions.rows.filter(row => row.side === "GROUP");
  const individualRevisions = revisions.rows.filter(row => row.side === "INDIVIDUAL");
  if (groupRevisions.length !== 2 || groupRevisions[0].choice !== 1 || groupRevisions[1].choice !== 6 ||
      individualRevisions.length !== 2 || individualRevisions[0].choice !== 1 || individualRevisions[1].choice !== 2) {
    throw new Error("Immutable Group/Individual revision history mismatch");
  }

  const reportBrowser = await chromium.launch({ headless: true });
  try {
    const context = await reportBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${origin}/full-system/assignments/${assignment}/reports`);
    await page.getByRole("heading", { name: "รายงานและตัดสินคะแนน" }).waitFor();
    await page.getByRole("button", { name: "คำนวณผลระหว่างดำเนินงานใหม่", exact: true }).click();
    await page.getByText("คำนวณคะแนนชั่วคราวแล้ว", { exact: true }).waitFor();
    await page.getByText(/คะแนนฉบับที่ 1/).waitFor();
    await page.getByRole("tab", { name: "คะแนนรายบุคคล", exact: true }).click();
    await page.getByRole("columnheader", { name: "รายบุคคล", exact: true }).waitFor();
    await context.close();
  } finally { await reportBrowser.close(); }

  const updatedScoreBrowser = await chromium.launch({ headless: true });
  try {
    const context = await updatedScoreBrowser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(targetStudent), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${origin}/full-system/assignments/${assignment}/my-score`);
    await page.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
    await page.getByText(/ส่งคำตอบแล้ว \d+ จาก \d+ คู่/).waitFor();
    await page.getByText("คะแนนกลุ่ม", { exact: true }).waitFor();
    await page.getByText("คะแนนรายบุคคล", { exact: true }).waitFor();
    if ((await page.locator("main").innerText()).includes("ผู้ประเมิน:")) {
      throw new Error("Updated My Score UI exposed evaluator identity");
    }
    await context.close();
  } finally { await updatedScoreBrowser.close(); }
  await pool.query("UPDATE assignment SET group_deadline_utc=now()-interval '5 minutes' WHERE id=$1", [assignment]);
  check(await api(path, evaluator, "PUT", { pairId: pair.id, choice: 2 }), 409, "deadline save");
  check(await api(path, evaluator, "POST"), 409, "deadline submit");
  if (!check(await api(path, evaluator), 200, "deadline read-only").readOnly) throw new Error("Read-only deadline missing");
  const deadlinePath = `/api/full-system/assignments/${assignment}/deadlines`;
  check(await api(deadlinePath, outsider, "PATCH", { groupDeadline: "2030-12-02T16:59:00+07:00" }), 404, "outsider deadline");
  check(await api(deadlinePath, owner, "PATCH", { groupDeadline: "2030-12-02T16:59:00+07:00" }), 200, "extend after deadline");
  if (check(await api(path, evaluator), 200, "extended deadline").readOnly) throw new Error("Extension did not reopen evaluation");
  check(await api(`/api/full-system/assignments/${assignment}/unpublish`, owner, "POST",
    { reason: "synthetic invalidation check" }), 200, "unpublish");
  check(await api(path, evaluator), 409, "invalidated evaluation hidden");
  check(await api(scorePath, targetStudent), 409, "invalidated score hidden");
  console.log(`${environment} Day 4 evaluation smoke passed: instructor creates/publishes, student Group/Individual GUI draft/reload/submit/re-submit,
    instructor Interim report GUI, updated My Score GUI, scope, immutable revision history, deadline denial/extension, invalidation and no identity leak`);
} finally {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    assignment ??= (await client.query("SELECT id FROM assignment WHERE classroom_id=$1", [room])).rows[0]?.id;
    if (assignment) {
      await client.query("DELETE FROM scheduled_score_run WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM appeal WHERE assignment_id=$1", [assignment]);
      await client.query(`DELETE FROM score_snapshot_item WHERE score_snapshot_id IN
        (SELECT id FROM score_snapshot WHERE assignment_id=$1)`, [assignment]);
      await client.query("DELETE FROM score_snapshot WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM score_override WHERE assignment_id=$1", [assignment]);
      await client.query(`DELETE FROM submission_answer WHERE revision_id IN
        (SELECT id FROM submission_revision WHERE assignment_id=$1)`, [assignment]);
      await client.query("DELETE FROM submission_revision WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM evaluation_draft_answer WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM evaluation_draft WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM pair_assignment WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM assignment_generation WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM criterion WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM group_artifact WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM individual_artifact WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM assignment WHERE id=$1", [assignment]);
    }
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
