import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";

const environment = process.argv[2] ?? "development";
if (!["development", "staging"].includes(environment)) throw new Error("Synthetic environments only");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) throw new Error("Database guard failed");
const origin = process.env.PAIR_EVAL_QUALITY_ORIGIN ?? (environment === "development" ?
  "http://localhost:3101" : "https://paireval-full-staging.vercel.app");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 30000 });
const room = randomUUID(), assignment = randomUUID(), generation = randomUUID(), owner = randomUUID(), outsider = randomUUID();
const students = Array.from({ length: 14 }, () => randomUUID()), users = [owner, outsider, ...students];
const groups = Array.from({ length: 4 }, () => randomUUID()).sort(), criteria = [randomUUID(), randomUUID()];
const suffix = randomUUID().slice(0, 8), tokens = new Map(users.map(id => [id, randomBytes(32).toString("hex")]));
const votes = [], tester = students[10], timingPair = randomUUID();
let created = false;
async function call(path, actor, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, { method, headers: {
    Cookie: `paireval_full_session=${tokens.get(actor)}`, ...(method === "GET" ? {} : { Origin: origin }),
    ...(method === "POST" && /\/evaluation\/(group|individual)$/.test(path) ? { "Idempotency-Key": randomUUID() } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = response.headers.get("content-type")?.includes("application/json");
  const data = json ? await response.json() : await response.arrayBuffer();
  return { status: response.status, data };
}
function expect(result, status, label) {
  if (result.status !== status) throw new Error(`${label}: expected ${status}, received ${result.status} ${result.data?.error?.code ?? ""}`);
  return result.data?.data;
}
const evaluation = side => `/api/full-system/assignments/${assignment}/evaluation/${side}`;
const timing = `${evaluation("group")}/timing`, score = `/api/full-system/assignments/${assignment}/score-runs`;
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [i, id] of users.entries()) {
      const email = `qs567-${suffix}-${i}@example.test`;
      await client.query(`INSERT INTO app_user(id,email_lookup,email_raw,display_name,status)
        VALUES ($1,$2,$2,$3,'ACTIVE')`, [id, email, `Synthetic QS ${i}`]);
      await client.query("INSERT INTO privacy_notice_acceptance(user_id,notice_version) VALUES ($1,'synthetic-staging-v1')", [id]);
      await client.query(`INSERT INTO app_session(id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '30 minutes')`,
        [randomUUID(), id, createHash("sha256").update(tokens.get(id)).digest("hex")]);
    }
    await client.query("INSERT INTO classroom(id,name,slug,created_by) VALUES ($1,$2,$3,$4)", [room, `Synthetic QS ${suffix}`, `qs567-${suffix}`, owner]);
    await client.query("INSERT INTO classroom_member(id,classroom_id,user_id,role) VALUES ($1,$2,$3,'OWNER')", [randomUUID(), room, owner]);
    for (const [i, id] of groups.entries()) await client.query("INSERT INTO group_entity(id,classroom_id,name) VALUES ($1,$2,$3)", [id, room, `G${i}`]);
    for (const [i, id] of students.entries()) await client.query(`INSERT INTO classroom_member(id,classroom_id,user_id,role,group_id)
      VALUES ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), room, id, groups[i < 11 ? 0 : i - 10]]);
    await client.query(`INSERT INTO assignment(id,classroom_id,name,slug,group_max_score,individual_max_score,
      group_deadline_utc,individual_deadline_utc,generation,status,created_by)
      VALUES ($1,$2,'Synthetic quality integration','quality-integration',15,5,now()+interval '1 day',now()+interval '1 day',1,'OPEN',$3)`, [assignment, room, owner]);
    await client.query("INSERT INTO assignment_generation(id,assignment_id,generation,seed,status) VALUES ($1,$2,1,'qs567-explicit-fixture','ACTIVE')", [generation, assignment]);
    await client.query(`INSERT INTO criterion(id,assignment_id,side,name,weight_pct,display_order)
      VALUES ($1,$3,'GROUP','Group quality',100,0),($2,$3,'INDIVIDUAL','Individual quality',100,0)`, [...criteria, assignment]);
    await client.query("INSERT INTO synthetic_quality_cohort(classroom_id,provenance) VALUES ($1,'Explicit QS05–07 integration fixture; no real users')", [room]);
    await client.query(`INSERT INTO synthetic_close_friend(classroom_id,evaluator_user_id,friend_user_id,provenance)
      VALUES ($1,$2,$3,'Declared synthetic friend for statistical fixture')`, [room, students[0], students[6]]);
    // Independent reference raters score exactly the same three friend/opponent pairs.
    for (let r = 0; r < 6; r++) for (let j = 7; j < 10; j++) {
      const [a, b] = [students[6], students[j]].sort(), id = randomUUID(), left = r % 2 ? "B" : "A";
      const friendCredit = r === 0 ? 1 : [0, .2, .2, .4, .4][r - 1];
      const aCredit = a === students[6] ? friendCredit : 1 - friendCredit;
      const choice = Math.round(left === "A" ? 6 - aCredit * 5 : 1 + aCredit * 5);
      await client.query(`INSERT INTO pair_assignment(id,assignment_id,criterion_id,side,student_a_id,student_b_id,evaluator_user_id,display_left,generation)
        VALUES ($1,$2,$3,'INDIVIDUAL',$4,$5,$6,$7,1)`, [id, assignment, criteria[1], a, b, students[r], left]);
      votes.push({ id, evaluator: students[r], side: "INDIVIDUAL", choice });
    }
    const ranks = [[1, 2, 3], [2, 3, 1], [3, 1, 2]];
    for (let r = 0; r < 3; r++) for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
      const id = randomUUID(), left = r % 2 ? "B" : "A", aWins = ranks[r][a] < ranks[r][b];
      await client.query(`INSERT INTO pair_assignment(id,assignment_id,criterion_id,side,group_a_id,group_b_id,evaluator_user_id,display_left,generation)
        VALUES ($1,$2,$3,'GROUP',$4,$5,$6,$7,1)`, [id, assignment, criteria[0], groups[a + 1], groups[b + 1], students[r], left]);
      votes.push({ id, evaluator: students[r], side: "GROUP", choice: aWins === (left === "A") ? 1 : 6 });
    }
    await client.query(`INSERT INTO pair_assignment(id,assignment_id,criterion_id,side,group_a_id,group_b_id,evaluator_user_id,display_left,generation)
      VALUES ($1,$2,$3,'GROUP',$4,$5,$6,'A',1)`, [timingPair, assignment, criteria[0], groups[1], groups[2], tester]);
    // Submitted statistical fixtures have explicit, synthetic durations. The tester uses the browser recorder instead.
    for (const evaluator of students.slice(0, 6)) for (const side of ["GROUP", "INDIVIDUAL"]) {
      const rows = votes.filter(v => v.evaluator === evaluator && v.side === side); if (!rows.length) continue;
      const revision = randomUUID();
      await client.query(`INSERT INTO submission_revision(id,assignment_id,evaluator_user_id,side,generation,revision_number)
        VALUES ($1,$2,$3,$4,1,1)`, [revision, assignment, evaluator, side]);
      for (const row of rows) await client.query("INSERT INTO submission_answer(revision_id,pair_assignment_id,choice,active_duration_ms) VALUES ($1,$2,$3,2000)", [revision, row.id, row.choice]);
    }
    await client.query("COMMIT"); created = true;
    console.log(`${environment} explicit synthetic QS fixture created`);
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; } finally { client.release(); }

  expect(await call(timing, owner, "POST", { pairId: timingPair }), 404, "owner timing denied");
  expect(await call(timing, outsider, "POST", { pairId: timingPair }), 404, "outsider timing denied");
  expect(await call(timing, students[0], "POST", { pairId: timingPair }), 404, "foreign pair denied");
  // PRD v2.0 timing is available after the privacy notice, independently of synthetic friend fixtures.
  await pool.query("DELETE FROM synthetic_close_friend WHERE classroom_id=$1", [room]);
  await pool.query("DELETE FROM synthetic_quality_cohort WHERE classroom_id=$1", [room]);
  const normalLease = expect(await call(timing, tester, "POST", { pairId: timingPair }), 200, "timing does not require synthetic cohort enrollment");
  expect(await call(timing, tester, "PUT", { pairId: timingPair, leaseId: normalLease.leaseId, sequence: 1, deltaMs: 0, close: true }), 200, "close general timing probe");
  await pool.query("INSERT INTO synthetic_quality_cohort(classroom_id,provenance) VALUES ($1,'Explicit synthetic integration fixture restored')", [room]);
  await pool.query("INSERT INTO synthetic_close_friend(classroom_id,evaluator_user_id,friend_user_id,provenance) VALUES ($1,$2,$3,'Declared synthetic friendship restored')", [room, students[0], students[6]]);
  const lease = expect(await call(timing, tester, "POST", { pairId: timingPair }), 200, "timing start");
  const packet = { pairId: timingPair, leaseId: lease.leaseId, sequence: 1, deltaMs: 0, close: true };
  expect(await call(timing, tester, "PUT", { ...packet, deltaMs: 5001 }), 422, "bounded delta");
  expect(await call(timing, tester, "PUT", { ...packet, sequence: 2 }), 409, "sequence gap");
  expect(await call(timing, tester, "PUT", { ...packet, leaseId: randomUUID() }), 404, "foreign lease");
  expect(await call(timing, tester, "PUT", packet), 200, "close lease");
  if (!expect(await call(timing, tester, "PUT", packet), 200, "replay packet").replayed) throw new Error("Timing replay not idempotent");
  expect(await call(timing, tester, "PUT", { ...packet, sequence: 2 }), 409, "closed lease immutable");
  console.log(`${environment} timing access, enrollment, bounds and replay checks passed`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "paireval_full_session", value: tokens.get(tester), url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(60000); page.on("dialog", d => d.accept());
    await page.goto(`${origin}/full-system/assignments/${assignment}/evaluate/group`);
    const field = page.locator(`fieldset[data-pair-id="${timingPair}"]`);
    await field.scrollIntoViewIfNeeded(); await page.bringToFront(); await field.hover();
    // Wait for real recorder events, not fabricated duration or timestamp subtraction.
    await page.waitForResponse(r => r.url().endsWith("/timing") && r.request().method() === "PUT" && r.status() === 200);
    await page.waitForResponse(r => r.url().endsWith("/timing") && r.request().method() === "PUT" && r.status() === 200);
    await field.getByRole("radio").first().check();
    await page.getByRole("button", { name: "ยืนยันส่งคำตอบ", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยันส่งคำตอบ", exact: true }).click();
    await page.getByText("ส่งคำตอบรุ่น 1 แล้ว (1/1)", { exact: true }).waitFor();
    await context.close();
    const stored = (await pool.query(`SELECT sa.active_duration_ms FROM submission_answer sa JOIN submission_revision r ON r.id=sa.revision_id
      WHERE r.assignment_id=$1 AND r.evaluator_user_id=$2`, [assignment, tester])).rows[0];
    if (!Number.isInteger(stored?.active_duration_ms) || stored.active_duration_ms <= 0) throw new Error("Browser active duration not frozen in submission");

    const snapshot = expect(await call(score, owner, "POST", { kind: "INTERIM" }), 200, "quality snapshot");
    const quality = snapshot.output.quality;
    const z = quality.measures.find(v => v.id === "QS-06" && v.reason === "MATCHED_REFERENCE_COHORT");
    const w = quality.measures.find(v => v.id === "QS-07" && v.reason === "COMPLETE_COMMON_PANEL" && v.side === "GROUP");
    const timed = quality.measures.filter(v => v.id === "QS-05" && v.reason === "COMPLETE_ACTIVE_DURATION");
    if (!z?.flagged || Math.abs(z.ratio - .76 / Math.sqrt(.028)) > 1e-10 || z.count !== 3 || z.total !== 5 ||
        w?.ratio !== 0 || !w.flagged || w.count !== 3 || w.total !== 3 || timed.length !== 10) throw new Error("QS05–07 statistical snapshot mismatch");
    if (students.some(id => JSON.stringify(quality).includes(id))) throw new Error("Quality leaked evaluator/friend identity");
    const exportPath = `/api/full-system/assignments/${assignment}/exports`;
    expect(await call(exportPath, tester, "POST", { format: "csv", report: "quality" }), 404, "student quality export denied");
    for (const format of ["csv", "xlsx"]) {
      const result = await call(exportPath, owner, "POST", { format, report: "quality" }); expect(result, 200, `${format} quality`);
      let text, signalEvidence;
      if (format === "csv") {
        text = new TextDecoder().decode(result.data);
        signalEvidence = text.split("\n").filter(row => /QS-0[5-7]/.test(row)).join("\n");
      } else {
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(result.data)); text = JSON.stringify(book.model);
        const rows = []; book.getWorksheet("Metadata").eachRow(row => {
          if (/^QS-0[5-7]$/.test(String(row.getCell(3).value))) rows.push(row.values);
        }); signalEvidence = JSON.stringify(rows);
      }
      for (const signal of ["QS-05", "QS-06", "QS-07", "MATCHED_REFERENCE_COHORT", "COMPLETE_COMMON_PANEL"]) if (!text.includes(signal)) throw new Error(`${format} missing ${signal}`);
      // Instructor summaries include scored item IDs/names. Check evaluator anonymity in signal evidence only.
      if (users.some(id => signalEvidence.includes(id)) || signalEvidence.includes("@example.test")) throw new Error(`${format} signal evidence leaked evaluator identity`);
    }
    const reportContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await reportContext.addCookies([{ name: "paireval_full_session", value: tokens.get(owner), url: origin }]);
    const report = await reportContext.newPage(); report.setDefaultTimeout(60000);
    await report.goto(`${origin}/full-system/assignments/${assignment}/reports`);
    await report.getByRole("tab", { name: "คุณภาพคำตอบ", exact: true }).click();
    await report.getByText("สัญญาณคุณภาพ QS-02–07", { exact: true }).waitFor();
    for (const signal of ["QS-05", "QS-06", "QS-07"]) await report.getByRole("cell", { name: new RegExp(signal) }).first().waitFor();
    if (process.env.PAIR_EVAL_QUALITY_SCREENSHOT) await report.screenshot({ path: process.env.PAIR_EVAL_QUALITY_SCREENSHOT, fullPage: true });
    await reportContext.close();
    // A missing measurement is NA, and recomputation preserves previous immutable snapshots and score arithmetic.
    const previous = JSON.stringify((await pool.query("SELECT input_json,output_json,input_hash FROM score_snapshot WHERE id=$1", [snapshot.id])).rows[0]);
    expect(await call(timing, tester, "POST", { pairId: timingPair }), 200, "unacknowledged timing segment");
    expect(await call(evaluation("group"), tester, "POST"), 200, "submit with open timing segment");
    const second = expect(await call(score, owner, "POST", { kind: "INTERIM" }), 200, "missing timing recompute");
    if (!second.output.quality.measures.some(v => v.id === "QS-05" && v.reason === "INCOMPLETE_ACTIVE_DURATION" && v.ratio === null) ||
        JSON.stringify(second.output.groups) !== JSON.stringify(snapshot.output.groups) || JSON.stringify(second.output.students) !== JSON.stringify(snapshot.output.students) ||
        previous !== JSON.stringify((await pool.query("SELECT input_json,output_json,input_hash FROM score_snapshot WHERE id=$1", [snapshot.id])).rows[0])) throw new Error("NA quality changed score or historical snapshot");
    console.log(`${environment} QS05–07 smoke passed: browser active duration ${stored.active_duration_ms}ms; matched z=${z.ratio}; W=${w.ratio}; CSV/XLSX, NA, immutable history, score invariance and access/retry/bounds denials`);
  } finally { await browser.close(); }
} finally {
  if (created) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM scheduled_score_run WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM score_snapshot_item WHERE score_snapshot_id IN (SELECT id FROM score_snapshot WHERE assignment_id=$1)", [assignment]);
      await client.query("DELETE FROM score_snapshot WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM submission_answer WHERE revision_id IN (SELECT id FROM submission_revision WHERE assignment_id=$1)", [assignment]);
      for (const table of ["submission_revision", "evaluation_draft_answer", "evaluation_draft"]) await client.query(`DELETE FROM ${table} WHERE assignment_id=$1`, [assignment]);
      await client.query("DELETE FROM evaluation_active_session WHERE pair_assignment_id IN (SELECT id FROM pair_assignment WHERE assignment_id=$1)", [assignment]);
      for (const table of ["pair_assignment", "criterion", "assignment_generation"]) await client.query(`DELETE FROM ${table} WHERE assignment_id=$1`, [assignment]);
      await client.query("DELETE FROM assignment WHERE id=$1", [assignment]);
      for (const table of ["synthetic_close_friend", "synthetic_quality_cohort", "classroom_member", "group_entity"]) await client.query(`DELETE FROM ${table} WHERE classroom_id=$1`, [room]);
      await client.query("DELETE FROM classroom WHERE id=$1", [room]);
      for (const table of ["app_session", "privacy_notice_acceptance"]) await client.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])`, [users]);
      await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [users]);
      await client.query("COMMIT");
      console.log(`${environment} QS fixture cleanup passed`);
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; } finally { client.release(); }
  }
  await pool.end();
}
