import { readFile } from "node:fs/promises";
import { Pool } from "pg";

process.loadEnvFile(".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== "staging" ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}
const fixture = JSON.parse(await readFile(".verification/day2-oidc-fixture.json", "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  const result = await pool.query(`SELECT u.status, u.google_sub IS NOT NULL AS google_linked,
    count(s.id)::integer AS session_count,
    count(s.id) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at > now())::integer AS active_sessions
    FROM app_user u LEFT JOIN app_session s ON s.user_id = u.id
    WHERE u.id = $1 GROUP BY u.id`, [fixture.userId]);
  const row = result.rows[0];
  console.log(JSON.stringify({ status: row?.status ?? null, googleLinked: row?.google_linked ?? false,
    sessionCount: row?.session_count ?? 0, activeSessions: row?.active_sessions ?? 0 }));
} finally { await pool.end(); }
