import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const id = randomUUID(), email = `staging-notice-${id.slice(0, 8)}@example.test`;
const token = randomBytes(32).toString("hex");
let browser;
try {
  await pool.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status)
    VALUES ($1,$2,$2,'Synthetic Notice Tester','ACTIVE')`, [id, email]);
  await pool.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
    VALUES ($1,$2,$3,now()+interval '10 minutes')`,
  [randomUUID(), id, createHash("sha256").update(token).digest("hex")]);
  const headers = { Cookie: `paireval_full_session=${token}`, Origin: origin,
    "Content-Type": "application/json" };
  const before = await fetch(`${origin}/api/full-system/classrooms`, { headers });
  if (before.status !== 428) throw new Error(`Expected notice gate 428, got ${before.status}`);
  const badOrigin = await fetch(`${origin}/api/auth/privacy-notice`, { method: "POST",
    headers: { ...headers, Origin: "https://example.test" }, body: JSON.stringify({ noticeVersion: "prd-v2.0-privacy-20261015" }) });
  if (badOrigin.status !== 403) throw new Error(`Expected origin denial 403, got ${badOrigin.status}`);
  const badVersion = await fetch(`${origin}/api/auth/privacy-notice`, { method: "POST",
    headers, body: JSON.stringify({ noticeVersion: "synthetic-staging-v1" }) });
  if (badVersion.status !== 422) throw new Error(`Expected version denial 422, got ${badVersion.status}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: "paireval_full_session", value: token,
    url: origin, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(`${origin}/full-system`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "การใช้ข้อมูลสำหรับ staging ของโครงงาน" }).waitFor();
  await page.getByRole("button", { name: "รับทราบและเข้าดูข้อมูลสาธิต" }).click();
  await page.getByRole("heading", { name: "ยังไม่มีห้องเรียน", exact: true }).waitFor();
  const acceptance = await pool.query("SELECT notice_version FROM privacy_notice_acceptance WHERE user_id=$1", [id]);
  if (acceptance.rows[0]?.notice_version !== "prd-v2.0-privacy-20261015") {
    throw new Error("Notice acknowledgement was not saved");
  }
  const after = await fetch(`${origin}/api/full-system/classrooms`, { headers });
  if (after.status !== 200) throw new Error(`Expected classroom read 200, got ${after.status}`);
  console.log(`${environment}: staging notice UI acknowledgement and role gate passed`);
} finally {
  await browser?.close().catch(() => {});
  await pool.query("DELETE FROM app_session WHERE user_id=$1", [id]).catch(() => {});
  await pool.query("DELETE FROM privacy_notice_acceptance WHERE user_id=$1", [id]).catch(() => {});
  await pool.query("DELETE FROM app_user WHERE id=$1", [id]).catch(() => {});
  await pool.end();
}
