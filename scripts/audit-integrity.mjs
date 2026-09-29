import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Pool } from "pg";
import { canonicalAuditEvent, checkpointPrefix, computeAuditCheckpoint } from "./audit-integrity-core.mjs";

const [action, environment, manifestArgument] = process.argv.slice(2);
if (!["create", "verify"].includes(action) || !["development", "staging"].includes(environment) ||
    (action === "verify" && !manifestArgument)) {
  throw new Error("Use: audit-integrity.mjs create|verify development|staging [manifest.json]");
}
process.loadEnvFile(join(process.cwd(), environment === "development" ? ".env.local" : ".env.staging.local"));
if (process.env.PAIR_EVAL_ENV !== environment) throw new Error("Environment guard mismatch");
const auditUrl = process.env.AUDIT_DATABASE_URL;
const operationalUrl = process.env.DATABASE_URL;
if (!auditUrl || !operationalUrl || new URL(auditUrl).hostname === new URL(operationalUrl).hostname) {
  throw new Error("Separate audit database is not configured");
}
const auditHost = new URL(auditUrl).hostname;
const pool = new Pool({ connectionString: auditUrl, max: 1, connectionTimeoutMillis: 5000 });
try {
  const role = await pool.query(`SELECT current_user AS role_name,
    has_table_privilege(current_user,'audit_event','INSERT') AS can_insert,
    has_table_privilege(current_user,'audit_event','UPDATE') AS can_update,
    has_table_privilege(current_user,'audit_event','DELETE') AS can_delete,
    has_table_privilege(current_user,'audit_event','TRUNCATE') AS can_truncate,
    pg_has_role(current_user,'neon_superuser','member') AS member_of_superuser`);
  const access = role.rows[0];
  if (access?.role_name !== "paireval_audit_app" || !access.can_insert || access.can_update ||
      access.can_delete || access.can_truncate || access.member_of_superuser) throw new Error("Unsafe audit role");
  const result = await pool.query(`SELECT id,classroom_id,assignment_id,actor_user_id,action,resource_type,
    resource_id,before_json,after_json,reason,ip_address,request_id,
    to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at
    FROM audit_event ORDER BY occurred_at,id`);
  const events = result.rows;
  if (action === "create") {
    const checkpoint = computeAuditCheckpoint(events);
    const directory = resolve(".verification", "audit-checkpoints", environment);
    await mkdir(directory, { recursive: true });
    const basename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
    const backupFile = join(directory, `${basename}.ndjson`);
    const manifestFile = join(directory, `${basename}.json`);
    const backup = events.map(canonicalAuditEvent).join("\n") + (events.length ? "\n" : "");
    const backupSha256 = createHash("sha256").update(backup, "utf8").digest("hex");
    await writeFile(backupFile, backup, { flag: "wx", mode: 0o600 });
    await writeFile(manifestFile, JSON.stringify({ format: "paireval-audit-checkpoint-v1", environment,
      auditHost, createdAt: new Date().toISOString(), backupFile: `${basename}.ndjson`, backupSha256,
      ...checkpoint }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(`Audit checkpoint created (${environment}): ${manifestFile}; rows=${checkpoint.rowCount}`);
  } else {
    const manifestFile = resolve(manifestArgument);
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    if (manifest.format !== "paireval-audit-checkpoint-v1" || manifest.environment !== environment ||
        manifest.auditHost !== auditHost || typeof manifest.backupFile !== "string" ||
        manifest.backupFile !== manifest.backupFile.split(/[\\/]/).at(-1)) throw new Error("Checkpoint target mismatch");
    const backup = await readFile(join(dirname(manifestFile), manifest.backupFile), "utf8");
    const backupSha256 = createHash("sha256").update(backup, "utf8").digest("hex");
    if (backupSha256 !== manifest.backupSha256) throw new Error("Audit backup digest mismatch");
    const savedRows = backup ? backup.trimEnd().split("\n").map(line => JSON.parse(line)) : [];
    const savedCheckpoint = computeAuditCheckpoint(savedRows);
    if (savedCheckpoint.rowCount !== manifest.rowCount || savedCheckpoint.chainSha256 !== manifest.chainSha256 ||
        JSON.stringify(savedCheckpoint.highWatermark) !== JSON.stringify(manifest.highWatermark)) {
      throw new Error("Audit backup checkpoint mismatch");
    }
    const databaseCheckpoint = computeAuditCheckpoint(checkpointPrefix(events, manifest.highWatermark));
    if (databaseCheckpoint.rowCount !== manifest.rowCount || databaseCheckpoint.chainSha256 !== manifest.chainSha256) {
      throw new Error("Audit database checkpoint mismatch");
    }
    console.log(`Audit checkpoint verified (${environment}); rows=${manifest.rowCount}`);
  }
} finally { await pool.end(); }
