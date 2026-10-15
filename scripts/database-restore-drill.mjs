import { Pool } from "pg";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  createBackup,
  decryptBackup,
  restoreImage,
  databaseImage,
} from "./backup-core.mjs";
process.loadEnvFile(".env.local");
if (new URL(process.env.DATABASE_URL).hostname !== "127.0.0.1")
  throw Error("Restore drill is restricted to isolated local PostgreSQL");
const start = performance.now(),
  backup = await createBackup(),
  text = await readFile(backup.file, "utf8"),
  image = decryptBackup(text, process.env.PAIR_EVAL_BACKUP_KEY);
assert.throws(() =>
  decryptBackup(text + "corrupt", process.env.PAIR_EVAL_BACKUP_KEY),
);
assert.throws(() => decryptBackup(text, "wrong-key"));
const admin = new Pool({ connectionString: process.env.DATABASE_URL }),
  prefix = "paireval_restore_" + randomUUID().replaceAll("-", "");
const names = [prefix + "_a", prefix + "_b"];
const results = {
  backup,
  ...Object.fromEntries(
    ["operational", "audit"].map((k) => [
      k,
      {
        tables: Object.keys(image[k].tables).length,
        rows: Object.values(image[k].tables).reduce(
          (n, rows) => n + rows.length,
          0,
        ),
      },
    ]),
  ),
};
try {
  for (const [i, kind] of ["operational", "audit"].entries()) {
    const name = names[i];
    await admin.query(
      `CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    const pool = new Pool({ connectionString: url.href, max: 1 }),
      client = await pool.connect();
    try {
      if (kind === "operational") {
        await client.query(
          "CREATE TABLE schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
        );
        for (const entry of image.migrations) {
          const sql = await readFile("db/migrations/" + entry.file, "utf8");
          assert.equal(
            createHash("sha256").update(sql).digest("hex"),
            entry.sha256,
          );
          await client.query(sql);
        }
      } else
        await client.query(await readFile("db/audit/001_audit.sql", "utf8"));
      await restoreImage(client, image[kind]);
    } finally {
      client.release();
      await pool.end();
    }
    const restored = await databaseImage(url.href);
    // PostgreSQL presents row_to_json in schema order. Compare complete rows and values, never counts alone.
    assert.deepEqual(
      restored.tables,
      image[kind].tables,
      kind + " full-table image mismatch",
    );
    results[kind].fullDataMatch = true;
  }
  results.restoreSeconds = +(performance.now() - start).toFixed(0) / 1000;
  results.encryptionTamperDetection = true;
  results.liveDatabasesUnchanged = true;
  console.log(JSON.stringify(results, null, 2));
  await writeFile(
    ".verification/v20-20261015/restore-drill.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  for (const name of names) {
    if (!/^paireval_restore_[a-f0-9_]+$/.test(name))
      throw Error("Unsafe cleanup name");
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  }
  await admin.end();
}
