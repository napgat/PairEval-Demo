import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { chromium } from "@playwright/test";

process.loadEnvFile(".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== "staging" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}
const fixture = JSON.parse(await readFile(join(process.cwd(), ".verification", "staging-demo-access.json"), "utf8"));
const origin = "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const token = randomBytes(32).toString("hex");
let candidateId, browser;
try {
  const candidate = await pool.query(`SELECT u.id FROM app_user u
    JOIN classroom_member m ON m.user_id=u.id AND m.classroom_id=$1 AND m.role='STUDENT'
    JOIN pair_assignment p ON p.evaluator_user_id=u.id
    JOIN assignment a ON a.id=p.assignment_id AND a.classroom_id=$1 AND a.generation=p.generation
    WHERE u.email_lookup LIKE 'staging-preview-%@example.test' AND a.status='OPEN'
    GROUP BY u.id HAVING count(*) FILTER (WHERE p.side='GROUP')>0
      AND count(*) FILTER (WHERE p.side='INDIVIDUAL')>0 LIMIT 1`, [fixture.classroomId]);
  if (candidate.rowCount !== 1) throw new Error("No synthetic student with both evaluation sides");
  candidateId = candidate.rows[0].id;
  await pool.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
    VALUES ($1,'synthetic-staging-v1')`, [candidateId]);
  await pool.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
    VALUES ($1,$2,$3,now()+interval '10 minutes')`,
  [randomUUID(), candidateId, createHash("sha256").update(token).digest("hex")]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: "paireval_full_session", value: token,
    url: origin, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(`${origin}/full-system`, { waitUntil: "domcontentloaded" });
  await page.getByText("PairEval Student Project Preview").waitFor();
  await page.getByRole("link", { name: /งานประเมินและคะแนนของฉัน/ }).click();
  await page.getByRole("heading", { name: "งานประเมินตัวอย่าง" }).waitFor();
  await page.getByRole("link", { name: /ประเมินกลุ่ม/ }).waitFor();
  await page.getByRole("link", { name: /ประเมินรายบุคคล/ }).waitFor();
  console.log("staging preview: synthetic student saw classroom, published assignment and both evaluation links");
} finally {
  await browser?.close().catch(() => {});
  if (candidateId) {
    await pool.query("DELETE FROM app_session WHERE user_id=$1", [candidateId]).catch(() => {});
    await pool.query("DELETE FROM privacy_notice_acceptance WHERE user_id=$1", [candidateId]).catch(() => {});
  }
  await pool.end();
}
