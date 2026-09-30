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
const users = [owner, outsider, ...students];
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
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), room, owner]);
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
      workbook.getWorksheet("Metadata").getCell("B5").value !== "v2.1") {
    throw new Error("XLSX 4-sheet metadata mismatch");
  }
  if (process.env.PAIR_EVAL_EXPORT_KEY) {
    const rawPath = `/api/full-system/assignments/${assignment}/exports/raw`;
    expectStatus(await call(rawPath, outsider, "POST", { includeIdentities: false }), 404,
      "outsider raw export denial");
    expectStatus(await call(rawPath, students[0], "POST", { includeIdentities: false }), 404,
      "student raw export denial");
    expectStatus(await call(rawPath, owner, "POST", { includeIdentities: true }), 409,
      "identity raw export denial");
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
    await page.getByText("รุ่น 2 · INTERIM").waitFor();
    await page.getByRole("tab", { name: "Individual Summary" }).click();
    await page.getByRole("columnheader", { name: "ส่ง/มอบหมาย" }).waitFor();
    await context.close();
  } finally { await browser.close(); }
  await pool.query(`UPDATE assignment SET group_deadline_utc=now()-interval '1 minute',
    individual_deadline_utc=now()-interval '1 minute' WHERE id=$1`, [assignment]);
  const final = expectStatus(await call(scorePath, owner, "POST", { kind: "FINAL" }), 200,
    "final snapshot");
  if (final.snapshotNo !== 3 || final.kind !== "FINAL") throw new Error("Finalize mismatch");
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
  console.log(`${environment} Day 5 score smoke passed: snapshot 1/2/3, override and immutable history,
    Finalize/Reopen, appeal, browser report, CSV BOM, 4-sheet XLSX, outsider/student/identity denials`);
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
  } catch (error) { await client.query("ROLLBACK"); console.error("Day 5 fixture cleanup failed", error); throw error; }
  finally { client.release(); await pool.end(); }
}
