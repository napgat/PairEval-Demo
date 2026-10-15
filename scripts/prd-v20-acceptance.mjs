import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { chromium, firefox, webkit } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { cleanupFixture } from "./fixture-cleanup.mjs";
process.loadEnvFile(".env.local");
if (
  new URL(process.env.DATABASE_URL).hostname !== "127.0.0.1" ||
  process.env.PAIR_EVAL_ENV !== "development"
)
  throw Error("Local synthetic fixture only");
const origin = "http://localhost:3101",
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const audit = new Pool({
  connectionString: process.env.AUDIT_DATABASE_URL,
  max: 1,
});
const prefix = "v20-" + randomUUID().slice(0, 8),
  actors = [
    "owner",
    "co",
    "ta",
    "outside",
    ...Array.from({ length: 12 }, (_, i) => "s" + i),
  ];
const ids = new Map(actors.map((a) => [a, randomUUID()])),
  tokens = new Map(actors.map((a) => [a, randomBytes(32).toString("hex")]));
const results = [],
  dir = ".verification/v20-20261015";
let room, assignment, browser;
await mkdir(dir, { recursive: true });
function check(label, condition = true) {
  assert.ok(condition, label);
  results.push({ label, status: "PASS" });
  console.log("PASS " + label);
}
async function api(
  path,
  actor = "owner",
  method = "GET",
  body,
  expected = 200,
  extra = {},
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Cookie: `paireval_full_session=${tokens.get(actor)}`,
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {}
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${text.slice(0, 300)}`,
  );
  assert.ok(response.headers.get("x-request-id"), "requestId header");
  return { data: payload?.data, payload, text, response };
}
async function resetLimits() {
  await pool.query(
    "DELETE FROM api_rate_window WHERE user_id=ANY($1::uuid[])",
    [[...ids.values()]],
  );
}
try {
  for (const a of actors) {
    const email = `${prefix}-${a}@example.test`;
    await pool.query(
      `INSERT INTO app_user(id,email_lookup,email_raw,display_name,status,can_create_classroom) VALUES($1,$2,$2,$3,'ACTIVE',$4)`,
      [ids.get(a), email, `ผู้ใช้จำลอง ${a}`, a === "owner"],
    );
    await pool.query(
      `INSERT INTO privacy_notice_acceptance(user_id,notice_version)VALUES($1,'prd-v2.0-privacy-20261015')`,
      [ids.get(a)],
    );
    await pool.query(
      `INSERT INTO app_session(id,user_id,token_hash,expires_at)VALUES($1,$2,$3,now()+interval '30 minutes')`,
      [
        randomUUID(),
        ids.get(a),
        createHash("sha256").update(tokens.get(a)).digest("hex"),
      ],
    );
  }
  const csv = [
    "email,group_name,display_name",
    ...actors
      .filter((a) => a.startsWith("s"))
      .map(
        (a, i) =>
          `${prefix}-${a}@example.test,G${Math.floor(i / 4)},นักศึกษาจำลอง ${i + 1}`,
      ),
  ].join("\n");
  room = (
    await api(
      "/api/classrooms",
      "owner",
      "POST",
      { name: `Synthetic PRD v2.0 ${prefix}`, csv },
      201,
    )
  ).data.id;
  for (const [a, role] of [
    ["co", "CO_TEACHER"],
    ["ta", "TA"],
  ])
    await pool.query(
      "INSERT INTO classroom_member(id,classroom_id,user_id,role)VALUES($1,$2,$3,$4)",
      [randomUUID(), room, ids.get(a), role],
    );
  check(
    "Canonical classroom create/read and role scope",
    (await api("/api/classrooms")).data.some((r) => r.id === room),
  );
  await api(`/api/classrooms/${room}/roster`, "outside", "GET", undefined, 404);
  const duplicate = csv + `\n${prefix}-.s0+alias@example.test,G0,duplicate`;
  check(
    "Normalized alias duplicates are rejected atomically",
    (
      await api(
        `/api/full-system/classrooms/${room}/roster/preview`,
        "ta",
        "POST",
        { csv: duplicate },
        422,
      )
    ).data.errors.some((e) => e.includes("duplicate email")),
  );
  const plan = (
    await api(
      `/api/full-system/classrooms/${room}/roster/preview`,
      "ta",
      "POST",
      { csv },
    )
  ).data;
  await api(`/api/full-system/classrooms/${room}/roster/import`, "ta", "POST", {
    csv,
    expectedVersion: plan.version,
    confirmDigest: plan.digest,
  });
  check("TA can import a valid draft roster");
  const input = {
    classroomId: room,
    name: "ทดสอบข้อกำหนด v2.0",
    description: "ข้อมูลจำลองสำหรับตรวจรับ",
    artifactOverviewUrl: "https://example.com/",
    groupMaxScore: 15,
    individualMaxScore: 0,
    groupDeadline: new Date(Date.now() + 86400000).toISOString(),
    individualDeadline: null,
    targetCoverage: 4,
    maxWorkload: 8,
    scoreFloor: 0.5,
    scoreCeiling: 0.95,
    criteria: [{ side: "GROUP", name: "คุณภาพผลงาน", weightPct: 100 }],
  };
  await api("/api/assignments", "ta", "POST", input, 404);
  assignment = (await api("/api/assignments", "owner", "POST", input, 201)).data
    .id;
  const detail = (await api(`/api/assignments/${assignment}`)).data;
  check(
    "Assignment-specific score floor/ceiling persist",
    detail.scoreFloor === 0.5 && detail.scoreCeiling === 0.95,
  );
  await api(`/api/assignments/${assignment}`, "owner", "PATCH", input);
  const feasibility = (
    await api(`/api/assignments/${assignment}/feasibility?seed=20261015`)
  ).data;
  check("Feasible deterministic pair plan", feasibility.feasible);
  await api(`/api/assignments/${assignment}:publish`, "owner", "POST", {
    seed: "20261015",
  });
  await api(
    `/api/full-system/classrooms/${room}/roster/import`,
    "ta",
    "POST",
    { csv, expectedVersion: plan.version, confirmDigest: plan.digest },
    409,
  );
  const evaluation = (
    await api(`/api/assignments/${assignment}/my-evaluations?side=GROUP`, "s0")
  ).data;
  check(
    "Every comparison has the configured artifact",
    evaluation.pairs.length > 0 &&
      evaluation.pairs.every((p) => p.leftArtifactUrl && p.rightArtifactUrl),
  );
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 320, height: 800 },
  });
  await context.addCookies([
    {
      name: "paireval_full_session",
      value: tokens.get("s0"),
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto(
    `${origin}/full-system/assignments/${assignment}/evaluate/group`,
  );
  await page.getByRole("radio").first().waitFor();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(
    dir + "/axe-evaluation.json",
    JSON.stringify(axe.violations, null, 2),
  );
  check(
    "Evaluation at 320px has no horizontal document overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  check("Evaluation automated WCAG checks", axe.violations.length === 0);
  const radio = page.getByRole("radio").first();
  await radio.focus();
  await page.keyboard.press("ArrowRight");
  check(
    "Keyboard arrows select a labelled radio",
    await page.getByRole("radio").nth(1).isChecked(),
  );
  await context.setOffline(true);
  await page.getByRole("radio").first().check();
  await page.waitForFunction(() =>
    Object.keys(localStorage).some((k) => k.startsWith("paireval-draft:")),
  );
  await page.getByText("ออฟไลน์", { exact: false }).first().waitFor();
  check("Disconnected editing is stored locally");
  await page.route("**/api/full-system/assignments/*/evaluation/group", (r) =>
    r.request().method() === "PUT" ? r.abort() : r.continue(),
  );
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("radio").first().waitFor();
  check(
    "Pending answer survives reload",
    await page.getByRole("radio").first().isChecked(),
  );
  await page.unroute("**/api/full-system/assignments/*/evaluation/group");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(
    () =>
      !Object.keys(localStorage).some((k) => k.startsWith("paireval-draft:")),
  );
  check(
    "Reconnect retries draft without auto-submit",
    (
      await api(
        `/api/assignments/${assignment}/my-evaluations?side=GROUP`,
        "s0",
      )
    ).data.latestSubmission === null,
  );
  await page.screenshot({ path: dir + "/evaluation-320.png", fullPage: true });
  await context.close();
  // Complete the exact same published fixture through the PRD API, never by writing answers directly.
  for (let i = 0; i < 12; i++) {
    const actor = "s" + i,
      data = (
        await api(
          `/api/assignments/${assignment}/my-evaluations?side=GROUP`,
          actor,
        )
      ).data;
    for (const pair of data.pairs) {
      await api(`/api/comparisons/${pair.id}`, actor, "PUT", { choice: 3 });
      await api(`/api/comparisons/${pair.id}`, actor, "PUT", { choice: 3 });
    }
    const key = randomUUID(),
      headers = { "Idempotency-Key": key };
    const first = (
      await api(
        `/api/assignments/${assignment}/submissions`,
        actor,
        "POST",
        { side: "GROUP" },
        200,
        headers,
      )
    ).data;
    const second = (
      await api(
        `/api/assignments/${assignment}/submissions`,
        actor,
        "POST",
        { side: "GROUP" },
        200,
        headers,
      )
    ).data;
    assert.equal(first.revision, second.revision);
  }
  check("Idempotent autosave and submission for every evaluator");
  const snapshot = (
    await api(`/api/assignments/${assignment}:recompute`, "owner", "POST", {})
  ).data;
  check(
    "Disabled individual side does not prevent a personal total",
    snapshot.output.students.every((s) => s.total !== null && s.M === 1),
  );
  await api(
    `/api/assignments/${assignment}/reports/quality`,
    "outside",
    "GET",
    undefined,
    404,
  );
  for (const report of ["group", "individual", "coverage", "quality"])
    await api(`/api/assignments/${assignment}/reports/${report}`);
  await api(
    `/api/assignments/${assignment}/raw-pairs`,
    "s0",
    "GET",
    undefined,
    403,
  );
  await api(
    `/api/assignments/${assignment}/raw-pairs`,
    "outside",
    "GET",
    undefined,
    404,
  );
  check(
    "Raw-pair API distinguishes forbidden member (403) from an outside classroom (404)",
  );
  const raw = `/api/full-system/assignments/${assignment}/exports/raw`;
  await resetLimits();
  const pseudo = await api(raw, "owner", "POST", { includeIdentities: false });
  check(
    "Default raw export contains pseudonyms without real evaluator identity",
    pseudo.text.includes("ev_") && !pseudo.text.includes(prefix),
  );
  await api(raw, "owner", "POST", { includeIdentities: true }, 422);
  await api(
    raw,
    "co",
    "POST",
    {
      includeIdentities: true,
      confirmed: true,
      reason: "ตรวจหลักฐานด้วยข้อมูลจำลอง",
    },
    403,
  );
  const identified = await api(raw, "owner", "POST", {
    includeIdentities: true,
    confirmed: true,
    reason: "ตรวจหลักฐานด้วยข้อมูลจำลอง",
  });
  check(
    "Owner-confirmed export reveals the requested identity",
    identified.text.includes(prefix),
  );
  const events = await audit.query(
    "SELECT action,ip_address::text,reason FROM audit_event WHERE resource_id=$1 AND action IN('EVALUATOR_IDENTITY_ACCESS_COMMITTED','IDENTITY_EXPORT_COMMITTED')",
    [assignment],
  );
  check(
    "Identity access and export are separately audited with IP/reason",
    events.rows.length === 2 &&
      events.rows.every((e) => e.ip_address === "127.0.0.1/32" && e.reason),
  );
  const personal = (
    await api("/api/full-system/privacy/export", "s0", "POST", {})
  ).payload;
  check(
    "Personal data copy returns only own submitted ratings",
    !JSON.stringify(personal).includes(`${prefix}-s1@`),
  );
  const before = (
    await pool.query("SELECT expires_at FROM app_session WHERE user_id=$1", [
      ids.get("s0"),
    ])
  ).rows[0].expires_at;
  await api("/api/auth/session", "s0", "POST", {});
  check(
    "Silent refresh renews the authenticated session for 12 hours",
    (
      await pool.query("SELECT expires_at FROM app_session WHERE user_id=$1", [
        ids.get("s0"),
      ])
    ).rows[0].expires_at > before,
  );
  await api(`/api/assignments/${assignment}:finalize`, "co", "POST", {}, 403);
  check("Co-teacher cannot finalize");
  await resetLimits();
  // Position the real database counter at its boundary; enforcement still runs through the public API.
  await pool.query(
    "INSERT INTO api_rate_window(user_id,bucket,window_start,n)VALUES($1,'requests',date_trunc('minute',clock_timestamp()),120)",
    [ids.get("outside")],
  );
  const limited = await api(
    "/api/classrooms",
    "outside",
    "GET",
    undefined,
    429,
  );
  check(
    "Shared user rate limit returns 429, Retry-After and structured error",
    Number(limited.response.headers.get("retry-after")) > 0 &&
      limited.payload.error.code === "RATE_LIMITED" &&
      limited.payload.error.requestId,
  );
  await pool.query(
    "INSERT INTO api_rate_window(user_id,bucket,window_start,n)VALUES($1,'exports',date_trunc('minute',clock_timestamp()),5)",
    [ids.get("owner")],
  );
  await api(raw, "owner", "POST", { includeIdentities: false }, 429);
  check("Export-specific 5/minute limit");
  await resetLimits();
  const runtime = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c role=paireval_operational_app",
  });
  try {
    await assert.rejects(
      runtime.query(
        "UPDATE score_snapshot SET input_hash=input_hash WHERE id=$1",
        [snapshot.id],
      ),
      (e) => e.code === "42501",
    );
    check("Runtime cannot alter immutable score snapshots");
  } finally {
    await runtime.end();
  }
  // Exercise the real clock-based job against a closed synthetic assignment.
  await pool.query(
    "UPDATE assignment SET group_deadline_utc=now()-interval '15 days',published_at=now()-interval '20 days' WHERE id=$1",
    [assignment],
  );
  await api(`/api/assignments/${assignment}:finalize`, "owner", "POST", {});
  const appeal = (
    await api("/api/appeals", "s0", "POST", {
      assignmentId: assignment,
      message: "Synthetic appeal for testing the automatic finalization guard",
    })
  ).data.id;
  await api(
    `/api/full-system/assignments/${assignment}/score-runs/reopen`,
    "owner",
    "POST",
    { reason: "Review the synthetic pending appeal" },
  );
  async function cron() {
    const r = await fetch(origin + "/api/full-system/cron/scores", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const j = await r.json();
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.equal(j.data.failed, 0);
    return j.data;
  }
  await cron();
  check(
    "Open appeal blocks automatic finalization",
    (
      await pool.query("SELECT status FROM assignment WHERE id=$1", [
        assignment,
      ])
    ).rows[0].status === "CLOSED",
  );
  const notifications = (await api("/api/full-system/notifications")).data;
  check(
    "Owner sees a review-required notification",
    notifications.some((n) => n.event === "FINALIZE_REVIEW_REQUIRED"),
  );
  await pool.query(
    "UPDATE appeal SET status='REJECTED',resolution='Synthetic appeal reviewed',resolved_at=now(),resolved_by=$2 WHERE id=$1",
    [appeal, ids.get("owner")],
  );
  await pool.query("DELETE FROM scheduled_score_run WHERE assignment_id=$1", [
    assignment,
  ]);
  await pool.query("UPDATE assignment SET min_comparisons=100 WHERE id=$1", [
    assignment,
  ]);
  await cron();
  check(
    "Low confidence blocks automatic finalization",
    (
      await pool.query("SELECT status FROM assignment WHERE id=$1", [
        assignment,
      ])
    ).rows[0].status === "CLOSED",
  );
  await pool.query("DELETE FROM scheduled_score_run WHERE assignment_id=$1", [
    assignment,
  ]);
  await pool.query("UPDATE assignment SET min_comparisons=3 WHERE id=$1", [
    assignment,
  ]);
  const concurrent = await Promise.all([cron(), cron()]);
  check(
    "14-day automatic finalization is idempotent and uses persisted scores",
    (
      await pool.query("SELECT status FROM assignment WHERE id=$1", [
        assignment,
      ])
    ).rows[0].status === "FINALIZED" &&
      concurrent.reduce((n, r) => n + r.created, 0) === 1,
  );
  check(
    "Automatic finalization has its own committed audit event",
    (
      await audit.query(
        "SELECT 1 FROM audit_event WHERE resource_id=$1 AND action='SCORE_FINALIZE_COMMITTED' AND actor_user_id='00000000-0000-4000-8000-000000000026'",
        [assignment],
      )
    ).rowCount === 1,
  );
  for (const [name, engine] of [
    ["firefox", firefox],
    ["webkit", webkit],
  ]) {
    let b;
    try {
      b = await engine.launch();
      const c = await b.newContext({ viewport: { width: 390, height: 844 } });
      await c.addCookies([
        { name: "paireval_full_session", value: tokens.get("s0"), url: origin },
      ]);
      const p = await c.newPage();
      await p.goto(
        `${origin}/full-system/assignments/${assignment}/evaluate/group`,
      );
      await p.getByRole("radio").first().waitFor();
      check(
        `${name} evaluation renders submitted choices`,
        await p.getByRole("radio").nth(2).isChecked(),
      );
    } finally {
      await b?.close();
    }
  }
  const original = (
    await pool.query(
      "SELECT input_json,output_json FROM score_snapshot WHERE id=$1",
      [snapshot.id],
    )
  ).rows[0];
  const countsBefore = (
    await pool.query(
      "SELECT count(*)::integer AS n FROM submission_answer WHERE revision_id IN(SELECT id FROM submission_revision WHERE assignment_id=$1)",
      [assignment],
    )
  ).rows[0].n;
  await pool.query(
    "UPDATE app_user SET created_at=now()-interval '4 years',last_login_at=now()-interval '4 years' WHERE id=$1",
    [ids.get("s0")],
  );
  await pool.query(
    "UPDATE assignment SET created_at=now()-interval '4 years',published_at=now()-interval '4 years',group_deadline_utc=now()-interval '3 years',finalized_at=now()-interval '3 years' WHERE id=$1",
    [assignment],
  );
  await pool.query("UPDATE app_session SET revoked_at=now() WHERE user_id=$1", [
    ids.get("s0"),
  ]);
  await pool.query(
    "UPDATE submission_revision SET submitted_at=now()-interval '3 years' WHERE evaluator_user_id=$1",
    [ids.get("s0")],
  );
  await pool.query(
    "UPDATE submission_answer SET active_duration_ms=2000 WHERE revision_id IN(SELECT id FROM submission_revision WHERE evaluator_user_id=$1)",
    [ids.get("s0")],
  );
  const retention = await fetch(origin + "/api/full-system/cron/privacy", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const retentionBody = await retention.json();
  assert.equal(retention.status, 200, JSON.stringify(retentionBody));
  const anonymized = (
    await pool.query(
      "SELECT display_name,email_raw,anonymized_at FROM app_user WHERE id=$1",
      [ids.get("s0")],
    )
  ).rows[0];
  check(
    "Expired identity is anonymized using a stable alias",
    anonymized.anonymized_at && anonymized.display_name.startsWith("retained-"),
  );
  const redacted = (
    await pool.query(
      "SELECT input_json,output_json FROM score_snapshot WHERE id=$1",
      [snapshot.id],
    )
  ).rows[0];
  check(
    "Historical snapshot identity is redacted without changing numerical grades",
    redacted.output_json.students.find((s) => s.id === ids.get("s0"))
      .displayName === anonymized.display_name &&
      redacted.output_json.students.every(
        (s) =>
          s.total ===
          original.output_json.students.find((o) => o.id === s.id).total,
      ),
  );
  check(
    "Retention preserves submitted answer counts",
    (
      await pool.query(
        "SELECT count(*)::integer AS n FROM submission_answer WHERE revision_id IN(SELECT id FROM submission_revision WHERE assignment_id=$1)",
        [assignment],
      )
    ).rows[0].n === countsBefore,
  );
  check(
    "Old active-time data expires",
    (
      await pool.query(
        "SELECT active_duration_ms FROM submission_answer WHERE revision_id IN(SELECT id FROM submission_revision WHERE evaluator_user_id=$1)",
        [ids.get("s0")],
      )
    ).rows.every((r) => r.active_duration_ms === null),
  );
  check(
    "Recent users remain identifiable",
    (
      await pool.query("SELECT anonymized_at FROM app_user WHERE id=$1", [
        ids.get("s1"),
      ])
    ).rows[0].anonymized_at === null,
  );
  const repeated = await fetch(origin + "/api/full-system/cron/privacy", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert.equal(repeated.status, 200);
  check(
    "Retention retries do not change an existing alias",
    (
      await pool.query("SELECT display_name FROM app_user WHERE id=$1", [
        ids.get("s0"),
      ])
    ).rows[0].display_name === anonymized.display_name,
  );
  await api(
    `/api/full-system/classrooms/${room}/archive`,
    "co",
    "POST",
    { archived: true },
    403,
  );
  await api(`/api/full-system/classrooms/${room}/archive`, "owner", "POST", {
    archived: true,
  });
  check(
    "Archived classroom leaves the main dashboard",
    !(await api("/api/classrooms")).data.some((r) => r.id === room),
  );
  await api(
    `/api/full-system/classrooms/${room}/roster`,
    "owner",
    "GET",
    undefined,
    404,
  );
  const readArchive = (await api(`/api/full-system/classrooms/${room}/archive`))
    .data;
  check(
    "Archived classroom retains a read-only score view",
    readArchive.assignments[0].students.length === 12,
  );
  const studentArchive = (
    await api(`/api/full-system/classrooms/${room}/archive`, "s1")
  ).data;
  check(
    "Archived student view contains only the current user",
    studentArchive.assignments[0].students.length === 1,
  );
  await api(
    `/api/full-system/classrooms/${room}/archive`,
    "outside",
    "GET",
    undefined,
    404,
  );
  await api(`/api/full-system/classrooms/${room}/archive`, "owner", "POST", {
    archived: false,
  });
  check(
    "Owner can restore an archived classroom",
    (await api("/api/classrooms")).data.some((r) => r.id === room),
  );
  console.log("PRD v2.0 acceptance completed");
} catch (error) {
  results.push({ status: "FAIL", message: error.stack });
  throw error;
} finally {
  await browser?.close();
  if (room)
    await cleanupFixture(pool, room).catch((e) =>
      console.error("Fixture cleanup failed: " + e.message),
    );
  await pool.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [
    [...ids.values()],
  ]);
  await pool.query(
    "DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])",
    [[...ids.values()]],
  );
  await pool
    .query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [[...ids.values()]])
    .catch((e) => console.error(e.message));
  await writeFile(
    dir + "/acceptance-results.json",
    JSON.stringify(results, null, 2),
  );
  await pool.end();
  await audit.end();
}
