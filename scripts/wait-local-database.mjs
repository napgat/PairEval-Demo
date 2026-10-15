import { Pool } from "pg";
import { readFile } from "node:fs/promises";
let ready = false;
for (let attempt = 0; attempt < 90; attempt++) {
  let pool;
  try {
    const text = await readFile(".env.local", "utf8"),
      url = text.match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
    if (!url || new URL(url).hostname !== "127.0.0.1")
      throw Error("Local database configuration is not ready");
    pool = new Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 1000,
    });
    const result = await pool.query(
      "SELECT current_database() AS db,current_setting('server_encoding')AS encoding",
    );
    if (
      result.rows[0].encoding !== "UTF8" ||
      !result.rows[0].db.startsWith("paireval_review")
    )
      throw Error("Unexpected local database");
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    await pool?.end().catch(() => {});
  }
}
if (!ready)
  throw Error("Local PostgreSQL is not ready; see the launcher database log");
console.log("Local UTF-8 database accepted a real query");
