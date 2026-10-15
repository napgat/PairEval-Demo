import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { chromium } from "@playwright/test";

const environment = process.argv[2] ?? "development";
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational environment guard failed");
}
const origin = environment === "development" ? "http://localhost:3101" : "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const suffix = randomUUID().slice(0, 8);
const ownerId = randomUUID(), outsiderId = randomUUID(), taId = randomUUID();
const studentIds = Array.from({ length: 12 }, () => randomUUID());
const userIds = [ownerId, outsiderId, ...studentIds, taId];
const roomId = randomUUID(), smallRoomId = randomUUID();
const roomIds = [roomId, smallRoomId];
const groups = Array.from({ length: 3 }, () => randomUUID());
const emptyHistoricalGroup = randomUUID();
const smallGroups = [randomUUID(), randomUUID()];
const token = randomBytes(32).toString("hex"), outsiderToken = randomBytes(32).toString("hex");
const studentToken = randomBytes(32).toString("hex");
const taToken = randomBytes(32).toString("hex");
const assignmentIds = [];

async function api(path, method = "GET", body, auth = token, idempotencyKey) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    Cookie: `paireval_full_session=${auth}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = (response.headers.get("content-type") ?? "").includes("application/json")
    ? await response.json() : null;
  return { status: response.status, payload };
}
function check(result, status, label) {
  if (result.status !== status) throw new Error(`${label}: expected ${status}, got ${result.status}, code=${result.payload?.error?.code ?? "none"}`);
  return result.payload?.data;
}
const input = (name, overrides = {}) => ({ name, description: "Synthetic assignment only",
  groupMaxScore: 10, individualMaxScore: 0,
  groupDeadline: "2030-12-01T16:59:00+07:00", individualDeadline: null,
  targetCoverage: 5, maxWorkload: 8,
  criteria: [{ side: "GROUP", name: "Clarity", weightPct: 50 },
    { side: "GROUP", name: "Evidence", weightPct: 50 }],
  artifacts: [{ side: "GROUP", itemId: groups[0], url: "https://example.test/group-a" },
    { side: "GROUP", itemId: groups[1], url: "https://example.test/group-b" }], ...overrides });

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < userIds.length; index++) {
      const email = `day3-${index}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [userIds[index], email, `Synthetic Day 3 ${index}`, index === 0]);
      if (index < 3) {
        await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
          VALUES ($1,'synthetic-staging-v1')`, [userIds[index]]);
        const value = index === 0 ? token : index === 1 ? outsiderToken : studentToken;
        await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
          VALUES ($1,$2,$3,now()+interval '15 minutes')`,
        [randomUUID(), userIds[index], createHash("sha256").update(value).digest("hex")]);
      }
    }
    await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
      VALUES ($1,'synthetic-staging-v1')`, [taId]);
    await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
      VALUES ($1,$2,$3,now()+interval '15 minutes')`,
    [randomUUID(), taId, createHash("sha256").update(taToken).digest("hex")]);
    for (const [index, id] of roomIds.entries()) {
      await client.query("INSERT INTO classroom (id,name,slug,created_by) VALUES ($1,$2,$3,$4)",
        [id, `Synthetic Day 3 ${index} ${suffix}`, `day3-${index}-${suffix}`, ownerId]);
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
        VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), id, ownerId]);
    }
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'TA')`, [randomUUID(), roomId, taId]);
    for (let index = 0; index < groups.length; index++) {
      await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,$3)",
        [groups[index], roomId, `G${index}`]);
    }
    await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,'Old empty group')",
      [emptyHistoricalGroup, roomId]);
    for (let index = 0; index < smallGroups.length; index++) {
      await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,$3)",
        [smallGroups[index], smallRoomId, `S${index}`]);
    }
    for (let index = 0; index < studentIds.length; index++) {
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
        VALUES ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), roomId, studentIds[index], groups[Math.floor(index / 4)]]);
      if (index < 8) await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
        VALUES ($1,$2,$3,'STUDENT',$4)`,
      [randomUUID(), smallRoomId, studentIds[index], smallGroups[Math.floor(index / 4)]]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }

  check(await api(`/api/full-system/classrooms/${roomId}/assignments`, "GET", undefined, outsiderToken), 404, "outsider list");
  const invalid = await api(`/api/full-system/classrooms/${roomId}/assignments`, "POST",
    input("Invalid weights", { criteria: [{ side: "GROUP", name: "Only", weightPct: 90 }] }));
  const draftId = check(invalid, 201, "draft accepts incomplete weights")?.id;
  assignmentIds.push(draftId);
  check(await api(`/api/full-system/assignments/${draftId}/feasibility?seed=7`), 422, "weights rejected before publish");
  check(await api(`/api/full-system/assignments/${draftId}`, "PUT", input("Feasible assignment")), 200, "replace draft");
  const preview = check(await api(`/api/full-system/assignments/${draftId}/feasibility?seed=7`), 200, "feasibility");
  if (!preview.feasible || preview.parts.length !== 2 || preview.parts.some(part => part.coverage !== 4)) {
    throw new Error("Unexpected feasibility/coverage for 3 x 4 fixture");
  }
  const published = check(await api(`/api/full-system/assignments/${draftId}/publish`, "POST", { seed: "7" }), 200, "publish");
  if (published.assignmentCount !== 24 || published.generation !== 1) throw new Error("Incorrect persisted pairing count");
  const opened = await pool.query(`SELECT event_type,count(*)::integer AS n FROM app_notification
    WHERE assignment_id=$1 GROUP BY event_type`, [draftId]);
  if (opened.rows.length !== 1 || opened.rows[0].event_type !== "ASSIGNMENT_PUBLISHED" ||
      opened.rows[0].n !== 12) throw new Error("Publish notification count mismatch");
  const first = await pool.query(`SELECT side,count(*)::integer AS n,
    count(*) FILTER (WHERE student_a_id IS NOT NULL)::integer AS individuals,
    count(*) FILTER (WHERE left_artifact_url IS NOT NULL OR right_artifact_url IS NOT NULL)::integer AS artifacts
    FROM pair_assignment WHERE assignment_id=$1 AND generation=1 GROUP BY side`, [draftId]);
  if (first.rows.length !== 1 || first.rows[0].n !== 24 || first.rows[0].individuals !== 0 || first.rows[0].artifacts < 1) {
    throw new Error("Database pairing/artifact count mismatch");
  }
  const studentPair = await pool.query(`SELECT id FROM pair_assignment WHERE assignment_id=$1
    AND generation=1 AND evaluator_user_id=$2 LIMIT 1`, [draftId, studentIds[0]]);
  if (!studentPair.rows[0]) throw new Error("Expected first student to receive a pair");
  check(await api(`/api/full-system/assignments/${draftId}/evaluation/group`, "PUT",
    { pairId: studentPair.rows[0].id, choice: 1 }, studentToken), 200, "old-generation draft");
  check(await api(`/api/full-system/assignments/${draftId}/evaluation/group`, "POST",
    undefined, studentToken, randomUUID()), 200, "old-generation submit");
  const changedCsv = ["email,group_name", ...studentIds.map((_, index) =>
    `day3-${index + 2}-${suffix}@example.test,${index === 0 ? "G1" : `G${Math.floor(index / 4)}`}`)].join("\n");
  const rosterPlan = check(await api(`/api/full-system/classrooms/${roomId}/roster/preview`,
    "POST", { csv: changedCsv }), 200, "group-change preview");
  if (rosterPlan.diff.moved !== 1 || rosterPlan.diff.added !== 0) throw new Error("Group-change diff mismatch");
  const rosterImport = { csv: changedCsv, expectedVersion: rosterPlan.version,
    confirmDigest: rosterPlan.digest };
  check(await api(`/api/full-system/classrooms/${roomId}/roster/import`, "POST",
    rosterImport, outsiderToken), 404, "outsider roster import denied");
  check(await api(`/api/full-system/classrooms/${roomId}/roster/import`, "POST",
    rosterImport, studentToken), 403, "student roster import denied");
  check(await api(`/api/full-system/classrooms/${roomId}/roster/import`, "POST",
    rosterImport, taToken), 409, "TA cannot change roster while an assignment is published");
  check(await api(`/api/full-system/classrooms/${roomId}/roster/import`, "POST",
    rosterImport), 409, "published roster change denied");
  const beforeMove = await pool.query(`SELECT m.group_id,c.roster_version FROM classroom_member m
    JOIN classroom c ON c.id=m.classroom_id WHERE m.classroom_id=$1 AND m.user_id=$2`,
  [roomId, studentIds[0]]);
  if (beforeMove.rows[0].group_id !== groups[0] || beforeMove.rows[0].roster_version !== rosterPlan.version) {
    throw new Error("Denied roster change wrote data");
  }
  check(await api(`/api/full-system/assignments/${draftId}/publish`, "POST", { seed: "7" }), 409, "duplicate publish");
  check(await api(`/api/full-system/assignments/${draftId}`, "PUT", input("Cannot edit open")), 409, "open edit denied");
  check(await api(`/api/full-system/assignments/${draftId}/unpublish`, "POST",
    { reason: "synthetic republish check" }), 200, "unpublish");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
    await context.addCookies([{ name: "paireval_full_session", value: token, url: origin }]);
    const page = await context.newPage();
    await page.goto(`${origin}/full-system/classrooms/${roomId}/assignments`);
    await page.getByRole("button", { name: /Feasible assignment/ }).filter({ hasText: "ฉบับร่าง" }).click();
    await page.locator(".fs-roster-tools > summary").click();
    await page.getByLabel("CSV รายชื่อ", { exact: true }).fill(changedCsv);
    await page.getByRole("button", { name: "ตรวจข้อมูลและดูการเปลี่ยนกลุ่ม", exact: true }).click();
    await page.getByText(/ย้ายกลุ่ม 1/).waitFor();
    const importResponse = page.waitForResponse(response => response.url().includes("/roster/import"),
      { timeout: 120000 });
    await page.getByRole("button", { name: "ยืนยันนำเข้ารายชื่อ" }).click();
    const result = await importResponse;
    if (result.status() !== 200) throw new Error(`Roster browser import HTTP ${result.status()}`);
    try { await page.getByText(/นำเข้ารายชื่อแล้ว/).waitFor({ timeout: 30000 }); }
    catch (error) {
      const notices = await page.locator(".notice,.error-box").allTextContents();
      throw new Error(`Roster browser import did not complete: ${notices.join(" | ")}`, { cause: error });
    }
    await context.close();
  } finally { await browser.close(); }
  const afterMove = await pool.query(`SELECT m.group_id,c.roster_version FROM classroom_member m
    JOIN classroom c ON c.id=m.classroom_id WHERE m.classroom_id=$1 AND m.user_id=$2`,
  [roomId, studentIds[0]]);
  if (afterMove.rows[0].group_id !== groups[1] || afterMove.rows[0].roster_version !== rosterPlan.version + 1) {
    throw new Error("Browser roster import did not move the student atomically");
  }
  check(await api(`/api/full-system/assignments/${draftId}`, "PUT", input("Republished assignment", {
    criteria: [{ side: "GROUP", name: "Combined", weightPct: 100 }] })), 200, "edit after unpublish");
  const reduced = check(await api(`/api/full-system/assignments/${draftId}/feasibility?seed=7`), 200,
    "reduced coverage preview");
  if (!reduced.feasible || reduced.parts[0].coverage !== 3 || reduced.parts[0].requested !== 5 ||
      !reduced.parts[0].reason?.includes("actual=3")) throw new Error("Numerical reduced coverage missing");
  const republished = check(await api(`/api/full-system/assignments/${draftId}/publish`, "POST", { seed: "7" }), 200, "republish");
  if (republished.assignmentCount !== 9 || republished.generation !== 2) throw new Error("Incorrect generation 2 count");
  const persisted = await pool.query(`SELECT count(*)::integer AS n,
    max(load)::integer AS peak, min(load)::integer AS low FROM (
      SELECT evaluator_user_id,count(*)::integer AS load FROM pair_assignment
      WHERE assignment_id=$1 AND generation=2 GROUP BY evaluator_user_id) x`, [draftId]);
  if (persisted.rows[0].n < 1 || persisted.rows[0].peak > 8 ||
      persisted.rows[0].peak - persisted.rows[0].low > 1) throw new Error("Persisted workload invalid");
  const pairCoverage = await pool.query(`SELECT group_a_id,group_b_id,count(*)::integer AS n
    FROM pair_assignment WHERE assignment_id=$1 AND generation=2
    GROUP BY group_a_id,group_b_id`, [draftId]);
  if (pairCoverage.rows.length !== 3 || pairCoverage.rows.some(row => row.n !== 3)) {
    throw new Error("Persisted reduced coverage differs from preview");
  }
  const currentScore = check(await api(`/api/full-system/assignments/${draftId}/my-score`,
    "GET", undefined, studentToken), 200, "current generation score");
  if (currentScore.groupComponent !== null || currentScore.answered !== 0) {
    throw new Error("Old-generation submission leaked into current score");
  }
  const historyAnswers = await pool.query(`SELECT count(*)::integer AS n FROM submission_revision
    WHERE assignment_id=$1 AND generation=1`, [draftId]);
  if (historyAnswers.rows[0].n !== 1) throw new Error("Old submission history was lost");
  const regenerated = await pool.query(`SELECT count(*)::integer AS n FROM app_notification
    WHERE assignment_id=$1 AND event_type='PAIRS_REGENERATED' AND generation=2`, [draftId]);
  if (regenerated.rows[0].n !== studentIds.length) throw new Error("Regeneration notification count mismatch");
  await pool.query("UPDATE assignment SET group_deadline_utc=now()+interval '24 hours' WHERE id=$1", [draftId]);
  const runReminders = process.env.CRON_SECRET ? async () => {
    const response = await fetch(`${origin}/api/full-system/cron/reminders`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const payload = await response.json();
    if (response.status !== 200) throw new Error(`Reminder cron returned ${response.status}`);
    return payload.data?.inserted;
  } : async () => {
    const output = execFileSync(process.execPath,
      ["scripts/day6-deadline-reminders.mjs", environment, draftId], { encoding: "utf8" });
    const match = output.match(/inserted=(\d+)/);
    if (!match) throw new Error(`Reminder script output missing inserted count: ${output}`);
    return Number(match[1]);
  };
  const firstReminder = await runReminders(), replayReminder = await runReminders();
  const expectedRecipients = await pool.query(`SELECT count(DISTINCT evaluator_user_id)::integer AS n
    FROM pair_assignment WHERE assignment_id=$1 AND generation=2`, [draftId]);
  const reminders = await pool.query(`SELECT count(*)::integer AS n FROM app_notification
    WHERE assignment_id=$1 AND event_type='DEADLINE_48H_GROUP'`, [draftId]);
  if (firstReminder !== expectedRecipients.rows[0].n || replayReminder !== 0 ||
      reminders.rows[0].n !== expectedRecipients.rows[0].n) {
    throw new Error("48-hour reminder retry was not idempotent");
  }
  const history = await pool.query(`SELECT generation,count(*)::integer AS n FROM pair_assignment
    WHERE assignment_id=$1 GROUP BY generation ORDER BY generation`, [draftId]);
  if (history.rows.length !== 2 || history.rows[0].n !== 24 || history.rows[1].n !== 9) {
    throw new Error("Pairing history was not preserved");
  }
  const clone = check(await api(`/api/full-system/assignments/${draftId}/clone`, "POST",
    { name: "Synthetic clone" }), 201, "clone");
  assignmentIds.push(clone.id);
  const cloned = check(await api(`/api/full-system/assignments/${clone.id}`), 200, "clone detail");
  if (cloned.status !== "DRAFT" || cloned.criteria.length !== 1 || cloned.artifacts.length !== 2) {
    throw new Error("Clone configuration mismatch");
  }
  const impossible = check(await api(`/api/full-system/classrooms/${smallRoomId}/assignments`, "POST",
    input("Two-group infeasible", { artifacts: [] })), 201, "infeasible draft");
  assignmentIds.push(impossible.id);
  const noPlan = check(await api(`/api/full-system/assignments/${impossible.id}/feasibility?seed=7`), 200, "infeasible preview");
  if (noPlan.feasible || noPlan.parts.some(part => part.coverage !== 0)) throw new Error("Two-group plan should be infeasible");
  check(await api(`/api/full-system/assignments/${impossible.id}/publish`, "POST", { seed: "7" }), 409, "infeasible publish");
  const unchanged = await pool.query(`SELECT status,generation,(SELECT count(*)::integer FROM pair_assignment
    WHERE assignment_id=$1) AS pairs FROM assignment WHERE id=$1`, [impossible.id]);
  if (unchanged.rows[0]?.status !== "DRAFT" || unchanged.rows[0].generation !== 0 || unchanged.rows[0].pairs !== 0) {
    throw new Error("Infeasible publish wrote partial state");
  }
  console.log(`${environment} Day 3 assignment smoke passed: draft/weights, feasible publish 24, no Individual,
    artifacts, group-change UI, reduced coverage 5→3, generation isolation 24+9,
    clone, infeasible rollback,
    publish/regenerate notifications and idempotent 48-hour reminders`);
} finally {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM submission_answer WHERE revision_id IN
      (SELECT id FROM submission_revision WHERE assignment_id=ANY($1::uuid[]))`, [assignmentIds]);
    await client.query("DELETE FROM submission_revision WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM evaluation_draft_answer WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM evaluation_draft WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM pair_assignment WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM assignment_generation WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM group_artifact WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM individual_artifact WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM criterion WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM assignment WHERE id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM classroom_member WHERE classroom_id=ANY($1::uuid[])", [roomIds]);
    await client.query("DELETE FROM group_entity WHERE classroom_id=ANY($1::uuid[])", [roomIds]);
    await client.query("DELETE FROM classroom WHERE id=ANY($1::uuid[])", [roomIds]);
    await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [userIds]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
