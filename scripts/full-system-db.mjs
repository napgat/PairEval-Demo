import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const localEnv = join(process.cwd(), process.env.PAIR_EVAL_CONFIG ?? ".env.local");
if (existsSync(localEnv)) process.loadEnvFile(localEnv);
const action = process.argv[2];
if (!["migrate", "seed", "smoke"].includes(action)) throw new Error("Use migrate, seed, or smoke");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
if (!process.env.PAIR_EVAL_ENV || !["development", "staging"].includes(process.env.PAIR_EVAL_ENV)) {
  throw new Error("PAIR_EVAL_ENV must be development or staging");
}
if (!process.env.PAIR_EVAL_EXPECTED_DB_HOST || new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("DATABASE_URL host does not match PAIR_EVAL_EXPECTED_DB_HOST");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(23180401)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const directory = join(process.cwd(), "db", "migrations");
    const files = readdirSync(directory).filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
    const applied = [];
    for (const file of files) {
      const version = file.slice(0, -4);
      const found = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
      if (found.rowCount === 0) {
        await client.query(readFileSync(join(directory, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        applied.push(version);
      }
    }
    await client.query("COMMIT");
    console.log(`Migrations: ${applied.length ? applied.join(", ") + " applied" : "already applied"} (${process.env.PAIR_EVAL_ENV})`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function seed() {
  await pool.query("INSERT INTO app_seed_marker (id, label) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label", ["synthetic-day-01", "PairEval Full System synthetic staging fixture"]);
  console.log(`Synthetic seed marker upserted (${process.env.PAIR_EVAL_ENV})`);
}

async function smoke() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = randomUUID();
    await client.query("INSERT INTO db_smoke_probe (id) VALUES ($1)", [id]);
    const row = await client.query("SELECT id FROM db_smoke_probe WHERE id = $1", [id]);
    if (row.rows[0]?.id !== id) throw new Error("Probe read mismatch");
    await client.query("DELETE FROM db_smoke_probe WHERE id = $1", [id]);
    const marker = await client.query("SELECT id FROM app_seed_marker WHERE id = $1", ["synthetic-day-01"]);
    if (marker.rowCount !== 1) throw new Error("Synthetic seed marker missing");
    await client.query("COMMIT");
    console.log(`PostgreSQL write/read/delete and seed read: passed (${process.env.PAIR_EVAL_ENV})`);
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

try {
  if (action === "migrate") await migrate();
  else if (action === "seed") await seed();
  else await smoke();
} finally { await pool.end(); }
