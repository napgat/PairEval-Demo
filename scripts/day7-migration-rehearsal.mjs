import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const environment = process.argv[2];
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational database guard failed");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
  connectionTimeoutMillis: 30000 });
const name = `day7_rehearsal_${randomUUID().replaceAll("-", "")}`;
const files = readdirSync("db/migrations").filter(file => /^\d{3}_.*\.sql$/.test(file)).sort();
if (files.length !== 9) throw new Error(`Expected migrations 001–009; found ${files.length}`);
const client = await pool.connect();
let tableCount = 0;
try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${name}"`);
  await client.query(`SET LOCAL search_path TO "${name}", pg_catalog`);
  for (const file of files) await client.query(readFileSync(join("db/migrations", file), "utf8"));
  const rows = await client.query(`SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname=$1`, [name]);
  tableCount = rows.rows[0].n;
  if (tableCount < 15) throw new Error(`Fresh migration yielded only ${tableCount} tables`);
  await client.query("ROLLBACK");
  const absent = await client.query("SELECT 1 FROM pg_namespace WHERE nspname=$1", [name]);
  if (absent.rowCount) throw new Error("Rolled-back rehearsal schema still exists");
  console.log(`${environment}: ${files.length} migrations applied in a clean isolated schema,
    ${tableCount} tables observed, transaction rolled back, schema absent`);
} catch (error) {
  try { await client.query("ROLLBACK"); } catch { /* original failure retained */ }
  throw error;
} finally { client.release(); await pool.end(); }
