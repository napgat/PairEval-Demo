import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import ExcelJS from "exceljs";
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
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
  connectionTimeoutMillis: 30000 });
const suffix = randomUUID().slice(0, 8);
const owner = randomUUID(), outsider = randomUUID(), students = Array.from({ length: 9 }, () => randomUUID());
const ta = randomUUID(), coTeacher = randomUUID();
const users = [owner, outsider, ...students, ta, coTeacher];
const room = randomUUID(), assignment = randomUUID(), generationId = randomUUID();
const groups = Array.from({ length: 3 }, () => randomUUID()).sort();
const criteria = [randomUUID(), randomUUID()];
const groupPair = randomUUID(), individualPair = randomUUID();
const tokens = new Map(users.map(id => [id, randomBytes(32).toString("hex")]));
async function call(path, actor, method = "GET", body, idempotencyKey) {
  const response = await fetch(`${origin}${path}`, { method, headers: {
    Cookie: `paireval_full_session=${tokens.get(actor)}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(method === "POST" && path.includes("/evaluation/") ?
      { "Idempotency-Key": idempotencyKey === undefined ? randomUUID() : idempotencyKey } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" })
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() :
    await response.arrayBuffer();
  return { response, data };
}
function expectStatus(result, status, label) {
  if (result.response.status !== status) throw new Error(`${label}: expected ${status}, got ${result.response.status}
    (${result.data?.error?.code ?? "none"})`);
  return result.data?.data;
}
try {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    for (const [index, id] of users.entries()) {
      const email = `day5-${index}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [id, email, `Synthetic Day 5 ${index}`, index === 0]);
      await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
        VALUES ($1,'synthetic-staging-v1')`, [id]);
      await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '30 minutes')`, [randomUUID(), id,
        createHash("sha256").update(tokens.get(id)).digest("hex")]);
    }
    await client.query("INSERT INTO classroom (id,name,slug,created_by) VALUES ($1,$2,$3,$4)",
      [room, `Synthetic Day 5 ${suffix}`, `day5-${suffix}`, owner]);
    await client.query(`INSERT INTO synthetic_quality_cohort(classroom_id,provenance)
      VALUES ($1,'day5-score-smoke synthetic-only cohort')`, [room]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), room, owner]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$3,$4,'TA'),($2,$3,$5,'CO_TEACHER')`, [randomUUID(), randomUUID(), room, ta, coTeacher]);
    for (const [index, id] of groups.entries()) await client.query(`INSERT INTO group_entity
      (id,classroom_id,name) VALUES ($1,$2,$3)`, [id, room, `G${index}`]);
    for (const [index, id] of students.entries()) await client.query(`INSERT INTO classroom_member
      (id,classroom_id,user_id,role,group_id) VALUES ($1,$2,$3,'STUDENT',$4)`,
    [randomUUID(), room, id, groups[Math.floor(index / 3)]]);
    await client.query(`INSERT INTO assignment (id,classroom_id,name,slug,group_max_score,
      individual_max_score,group_deadline_utc,individual_deadline_utc,target_coverage,
      max_workload,generation,status,created_by) VALUES
      ($1,$2,'Synthetic Score','day5-score',15,5,now()+interval '1 day',
        now()+interval '1 day',1,8,1,'OPEN',$3)`, [assignment, room, owner]);
    await client.query(`INSERT INTO assignment_generation (id,assignment_id,generation,seed,status)
      VALUES ($1,$2,1,'day5','ACTIVE')`, [generationId, assignment]);
    await client.query(`INSERT INTO criterion (id,assignment_id,side,name,weight_pct,display_order)
      VALUES ($1,$3,'GROUP','Group quality',100,0),($2,$3,'INDIVIDUAL','Individual quality',100,0)`,
    [criteria[0], criteria[1], assignment]);
    await client.query(`INSERT INTO pair_assignment (id,assignment_id,criterion_id,side,
      group_a_id,group_b_id,evaluator_user_id,display_left,generation)
      VALUES ($1,$2,$3,'GROUP',$4,$5,$6,'A',1)`,
    [groupPair, assignment, criteria[0], groups[0], groups[1], students[6]]);
    const individualIds = [students[0], students[1]].sort();
    await client.query(`INSERT INTO pair_assignment (id,assignment_id,criterion_id,side,
      student_a_id,student_b_id,evaluator_user_id,display_left,generation)
      VALUES ($1,$2,$3,'INDIVIDUAL',$4,$5,$6,'A',1)`,
    [individualPair, assignment, criteria[1], individualIds[0], individualIds[1], students[2]]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  const scorePath = `/api/full-system/assignments/${assignment}/score-runs`;
  expectStatus(await call(scorePath, outsider), 404, "outsider score report");
  expectStatus(await call(scorePath, students[0]), 404, "student score report");
  expectStatus(await call(scorePath, students[0], "POST", { kind: "INTERIM" }), 404,
    "student recompute");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/group`, students[6],
    "PUT", { pairId: groupPair, choice: 1 }), 200, "group draft");
  const groupLease = expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/group/timing`,
    students[6], "POST", { pairId: groupPair }), 200, "synthetic group timing lease");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/group/timing`, students[6],
    "PUT", { pairId: groupPair, leaseId: groupLease.leaseId, sequence: 1, deltaMs: 1000, close: true }),
  200, "synthetic group timing close");
  const groupKey = randomUUID();
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/group`, students[6],
    "POST", undefined, groupKey), 200, "group submit");
  const replay = expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/group`,
    students[6], "POST", undefined, groupKey), 200, "idempotent group replay");
  if (replay.revision !== 1 || !replay.replayed) throw new Error("Duplicate submit created a revision");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/individual`,
    students[6], "POST", undefined, groupKey), 409, "key cannot move to another side");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/individual`, students[2],
    "PUT", { pairId: individualPair, choice: 1 }), 200, "individual draft");
  const individualLease = expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/individual/timing`,
    students[2], "POST", { pairId: individualPair }), 200, "synthetic individual timing lease");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/individual/timing`, students[2],
    "PUT", { pairId: individualPair, leaseId: individualLease.leaseId, sequence: 1, deltaMs: 1000, close: true }),
  200, "synthetic individual timing close");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/individual`, students[2],
    "POST"), 200, "individual submit");
  const first = expectStatus(await call(scorePath, owner, "POST", { kind: "INTERIM" }), 200,
    "interim snapshot");
  if (first.snapshotNo !== 1 || first.output.groups[0].component !== 15) {
    throw new Error("First snapshot score mismatch");
  }
  const read = expectStatus(await call(scorePath, owner), 200, "read snapshot");
  if (read.inputHash !== first.inputHash || read.output.students.length !== 9) {
    throw new Error("Snapshot report mismatch");
  }
  if (read.output.pairSummary?.length !== 2 ||
      read.output.pairSummary.find(row => row.side === "GROUP")?.meanForA !== 1) {
    throw new Error("Pair coverage aggregation mismatch");
  }
  if (read.output.quality?.version !== "qs-02-07-synthetic-v2" ||
      read.output.quality.measures.filter(row => row.id === "QS-02" && row.flagged).length !== 2 ||
      read.output.quality.measures.filter(row => row.id === "QS-05" && row.flagged && row.ratio === 1).length !== 2 ||
      read.output.quality.measures.filter(row => row.id === "QS-06" && row.ratio !== null).length !== 0 ||
      read.output.quality.measures.filter(row => row.id === "QS-07" && row.ratio !== null).length !== 0 ||
      read.output.quality.measures.filter(row => row.id === "QS-04").some(row => row.ratio !== null) ||
      students.some(id => JSON.stringify(read.output.quality).includes(id))) {
    throw new Error("Advisory quality evidence or pseudonym scope mismatch");
  }
  const qualityCsv = await call(`/api/full-system/assignments/${assignment}/exports`, owner,
    "POST", { format: "csv", report: "quality" });
  expectStatus(qualityCsv, 200, "quality CSV export");
  if (!new TextDecoder().decode(qualityCsv.data).includes("QS-02")) throw new Error("Quality CSV lacks signal evidence");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/exports`, students[0],
    "POST", { format: "csv", report: "group" }), 404, "student export denial");
  expectStatus(await call(`/api/full-system/assignments/${assignment}/exports`, owner,
    "POST", { format: "xlsx", report: "group", includeIdentities: true }), 409,
  "identity export denial");
  const csv = await call(`/api/full-system/assignments/${assignment}/exports`, owner,
    "POST", { format: "csv", report: "group" });
  expectStatus(csv, 200, "CSV export");
  if (new Uint8Array(csv.data)[0] !== 0xef || !new TextDecoder().decode(csv.data).includes("15")) {
    throw new Error("CSV BOM or score missing");
  }
  const xlsx = await call(`/api/full-system/assignments/${assignment}/exports`, owner,
    "POST", { format: "xlsx", report: "group" });
  expectStatus(xlsx, 200, "XLSX export");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(xlsx.data));
  if (workbook.worksheets.map(s => s.name).join("|") !==
      "Group Summary|Individual Summary|Pair Coverage|Metadata" ||
      workbook.getWorksheet("Metadata").getCell("B5").value !== "prd-v2.0-1") {
    throw new Error("XLSX 4-sheet metadata mismatch");
  }
  if (process.env.PAIR_EVAL_EXPORT_KEY) {
    // Separate export scenarios share a fixture actor; clear only its measured rate window.
    await pool.query("DELETE FROM api_rate_window WHERE user_id=$1 AND bucket='exports'", [owner]);
    const rawPath = `/api/full-system/assignments/${assignment}/exports/raw`;
    expectStatus(await call(rawPath, outsider, "POST", { includeIdentities: false }), 404,
      "outsider raw export denial");
    expectStatus(await call(rawPath, students[0], "POST", { includeIdentities: false }), 404,
      "student raw export denial");
    expectStatus(await call(rawPath, owner, "POST", { includeIdentities: true }), 422,
      "identity raw export requires explicit confirmation");
    const raw = await call(rawPath, owner, "POST", { includeIdentities: false });
    expectStatus(raw, 200, "pseudonymous raw export");
    const rawText = new TextDecoder().decode(raw.data);
    if (new Uint8Array(raw.data)[0] !== 0xef || !rawText.includes("ev_") ||
        rawText.includes(students[6]) || rawText.includes(students[2])) {
      throw new Error("Raw export alias or identity protection mismatch");
    }
  }
  expectStatus(await call(`${scorePath}/override`, students[0], "POST", {
    side: "GROUP", itemId: groups[0], value: 12, reason: "Synthetic review" }), 404,
  "student override denial");
  expectStatus(await call(`${scorePath}/override`, owner, "POST", {
    side: "GROUP", itemId: groups[0], value: 12, reason: "short" }), 422,
  "override reason validation");
  expectStatus(await call(`${scorePath}/override`, owner, "POST", {
    side: "GROUP", itemId: groups[0], value: 12, reason: "Synthetic artifact reviewed" }), 200,
  "override");
  const second = expectStatus(await call(scorePath, owner, "POST", { kind: "INTERIM" }), 200,
    "recomputed snapshot");
  if (second.snapshotNo !== 2 || second.output.groups.find(g => g.id === groups[0])?.component !== 12 ||
      second.output.students.find(s => s.id === students[0])?.groupComponent !== 12) {
    throw new Error("Override not reflected");
  }
  const previous = await pool.query("SELECT output_json FROM score_snapshot WHERE id=$1", [first.id]);
  if (previous.rows[0].output_json.groups[0].component !== 15) throw new Error("Old snapshot was changed");
  const browser = await chromium.launch({ headless: true });
  try { const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${origin}/full-system/assignments/${assignment}/reports`);
    await page.getByRole("heading", { name: "รายงานและตัดสินคะแนน" }).waitFor();
    await page.getByText("รุ่น 2 · ผลระหว่างดำเนินงาน").waitFor();
    await page.getByRole("tab", { name: "คะแนนรายบุคคล", exact: true }).click();
    await page.getByRole("columnheader", { name: "ส่ง/มอบหมาย" }).waitFor();
    await page.getByRole("tab", { name: "คุณภาพคำตอบ", exact: true }).click();
    await page.getByText("สัญญาณคุณภาพ QS-02–07", { exact: true }).waitFor();
    await page.getByText("QS-02 เลือกค่าเดิม", { exact: true }).first().waitFor();
    await page.getByText("QS-05 เปิดเฉพาะชุดทดสอบสังเคราะห์", { exact: false }).waitFor();
    if (process.env.PAIR_EVAL_SMOKE_SCREENSHOT) {
      await page.screenshot({ path: process.env.PAIR_EVAL_SMOKE_SCREENSHOT, fullPage: true });
    }
    await context.close();
  } finally { await browser.close(); }
  await pool.query(`UPDATE assignment SET group_deadline_utc=now()-interval '1 minute',
    individual_deadline_utc=now()-interval '1 minute' WHERE id=$1`, [assignment]);
  const final = expectStatus(await call(scorePath, owner, "POST", { kind: "FINAL" }), 200,
    "final snapshot");
  if (final.snapshotNo !== 3 || final.kind !== "FINAL") throw new Error("Finalize mismatch");
  if (process.env.PAIR_EVAL_WITHDRAWAL_SMOKE) {
    expectStatus(await call(`/api/full-system/classrooms/${room}/members/${students[6]}/withdraw`, owner,
      "POST", { reason: "Synthetic withdrawal correction", effectiveAt: new Date().toISOString(), expectedRosterVersion: 0 }),
    409, "withdrawal cannot rewrite a Final snapshot");
  }
  if (process.env.PAIR_EVAL_REVIEW_SMOKE) {
    expectStatus(await call(`/api/full-system/assignments/${assignment}/comparison-reviews`, owner, "POST",
      { pairId: individualPair, excluded: true, reason: "Synthetic comparison reviewed", expectedReviewId: null }), 409, "Final review requires Reopen");
  }
  const noticePath = "/api/full-system/notifications";
  const notices = expectStatus(await call(noticePath, students[0]), 200, "own notification list");
  if (notices.length !== 1 || notices[0].event !== "SCORE_FINALIZED" ||
      notices[0].deepLink !== `/full-system/assignments/${assignment}/my-score` ||
      /คะแนน|@|\d+[.]\d+/.test(notices[0].message)) throw new Error("Final notification leaked data or link failed");
  if (expectStatus(await call(noticePath, outsider), 200, "outsider notification list").length !== 0 ||
      expectStatus(await call(noticePath, owner), 200, "owner notification list").length !== 0) {
    throw new Error("Notification leaked outside student recipient scope");
  }
  expectStatus(await call(noticePath, students[1], "POST", { id: notices[0].id }), 404,
    "other student notification read denied");
  const badOrigin = await fetch(`${origin}${noticePath}`, { method: "POST", headers: {
    Cookie: `paireval_full_session=${tokens.get(students[0])}`,
    Origin: "https://untrusted.example.test", "Content-Type": "application/json" },
    body: JSON.stringify({ id: notices[0].id }) });
  if (badOrigin.status !== 403 || (await badOrigin.json()).error?.code !== "ORIGIN_INVALID") {
    throw new Error("Notification mutation accepted a cross-origin request");
  }
  expectStatus(await call(noticePath, students[0], "POST", { id: notices[0].id }), 200,
    "own notification read");
  const ownFinal = expectStatus(await call(`/api/full-system/assignments/${assignment}/my-score`,
    students[0]), 200, "own final score");
  if (ownFinal.status !== "FINAL" || ownFinal.groupComponent !== 12 ||
      ownFinal.individualStatus !== "INSUFFICIENT_DATA" || ownFinal.total !== null) {
    throw new Error("Own final score did not honor snapshot override or k anonymity");
  }
  const appealPath = `/api/full-system/assignments/${assignment}/appeals`;
  expectStatus(await call(appealPath, owner, "POST", { message: "Synthetic student asks for a review" }),
    404, "owner cannot file student appeal");
  const appeal = expectStatus(await call(appealPath, students[0], "POST", {
    message: "Synthetic student asks for a score review" }), 200, "student appeal");
  if (expectStatus(await call(appealPath, students[1]), 200, "other student's appeal list")
    .appeals.length !== 0) throw new Error("Appeal leaked to another student");
  if (expectStatus(await call(appealPath, owner), 200, "instructor appeal list")
    .appeals[0]?.id !== appeal.id) throw new Error("Instructor appeal not found");
  expectStatus(await call(appealPath, students[0], "PATCH", { appealId: appeal.id,
    status: "RESOLVED", resolution: "Synthetic response" }), 404, "student resolve denial");
  expectStatus(await call(appealPath, owner, "PATCH", { appealId: appeal.id,
    status: "RESOLVED", resolution: "Synthetic score was reviewed" }), 200,
  "instructor resolve appeal");
  expectStatus(await call(appealPath, owner, "PATCH", { appealId: appeal.id,
    status: "REJECTED", resolution: "Synthetic second response" }), 409,
  "appeal cannot resolve twice");
  const timelinePath = `/api/full-system/assignments/${assignment}/audit`;
  expectStatus(await call(timelinePath, students[0]), 404, "student audit denial");
  const timeline = expectStatus(await call(timelinePath, owner), 200, "instructor audit timeline");
  if (!timeline.some(row => row.action === "SCORE_FINALIZE_COMMITTED") ||
      JSON.stringify(timeline).includes("actorUserId")) throw new Error("Audit timeline missing or leaks actor");
  await pool.query("UPDATE assignment SET finalized_at=now()-interval '8 days' WHERE id=$1", [assignment]);
  expectStatus(await call(appealPath, students[1], "POST", {
    message: "Synthetic appeal after the seven day window" }), 409, "expired appeal denial");
  await pool.query("UPDATE assignment SET finalized_at=now() WHERE id=$1", [assignment]);
  expectStatus(await call(`${scorePath}/override`, owner, "POST", {
    side: "GROUP", itemId: groups[0], value: 11, reason: "Synthetic second review" }), 409,
  "finalized override denial");
  expectStatus(await call(`${scorePath}/reopen`, owner, "POST", { reason: "Synthetic appeal review" }),
    200, "reopen");
  if (expectStatus(await call(noticePath, students[0]), 200, "reopened notification list")
    .some(notice => notice.event === "SCORE_FINALIZED")) {
    throw new Error("Reopened score still advertised as final");
  }
  const after = expectStatus(await call(scorePath, owner), 200, "snapshot retained after reopen");
  if (after.assignmentStatus !== "CLOSED" || after.id !== final.id) {
    throw new Error("Reopen erased final snapshot");
  }
  const ownReopened = expectStatus(await call(`/api/full-system/assignments/${assignment}/my-score`,
    students[0]), 200, "own reopened interim score");
  if (ownReopened.status !== "INTERIM" || ownReopened.groupComponent !== 12) {
    throw new Error("Reopened interim score ignored current override");
  }
  if (process.env.PAIR_EVAL_REVIEW_SMOKE) {
    const reviewPath = `/api/full-system/assignments/${assignment}/comparison-reviews`;
    const reviewBody = { pairId: individualPair, excluded: true, reason: "Synthetic comparison reviewed", expectedReviewId: null };
    for (const actor of [outsider, students[0], ta]) {
      expectStatus(await call(reviewPath, actor), 404, "review read role denial");
      expectStatus(await call(reviewPath, actor, "POST", reviewBody), 404, "review write role denial");
    }
    expectStatus(await call(reviewPath, owner, "POST", { ...reviewBody, reason: "short" }), 422, "review reason validation");
    expectStatus(await call(reviewPath, owner, "POST", { ...reviewBody, pairId: randomUUID() }), 404, "review scope denial");
    const list = expectStatus(await call(reviewPath, owner), 200, "review submitted comparison list");
    if (list.items.length !== 2 || list.nextCursor !== null || list.items.some(row => /evaluator|createdBy|reviewer|@/.test(JSON.stringify(row)))) throw new Error("Review list leaked evaluator identity");
    const oldFinal = JSON.stringify((await pool.query("SELECT input_json,output_json,input_hash FROM score_snapshot WHERE id=$1", [final.id])).rows[0]);
    const browser = await chromium.launch({ headless: true });
    let reviewId;
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
      const page = await context.newPage(); page.setDefaultTimeout(60000);
      await page.goto(`${origin}/full-system/assignments/${assignment}/reports`);
      await page.getByRole("tab", { name: "คุณภาพคำตอบ", exact: true }).click();
      await page.getByLabel("คำตอบที่จะทบทวน").selectOption(individualPair);
      await page.getByLabel("เหตุผลทบทวน (อย่างน้อย 10 ตัวอักษร)").fill(reviewBody.reason);
      await page.route("**/comparison-reviews", async route => {
        if (route.request().method() === "POST") await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ data: { status: "AUDIT_PENDING" } }) });
        else await route.continue();
      });
      await page.getByRole("button", { name: "ตัดคำตอบออกและคำนวณใหม่", exact: true }).click();
      await page.getByText("ยังรอยืนยันบันทึก audit โปรดโหลดข้อมูลใหม่ก่อนทำรายการซ้ำ", { exact: true }).waitFor();
      await page.unroute("**/comparison-reviews");
      const result = page.waitForResponse(r => r.url().endsWith("/comparison-reviews") && r.request().method() === "POST");
      await page.getByRole("button", { name: "ตัดคำตอบออกและคำนวณใหม่", exact: true }).click();
      const response = await result;
      if (response.status() !== 200) throw new Error("Browser comparison exclusion failed");
      reviewId = (await response.json()).data.reviewId;
      await page.getByText("บันทึกการทบทวนคำตอบและคำนวณ snapshot ใหม่แล้ว", { exact: true }).waitFor();
      if (process.env.PAIR_EVAL_REVIEW_SCREENSHOT) await page.screenshot({ path: process.env.PAIR_EVAL_REVIEW_SCREENSHOT, fullPage: true });
      await context.close();
    } finally { await browser.close(); }
    const excluded = expectStatus(await call(scorePath, owner), 200, "reviewed snapshot");
    const evaluator = excluded.output.students.find(row => row.id === students[2]);
    if (excluded.snapshotNo !== 4 || excluded.output.exclusions[0]?.pairId !== individualPair || evaluator.answered !== 1 || evaluator.assigned !== 1 || evaluator.M !== 1 || excluded.output.students.find(row => row.id === students[0]).individualComponent !== null) throw new Error("Exclusion or participation mismatch");
    if (process.env.PAIR_EVAL_EXPORT_KEY) {
      const raw = await call(`/api/full-system/assignments/${assignment}/exports/raw`, owner, "POST", { includeIdentities: false });
      expectStatus(raw, 200, "excluded raw answer export");
      const text = new TextDecoder().decode(raw.data);
      if (!text.includes(individualPair) || !text.includes("EXCLUDED") || !text.includes(reviewBody.reason)) throw new Error("Raw export silently removed excluded answer");
    }
    expectStatus(await call(reviewPath, owner, "POST", reviewBody), 409, "stale review conflict");
    const restored = expectStatus(await call(reviewPath, coTeacher, "POST", { ...reviewBody, excluded: false, expectedReviewId: reviewId, reason: "Synthetic comparison restored" }), 200, "co-teacher restoration");
    if (restored.snapshotNo !== 5) throw new Error("Restoration snapshot mismatch");
    const now = expectStatus(await call(scorePath, owner), 200, "restored snapshot");
    if (now.output.exclusions.length || now.output.students.find(row => row.id === students[0]).individualComponent === null || JSON.stringify((await pool.query("SELECT input_json,output_json,input_hash FROM score_snapshot WHERE id=$1", [final.id])).rows[0]) !== oldFinal) throw new Error("Review restoration rewrote history or score mismatch");
    if ((await pool.query("SELECT count(*)::integer AS n FROM comparison_review_decision WHERE pair_assignment_id=$1", [individualPair])).rows[0].n !== 2) throw new Error("Review history was not append-only");
    console.log(`${environment} FR-QS-02 smoke passed: owner browser exclusion, co-teacher restoration, atomic snapshots, participation unchanged, history retained and role/stale/Final denials`);
  }
  if (process.env.PAIR_EVAL_WITHDRAWAL_SMOKE) {
    const withdrawPath = user => `/api/full-system/classrooms/${room}/members/${user}/withdraw`;
    const body = version => ({ reason: "Synthetic withdrawal policy test", effectiveAt: new Date(Date.now() - 60000).toISOString(), expectedRosterVersion: version });
    const oldFinal = JSON.stringify((await pool.query("SELECT input_json,output_json,input_hash FROM score_snapshot WHERE id=$1", [final.id])).rows[0]);
    for (const actor of [outsider, students[0], ta, coTeacher]) expectStatus(await call(withdrawPath(students[6]), actor, "POST", body(0)), 404, "non-owner withdrawal denied");
    expectStatus(await call(withdrawPath(students[6]), owner, "POST", { ...body(0), reason: "short" }), 422, "withdrawal reason required");
    expectStatus(await call(withdrawPath(students[6]), owner, "POST", null), 422, "null withdrawal body rejected");
    expectStatus(await call(withdrawPath(students[6]), owner, "POST", body(-1)), 422, "negative roster version rejected");
    expectStatus(await call(withdrawPath(students[6]), owner, "POST", { ...body(0), effectiveAt: new Date(Date.now() + 86400000).toISOString() }), 409, "future withdrawal denied");
    expectStatus(await call(withdrawPath(students[6]), owner, "POST", body(999)), 409, "stale roster withdrawal denied");
    const noAuth = await fetch(`${origin}${withdrawPath(students[6])}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body(0)) });
    if (noAuth.status !== 401) throw new Error("Unauthenticated withdrawal not denied");
    const badOrigin = await fetch(`${origin}${withdrawPath(students[6])}`, { method: "POST", headers: { Origin: "https://outside.example.test", Cookie: `paireval_full_session=${tokens.get(owner)}`, "Content-Type": "application/json" }, body: JSON.stringify(body(0)) });
    if (badOrigin.status !== 403) throw new Error("Cross-origin withdrawal not denied");
    const withdrawn = expectStatus(await call(withdrawPath(students[6]), owner, "POST", body(0)), 200, "submitted evaluator withdrawal");
    if (withdrawn.rosterVersion !== 1 || withdrawn.assignments[0]?.snapshotNo !== (process.env.PAIR_EVAL_REVIEW_SMOKE ? 6 : 4)) throw new Error("Withdrawal did not recompute atomically");
    const current = expectStatus(await call(scorePath, owner), 200, "withdrawal snapshot");
    if (current.output.students.some(s => s.id === students[6]) || current.output.pairCoverage.some(p => p.pairId === groupPair)) throw new Error("Withdrawn evaluator appears in current score");
    expectStatus(await call(`/api/full-system/assignments/${assignment}/my-score`, students[6]), 404, "withdrawn My Score denied");
    expectStatus(await call(`/api/full-system/assignments/${assignment}/evaluation/group`, students[6]), 404, "withdrawn evaluation denied");
    if (expectStatus(await call(noticePath, students[6]), 200, "withdrawn notifications").length) throw new Error("Withdrawn student received current notifications");
    const retained = await pool.query(`SELECT count(*)::integer AS n FROM submission_answer WHERE pair_assignment_id=$1`, [groupPair]);
    if (retained.rows[0].n !== 1 || JSON.stringify((await pool.query("SELECT input_json,output_json,input_hash FROM score_snapshot WHERE id=$1", [final.id])).rows[0]) !== oldFinal) throw new Error("Withdrawal rewrote submitted history or Final snapshot");
    if (process.env.PAIR_EVAL_EXPORT_KEY) {
      const raw = await call(`/api/full-system/assignments/${assignment}/exports/raw`, owner, "POST", { includeIdentities: false });
      expectStatus(raw, 200, "withdrawal raw export");
      if (new TextDecoder().decode(raw.data).includes(groupPair)) throw new Error("Raw export retained withdrawn answer");
    }
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
      const page = await context.newPage(); page.setDefaultTimeout(60000); page.on("dialog", dialog => dialog.accept());
      await page.goto(`${origin}/full-system/classrooms/${room}/assignments`);
      await page.locator(".fs-roster-tools > summary").click();
      await page.getByRole("heading", { name: "เครื่องมือทดสอบข้อมูลตัวอย่าง", exact: true }).waitFor();
      await page.getByLabel("นักศึกษาที่จะถอน").selectOption(students[7]);
      await page.getByLabel("เหตุผลถอน", { exact: true }).fill("Synthetic pending evaluator withdrawal");
      const response = page.waitForResponse(r => r.url().endsWith(`/members/${students[7]}/withdraw`) && r.request().method() === "POST");
      await page.getByRole("button", { name: "ถอนสมาชิกข้อมูลตัวอย่าง", exact: true }).click();
      if ((await response).status() !== 200) throw new Error("Browser pending withdrawal failed");
      await page.getByText("ถอนสมาชิกข้อมูลตัวอย่างและบันทึกคะแนนปัจจุบันใหม่แล้ว", { exact: true }).waitFor();
      if (process.env.PAIR_EVAL_WITHDRAWAL_SCREENSHOT) await page.screenshot({ path: process.env.PAIR_EVAL_WITHDRAWAL_SCREENSHOT, fullPage: false });
      await context.close();
    } finally { await browser.close(); }
    expectStatus(await call(withdrawPath(students[6]), owner, "POST", body(2)), 409, "withdrawal cannot silently repeat");
    const beforeFailure = await pool.query("SELECT roster_version,(SELECT count(*) FROM score_snapshot WHERE assignment_id=$2) AS snapshots FROM classroom WHERE id=$1", [room, assignment]);
    expectStatus(await call(withdrawPath(students[8]), owner, "POST", body(2)), 409, "empty third group reassignment rolls back");
    const afterFailure = await pool.query("SELECT roster_version,(SELECT count(*) FROM score_snapshot WHERE assignment_id=$2) AS snapshots FROM classroom WHERE id=$1", [room, assignment]);
    if (JSON.stringify(beforeFailure.rows) !== JSON.stringify(afterFailure.rows) || (await pool.query("SELECT membership_status FROM classroom_member WHERE classroom_id=$1 AND user_id=$2", [room, students[8]])).rows[0].membership_status !== "ACTIVE") throw new Error("Infeasible withdrawal wrote partial changes");
    const extended = new Date(Date.now() + 86400000).toISOString();
    expectStatus(await call(`/api/full-system/assignments/${assignment}/deadlines`, owner, "PATCH", { groupDeadline: extended, individualDeadline: extended }), 200, "extend closed assignment before roster edit");
    await call(`/api/full-system/assignments/${assignment}/unpublish`, owner, "POST", { reason: "Synthetic withdrawal before republish" }).then(r => expectStatus(r, 200, "unpublish for roster guard"));
    const csv = ["email,group_name", ...students.map((_, i) => `day5-${i + 2}-${suffix}@example.test,G${Math.floor(i / 3)}`)].join("\n");
    const preview = expectStatus(await call(`/api/full-system/classrooms/${room}/roster/preview`, owner, "POST", { csv }), 200, "withdrawn roster preview");
    expectStatus(await call(`/api/full-system/classrooms/${room}/roster/import`, owner, "POST", { csv, expectedVersion: preview.version, confirmDigest: preview.digest }), 422, "CSV cannot reactivate withdrawn students");
    const race = await Promise.all([students[0], students[1]].map(s => call(withdrawPath(s), owner, "POST", body(2))));
    if (race.map(r => r.response.status).sort().join(",") !== "200,409") throw new Error("Concurrent withdrawal did not enforce roster version");
    const draftWithdrawal = expectStatus(await call(withdrawPath(students[3]), owner, "POST", body(3)), 200, "withdrawal before assignment publish");
    if (draftWithdrawal.assignments.length !== 0) throw new Error("Draft withdrawal unexpectedly changed snapshots");
    await pool.query("UPDATE assignment SET group_deadline_utc=now()+interval '1 day',individual_deadline_utc=now()+interval '1 day' WHERE id=$1", [assignment]);
    expectStatus(await call(`/api/full-system/assignments/${assignment}/publish`, owner, "POST", { seed: "withdrawal-republish" }), 200, "publish after withdrawal");
    const forbidden = await pool.query(`SELECT count(*)::integer AS n FROM pair_assignment p JOIN assignment a ON a.id=p.assignment_id WHERE p.assignment_id=$1 AND p.generation=a.generation AND
      (p.evaluator_user_id IN (SELECT user_id FROM classroom_member WHERE classroom_id=$2 AND membership_status='WITHDRAWN') OR p.student_a_id IN (SELECT user_id FROM classroom_member WHERE classroom_id=$2 AND membership_status='WITHDRAWN') OR p.student_b_id IN (SELECT user_id FROM classroom_member WHERE classroom_id=$2 AND membership_status='WITHDRAWN'))`, [assignment, room]);
    if (forbidden.rows[0].n) throw new Error("Republish assigned a withdrawn evaluator/item");
    console.log(`${environment} OQ-4 synthetic smoke passed: submitted/pending/draft withdrawal, Final/Reopen gate, history, atomic infeasibility rollback, CSV reinstatement denial, concurrent version and role/origin denial`);
  }
  console.log(`${environment} Day 5 score smoke passed: snapshot 1/2/3, override and immutable history,
    Finalize/Reopen, appeal, browser report, QS-02–04 and quality CSV, CSV BOM, 4-sheet XLSX, outsider/student/identity denials`);
} finally {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    await client.query("DELETE FROM appeal WHERE assignment_id=$1", [assignment]);
    await client.query(`DELETE FROM score_snapshot_item WHERE score_snapshot_id IN
      (SELECT id FROM score_snapshot WHERE assignment_id=$1)`, [assignment]);
    await client.query("DELETE FROM score_snapshot WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM score_override WHERE assignment_id=$1", [assignment]);
    await client.query(`DELETE FROM submission_answer WHERE revision_id IN
      (SELECT id FROM submission_revision WHERE assignment_id=$1)`, [assignment]);
    await client.query(`DELETE FROM evaluation_active_session WHERE pair_assignment_id IN
      (SELECT id FROM pair_assignment WHERE assignment_id=$1)`, [assignment]);
    await client.query("DELETE FROM submission_revision WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM evaluation_draft_answer WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM evaluation_draft WHERE assignment_id=$1", [assignment]);
    await client.query(`DELETE FROM comparison_review_decision WHERE pair_assignment_id IN
      (SELECT id FROM pair_assignment WHERE assignment_id=$1)`, [assignment]);
    await client.query("DELETE FROM pair_assignment WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM criterion WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM assignment_generation WHERE assignment_id=$1", [assignment]);
    await client.query("DELETE FROM assignment WHERE id=$1", [assignment]);
    await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM synthetic_quality_cohort WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM classroom WHERE id=$1", [room]);
    await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [users]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [users]);
    await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [users]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); console.error("Day 5 fixture cleanup failed", error); throw error; }
  finally { client.release(); await pool.end(); }
}
