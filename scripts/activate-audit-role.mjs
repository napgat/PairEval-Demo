import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const environment = process.argv[2];
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
const ownerConfig = join(process.cwd(), `.env.audit.${environment}.local`);
if (!existsSync(ownerConfig)) throw new Error(`Ignored owner configuration is missing for ${environment}`);
process.loadEnvFile(ownerConfig);
const ownerConnection = process.env.AUDIT_OWNER_DATABASE_URL;
if (!ownerConnection) throw new Error("AUDIT_OWNER_DATABASE_URL is not configured");
const ownerUrl = new URL(ownerConnection);
if (ownerUrl.username !== "neondb_owner") throw new Error("Audit owner connection must use neondb_owner");
const otherEnvironment = environment === "development" ? "staging" : "development";
const otherOwnerConfig = join(process.cwd(), `.env.audit.${otherEnvironment}.local`);
if (existsSync(otherOwnerConfig)) {
  const otherLine = readFileSync(otherOwnerConfig, "utf8").match(/^AUDIT_OWNER_DATABASE_URL=(.*)$/m);
  if (otherLine?.[1] && new URL(otherLine[1]).hostname === ownerUrl.hostname) {
    throw new Error("Development and staging audit owner URLs point to the same Neon endpoint");
  }
}
const appConfig = join(process.cwd(), environment === "development" ? ".env.local" : ".env.staging.local");
if (!existsSync(appConfig)) throw new Error("Operational environment file is missing");
const appEnv = readFileSync(appConfig, "utf8");
const operationalLine = appEnv.match(/^DATABASE_URL=(.*)$/m);
if (!operationalLine) throw new Error("Operational database URL is missing");
if (new URL(operationalLine[1]).hostname === ownerUrl.hostname) throw new Error("Audit endpoint matches operational endpoint");

const roleName = "paireval_audit_app";
const owner = new Pool({ connectionString: ownerConnection, max: 1, connectionTimeoutMillis: 5000 });
const password = randomBytes(32).toString("base64url");
const appUrl = new URL(ownerConnection);
appUrl.username = roleName;
appUrl.password = password;
try {
  const role = await owner.query(`SELECT rolcanlogin,rolcreaterole,rolcreatedb,rolbypassrls,
    pg_has_role($1,'neon_superuser','member') AS member_of_superuser,
    has_table_privilege($1,'audit_event','INSERT') AS can_insert,
    has_table_privilege($1,'audit_event','UPDATE') AS can_update,
    has_table_privilege($1,'audit_event','DELETE') AS can_delete
    FROM pg_roles WHERE rolname=$1`, [roleName]);
  const row = role.rows[0];
  if (!row || row.rolcreaterole || row.rolcreatedb || row.rolbypassrls || row.member_of_superuser ||
      !row.can_insert || row.can_update || row.can_delete) throw new Error("Audit role is not restricted");
  // base64url contains only safe ASCII characters; the secret is never logged or printed.
  await owner.query(`ALTER ROLE ${roleName} LOGIN PASSWORD '${password}'`);
  const runtime = new Pool({ connectionString: appUrl.toString(), max: 1, connectionTimeoutMillis: 5000 });
  try {
    const check = await runtime.query(`SELECT current_user AS role_name,
      has_table_privilege(current_user,'audit_event','INSERT') AS can_insert,
      has_table_privilege(current_user,'audit_event','UPDATE') AS can_update,
      has_table_privilege(current_user,'audit_event','DELETE') AS can_delete`);
    if (check.rows[0]?.role_name !== roleName || !check.rows[0].can_insert ||
        check.rows[0].can_update || check.rows[0].can_delete) throw new Error("Audit runtime role verification failed");
  } finally { await runtime.end(); }
  const updated = /^AUDIT_DATABASE_URL=/m.test(appEnv)
    ? appEnv.replace(/^AUDIT_DATABASE_URL=.*$/m, `AUDIT_DATABASE_URL=${appUrl.toString()}`)
    : `${appEnv.trimEnd()}\nAUDIT_DATABASE_URL=${appUrl.toString()}\n`;
  writeFileSync(appConfig, updated, { encoding: "utf8", mode: 0o600 });
  console.log(`Restricted audit role activated and ignored ${environment} environment updated`);
} finally { await owner.end(); }
