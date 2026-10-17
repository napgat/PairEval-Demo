// Local synthetic mutation check. Keeps the existing presentation classroom unchanged.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { cleanupFixture } from "./fixture-cleanup.mjs";
process.loadEnvFile(".env.local");
assert.equal(process.env.PAIR_EVAL_ENV, "development");
for (const key of ["DATABASE_URL", "AUDIT_DATABASE_URL"]) assert.ok(["127.0.0.1", "localhost"].includes(new URL(process.env[key]).hostname), "Local databases only");
const state = JSON.parse(await readFile(".verification/v20-20261015/presentation-state.json", "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const audit = new Pool({ connectionString: process.env.AUDIT_DATABASE_URL });
const origin = "http://localhost:3101", dir = ".verification/staff-ui-20261017";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const errors = [], checks = [], scans = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
let room, disabled;
const mark = name => { checks.push(name); console.log("PASS " + name); };
async function enter(role) {
  await page.goto("http://localhost:3103");
  await page.locator("article").filter({ has: page.getByRole("heading", { name: role, exact: true }) }).getByRole("button").click();
  await page.waitForURL(origin + "/full-system");
}
async function api(path, method = "GET", data) {
  return page.request.fetch(origin + path, { method, headers: { Origin: origin }, ...(data === undefined ? {} : { data }) });
}
async function scan(name) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(result.violations.map(v => v.id), []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true }); scans.push(name);
}
async function add(email, role = "CO_TEACHER") {
  await page.getByLabel("อีเมลผู้สอนหรือผู้ช่วยสอน").fill(email);
  await page.getByLabel("บทบาท", { exact: true }).selectOption(role);
  await page.getByRole("button", { name: "เพิ่มสมาชิกผู้สอน", exact: true }).click();
}
try {
  assert.equal((await api("/api/full-system/classrooms/00000000-0000-4000-8000-000000000001/members")).status(), 401);
  await enter("อาจารย์เจ้าของห้อง");
  const created = await api("/api/full-system/classrooms", "POST", { name: "Synthetic staff UI " + randomUUID(), csv: "email,group_name,student_id,display_name\nv20-presentation-s0@example.test,A,S001,นักศึกษาคนที่ 1" });
  assert.equal(created.status(), 201); room = (await created.json()).data.id;
  const base = `/api/full-system/classrooms/${room}/members`, canonical = `/api/classrooms/${room}/members`;
  assert.equal((await page.request.post(origin + base, { headers: { Origin: origin, "Content-Type": "application/json" }, data: Buffer.from("{") })).status(), 400);
  const roster = origin + `/full-system/classrooms/${room}/roster`;
  await page.goto(roster); await expect(page.getByRole("heading", { name: "ทีมผู้สอน", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "v20-presentation-owner@example.test", exact: true })).toBeVisible();
  await scan("owner-desktop");
  await add("v20-presentation-co@example.test");
  await expect(page.getByRole("status").filter({ hasText: "เพิ่มสมาชิกผู้สอนแล้ว" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "v20-presentation-co@example.test", exact: true })).toBeVisible();
  const before = (await pool.query("SELECT id,joined_at FROM classroom_member WHERE classroom_id=$1 AND user_id=$2", [room, state.users.co.id])).rows[0];
  await add("v20-presentation-ta@example.test", "TA");
  await expect(page.getByRole("cell", { name: "v20-presentation-ta@example.test", exact: true })).toBeVisible();
  assert.equal((await api(canonical)).status(), 200); mark("GUI adds Co-teacher and TA; canonical list works");
  await add("v20-presentation-co@example.test"); await expect(page.getByRole("region", { name: "ทีมผู้สอน" }).getByRole("alert")).toContainText("บัญชีนี้มีบทบาท");
  await add("unknown-staff@example.test"); await expect(page.getByRole("region", { name: "ทีมผู้สอน" }).getByRole("alert")).toContainText("ไม่พบบัญชีที่ใช้งานได้");
  disabled = randomUUID();
  const disabledEmail = `v20-disabled-${disabled}@example.test`;
  await pool.query("INSERT INTO app_user(id,email_lookup,email_raw,display_name,status)VALUES($1,$2,$2,'Synthetic disabled staff','DISABLED')", [disabled, disabledEmail]);
  assert.equal((await api(base, "POST", { email: disabledEmail, role: "TA" })).status(), 422);
  for (const email of ["v20-presentation-s0@example.test", "v20-presentation-owner@example.test"]) assert.equal((await api(base, "POST", { email, role: "TA" })).status(), 409);
  assert.equal((await api(base, "POST", { email: "x@example.test", userId: state.users.co.id, role: "TA" })).status(), 422);
  assert.equal((await api(base, "POST", { email: "x@example.test", role: "OWNER" })).status(), 422);
  assert.equal((await api(`${base}/${state.users.owner.id}`, "DELETE")).status(), 409);
  mark("duplicates, unknown/disabled accounts, Student/Owner conversion, invalid body and final Owner rejected");
  const remove = page.getByRole("button", { name: "ถอด ผู้สอนร่วม ออกจากทีมผู้สอน", exact: true });
  await remove.click(); await scan("remove-dialog"); await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible(); await expect(remove).toBeFocused();
  await remove.click(); await page.getByRole("button", { name: "ยืนยันถอดออก", exact: true }).click();
  await expect(page.getByRole("cell", { name: "v20-presentation-co@example.test", exact: true })).toHaveCount(0);
  await enter("ผู้สอนร่วม");
  assert.equal((await api(`/api/full-system/classrooms/${room}/roster`)).status(), 404);
  assert.equal((await api(`/api/full-system/classrooms/${state.room}/roster`)).status(), 200);
  await enter("อาจารย์เจ้าของห้อง"); await page.goto(roster);
  await add("v20-presentation-co@example.test"); await expect(page.getByRole("cell", { name: "v20-presentation-co@example.test", exact: true })).toBeVisible();
  const after = (await pool.query("SELECT id,joined_at,membership_status FROM classroom_member WHERE classroom_id=$1 AND user_id=$2", [room, state.users.co.id])).rows[0];
  assert.equal(after.id, before.id); assert.equal(after.joined_at.toISOString(), before.joined_at.toISOString()); assert.equal(after.membership_status, "ACTIVE");
  mark("GUI cancel/Escape, 204 remove, access revocation and restore preserve membership history");
  for (const role of ["ผู้สอนร่วม", "ผู้ช่วยสอน", "นักศึกษาคนที่ 1", "นักศึกษาคนที่ 2"]) {
    await enter(role);
    assert.equal((await api(base)).status(), 404);
    assert.equal((await api(canonical)).status(), 404);
    assert.equal((await api(base, "POST", { email: "unknown@example.test", role: "TA" })).status(), 404);
    assert.equal((await api(`${base}/${state.users.ta.id}`, "DELETE")).status(), 404);
    await page.goto(roster); await expect(page.getByRole("heading", { name: "รายชื่อและกลุ่ม", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ทีมผู้สอน", exact: true })).toHaveCount(0);
  }
  mark("Co-teacher, TA, Student and outsider cannot manage staff via GUI/API");
  await enter("อาจารย์เจ้าของห้อง");
  assert.equal((await api(`${canonical}/${state.users.ta.id}`, "DELETE")).status(), 204);
  const legacy = await api(canonical, "POST", { userId: state.users.ta.id, role: "TA" }); assert.equal(legacy.status(), 201); assert.equal((await legacy.json()).data.restored, true);
  mark("canonical remove and legacy userId restore work");
  await page.goto(roster);
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 900 }); await scan(`owner-mobile-${width}`); }
  await page.setViewportSize({ width: 1366, height: 900 });
  // Inject responses only at browser transport: these are UI recovery checks, not real audit outages.
  for (const [status, payload] of [[202, { data: { status: "AUDIT_PENDING" } }], [503, { error: { code: "AUDIT_UNAVAILABLE" } }]]) {
    await context.route(`**${base}`, route => route.request().method() === "POST" ? route.fulfill({ status, json: payload }) : route.continue());
    await add("unknown-staff@example.test");
    if (status === 202) {
      await expect(page.getByRole("status").filter({ hasText: "รายการยังรอยืนยัน" })).toBeVisible();
      await expect(page.getByRole("button", { name: "เพิ่มสมาชิกผู้สอน", exact: true })).toBeDisabled();
    } else await expect(page.getByRole("region", { name: "ทีมผู้สอน" }).getByRole("alert")).toContainText("ระบบบันทึกเหตุการณ์ไม่พร้อม");
    await context.unroute(`**${base}`);
    await page.getByRole("button", { name: "โหลดรายชื่อใหม่", exact: true }).click();
    await expect(page.getByRole("button", { name: "เพิ่มสมาชิกผู้สอน", exact: true })).toBeEnabled();
  }
  mark("simulated 202 and 503 do not show false success; manual refresh recovers");
  await context.route(`**${base}`, route => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await add("unknown-staff@example.test");
  await expect(page.getByRole("region", { name: "ทีมผู้สอน" }).getByRole("alert")).toContainText("ยังยืนยันผลไม่ได้");
  await expect(page.getByRole("button", { name: "เพิ่มสมาชิกผู้สอน", exact: true })).toBeDisabled();
  await context.unroute(`**${base}`);
  await page.getByRole("button", { name: "โหลดรายชื่อใหม่", exact: true }).click();
  await expect(page.getByRole("button", { name: "เพิ่มสมาชิกผู้สอน", exact: true })).toBeEnabled();
  mark("simulated network failure requires refresh before another mutation");
  const events = (await audit.query("SELECT action,count(*)::int AS n FROM audit_event WHERE classroom_id=$1 AND action LIKE 'CLASSROOM_ROLE_%' GROUP BY action", [room])).rows;
  assert.equal(events.find(row => row.action === "CLASSROOM_ROLE_ADD_COMMITTED")?.n, 4);
  assert.equal(events.find(row => row.action === "CLASSROOM_ROLE_REMOVE_COMMITTED")?.n, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_outbox WHERE classroom_id=$1 AND delivered_at IS NULL", [room])).rows[0].n, 0);
  assert.deepEqual(errors, []); mark("six staff mutation outcomes committed; no pending audit or browser errors");
  await writeFile(`${dir}/result.json`, JSON.stringify({ checks, scans, pageErrors: errors, auditCommitted: 6, pending: 0, simulated: [202, 503, "network-failure"] }, null, 2));
} finally {
  if (room) await cleanupFixture(pool, room);
  if (disabled) await pool.query("DELETE FROM app_user WHERE id=$1 AND status='DISABLED' AND email_lookup LIKE 'v20-disabled-%@example.test'", [disabled]);
  await browser.close(); await pool.end(); await audit.end();
}
