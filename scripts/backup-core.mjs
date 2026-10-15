import { Pool } from "pg";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  stat,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const identifier = (value) => {
  if (!/^[a-z_]+$/.test(value)) throw Error("Invalid backup identifier");
  return '"' + value + '"';
};
export async function databaseImage(url) {
  const pool = new Pool({ connectionString: url, max: 1 }),
    client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((r) => r.tablename);
    const data = {};
    for (const t of tables)
      data[t] = (
        await client.query(
          `SELECT row_to_json(t) AS row FROM ${identifier(t)} t ORDER BY row_to_json(t)::text`,
        )
      ).rows.map((r) => r.row);
    const dependencies = (
      await client.query(
        "SELECT child.relname AS child,parent.relname AS parent FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid JOIN pg_namespace n ON n.oid=child.relnamespace WHERE c.contype='f' AND n.nspname='public'",
      )
    ).rows;
    await client.query("COMMIT");
    return { tables: data, dependencies };
  } finally {
    client.release();
    await pool.end();
  }
}
export function encryptBackup(data, key) {
  if (!key || Buffer.byteLength(key) < 32)
    throw Error("Separate PAIR_EVAL_BACKUP_KEY (32+ bytes) required");
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256").update(key).digest(),
      iv,
    );
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    format: "paireval-encrypted-backup-v1",
    cipher: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: bytes.toString("base64"),
  });
}
export function decryptBackup(text, key) {
  const data = JSON.parse(text);
  if (data.format !== "paireval-encrypted-backup-v1")
    throw Error("Unknown backup format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(key).digest(),
    Buffer.from(data.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(data.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data.data, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export async function createBackup(directory = ".verification/backups") {
  const [operational, audit] = await Promise.all([
    databaseImage(process.env.DATABASE_URL),
    databaseImage(process.env.AUDIT_DATABASE_URL),
  ]);
  const migrationFiles = (await readdir("db/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
  const migrations = await Promise.all(
    migrationFiles.map(async (f) => ({
      file: f,
      sha256: digest(await readFile("db/migrations/" + f)),
    })),
  );
  const image = {
    format: "paireval-db-image-v1",
    createdAt: new Date().toISOString(),
    migrations,
    operational,
    audit,
  };
  const encrypted = encryptBackup(image, process.env.PAIR_EVAL_BACKUP_KEY);
  await mkdir(directory, { recursive: true });
  const file =
    directory +
    "/paireval-" +
    image.createdAt.replaceAll(":", "-") +
    ".json.enc";
  await writeFile(file, encrypted, { flag: "wx", mode: 0o600 });
  // Only our encrypted backup names in this exact directory are eligible. Keep seven days.
  const root = resolve(directory);
  for (const name of await readdir(root))
    if (
      /^paireval-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z\.json\.enc$/.test(name)
    ) {
      const target = resolve(root, name);
      if (dirname(target) !== root)
        throw Error("Backup cleanup target escaped its directory");
      if ((await stat(target)).mtimeMs < Date.now() - 7 * 86400000)
        await unlink(target);
    }
  return {
    file,
    sha256: digest(encrypted),
    createdAt: image.createdAt,
    tables: Object.keys(operational.tables).length,
    auditRows: audit.tables.audit_event.length,
  };
}
export async function restoreImage(client, image) {
  const current = (await client.query("SELECT current_database() AS db"))
    .rows[0].db;
  if (!/^paireval_restore_[a-f0-9_]+$/.test(current))
    throw Error("Restore drill target guard failed");
  const tables = Object.keys(image.tables),
    pending = new Set(tables),
    order = [];
  while (pending.size) {
    const ready = [...pending].filter((t) =>
      image.dependencies.every(
        (d) => d.child !== t || d.parent === t || !pending.has(d.parent),
      ),
    );
    if (!ready.length)
      throw Error("Circular schema dependencies need an explicit restore rule");
    for (const t of ready) {
      order.push(t);
      pending.delete(t);
    }
  }
  await client.query("BEGIN");
  try {
    await client.query(
      "TRUNCATE " + tables.map(identifier).join(",") + " CASCADE",
    );
    for (const t of order)
      for (const row of image.tables[t]) {
        const fields = Object.keys(row);
        await client.query(
          `INSERT INTO ${identifier(t)} (${fields.map(identifier).join(",")}) VALUES(${fields.map((_, i) => "$" + (i + 1)).join(",")})`,
          fields.map((k) =>
            row[k] && typeof row[k] === "object" && !Array.isArray(row[k])
              ? JSON.stringify(row[k])
              : row[k],
          ),
        );
      }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}
