import { randomUUID, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

let pool: Pool | undefined;

export function databasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (process.env.PAIR_EVAL_EXPECTED_DB_HOST && new URL(connectionString).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
    throw new Error("Operational database host mismatch");
  }
  pool ??= new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 });
  return pool;
}

export function validSmokeToken(candidate: string | null): boolean {
  const expected = process.env.DB_SMOKE_TOKEN;
  if (process.env.PAIR_EVAL_ENV !== "staging" || !expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A bounded synthetic write/read/delete probe. No Demo table is touched. */
export async function runDatabaseSmoke(): Promise<{ database: "postgresql"; writeReadDelete: true; marker: string }> {
  const client = await databasePool().connect();
  const id = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO db_smoke_probe (id) VALUES ($1)", [id]);
    const probe = await client.query<{ id: string }>("SELECT id FROM db_smoke_probe WHERE id = $1", [id]);
    if (probe.rows.length !== 1 || probe.rows[0].id !== id) throw new Error("PostgreSQL smoke read failed");
    await client.query("DELETE FROM db_smoke_probe WHERE id = $1", [id]);
    const marker = await client.query<{ id: string }>("SELECT id FROM app_seed_marker WHERE id = $1", ["synthetic-day-01"]);
    if (marker.rows.length !== 1) throw new Error("Synthetic seed missing");
    await client.query("COMMIT");
    return { database: "postgresql", writeReadDelete: true, marker: marker.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
