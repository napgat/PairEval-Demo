import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { canonicalAuditEvent, computeAuditCheckpoint } from "./audit-integrity-core.mjs";

const environment = process.argv[2];
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(join(process.cwd(), environment === "development" ? ".env.local" : ".env.staging.local"));
process.loadEnvFile(join(process.cwd(), `.env.audit.${environment}.local`));
if (process.env.PAIR_EVAL_ENV !== environment) throw new Error("Environment guard mismatch");
const runtimeUrl = process.env.AUDIT_DATABASE_URL;
const ownerUrl = process.env.AUDIT_OWNER_DATABASE_URL;
if (!runtimeUrl || !ownerUrl || !process.env.DATABASE_URL ||
    new URL(runtimeUrl).hostname !== new URL(ownerUrl).hostname ||
    new URL(ownerUrl).hostname === new URL(process.env.DATABASE_URL).hostname) {
  throw new Error("Audit owner/runtime host guard failed");
}

const event = {
  id: randomUUID(), classroom_id: null, assignment_id: null, actor_user_id: null,
  action: "SYNTHETIC_RESTORE_TEST", resource_type: "test", resource_id: "synthetic",
  before_json: { state: "before" }, after_json: { state: "after" }, reason: "restore drill",
  ip_address: null, request_id: randomUUID(), occurred_at: "2026-09-29T00:00:00.000000Z",
};
const source = [event];
const backup = source.map(canonicalAuditEvent).join("\n") + "\n";
const checkpoint = computeAuditCheckpoint(source);
const directory = join(process.cwd(), ".verification", "audit-restore", environment);
await mkdir(directory, { recursive: true });
const backupFile = join(directory, `${event.id}.ndjson`);
const manifestFile = join(directory, `${event.id}.json`);
await writeFile(backupFile, backup, { flag: "wx", mode: 0o600 });
await writeFile(manifestFile, JSON.stringify({ format: "paireval-audit-restore-test-v1", environment,
  auditHost: new URL(ownerUrl).hostname, backupSha256: createHash("sha256").update(backup).digest("hex"),
  ...checkpoint }, null, 2) + "\n", { flag: "wx", mode: 0o600 });

const saved = await readFile(backupFile, "utf8");
const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
if (createHash("sha256").update(saved).digest("hex") !== manifest.backupSha256) throw new Error("Backup digest mismatch");
const rows = saved.trimEnd().split("\n").map(line => JSON.parse(line));
const pool = new Pool({ connectionString: ownerUrl, max: 1, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE TEMP TABLE audit_restore_probe (LIKE audit_event INCLUDING ALL) ON COMMIT DROP");
  for (const row of rows) {
    await client.query(`INSERT INTO audit_restore_probe
      (id,classroom_id,assignment_id,actor_user_id,action,resource_type,resource_id,before_json,
       after_json,reason,ip_address,request_id,occurred_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [row.id,row.classroom_id,row.assignment_id,row.actor_user_id,row.action,row.resource_type,
      row.resource_id,row.before_json,row.after_json,row.reason,row.ip_address,row.request_id,row.occurred_at]);
  }
  const restored = await client.query(`SELECT id,classroom_id,assignment_id,actor_user_id,action,resource_type,
    resource_id,before_json,after_json,reason,ip_address,request_id,
    to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at
    FROM audit_restore_probe ORDER BY occurred_at,id`);
  const result = computeAuditCheckpoint(restored.rows);
  if (result.rowCount !== manifest.rowCount || result.chainSha256 !== manifest.chainSha256) {
    throw new Error("Restored audit checkpoint mismatch");
  }
  await client.query("ROLLBACK");
  console.log(`Synthetic audit restore drill passed (${environment}); rows=${result.rowCount}; transaction rolled back`);
} catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
finally { client.release(); await pool.end(); }
