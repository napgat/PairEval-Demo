import { randomUUID } from "node:crypto";
import { Pool } from "pg";

let auditPool: Pool | undefined;
let roleVerified: Promise<void> | undefined;
const AUDIT_RUNTIME_ROLE = "paireval_audit_app";

export class AuditUnavailableError extends Error {}

function pool(): Pool {
  const auditUrl = process.env.AUDIT_DATABASE_URL;
  const operationalUrl = process.env.DATABASE_URL;
  if (!auditUrl || !operationalUrl) throw new AuditUnavailableError("Separate audit database is not configured");
  const audit = new URL(auditUrl);
  const operational = new URL(operationalUrl);
  if (audit.hostname === operational.hostname) throw new AuditUnavailableError("Audit database must use a separate Neon endpoint");
  auditPool ??= new Pool({ connectionString: auditUrl, max: 2, connectionTimeoutMillis: 5000 });
  return auditPool;
}

async function requireRestrictedAuditRole(): Promise<void> {
  roleVerified ??= (async () => {
    const result = await pool().query<{ role_name: string; can_insert: boolean; can_update: boolean;
      can_delete: boolean; can_truncate: boolean; member_of_superuser: boolean }>(
      `SELECT current_user AS role_name,
        has_table_privilege(current_user,'audit_event','INSERT') AS can_insert,
        has_table_privilege(current_user,'audit_event','UPDATE') AS can_update,
        has_table_privilege(current_user,'audit_event','DELETE') AS can_delete,
        has_table_privilege(current_user,'audit_event','TRUNCATE') AS can_truncate,
        pg_has_role(current_user,'neon_superuser','member') AS member_of_superuser`);
    const role = result.rows[0];
    if (!role || role.role_name !== AUDIT_RUNTIME_ROLE || !role.can_insert || role.can_update ||
        role.can_delete || role.can_truncate || role.member_of_superuser) {
      throw new AuditUnavailableError("Audit role has unsafe privileges");
    }
  })();
  try { await roleVerified; }
  catch (error) { roleVerified = undefined; throw error; }
}

/** Write an immutable request event before a critical operational mutation. Failure aborts that mutation. */
export async function writeAuditIntent(input: {
  classroomId?: string; actorUserId: string; action: string; resourceType: string; resourceId: string;
  before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string;
}): Promise<void> {
  try {
    await requireRestrictedAuditRole();
    await pool().query(`INSERT INTO audit_event
      (id,classroom_id,actor_user_id,action,resource_type,resource_id,request_id,before_json,after_json,reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [randomUUID(), input.classroomId ?? null, input.actorUserId, input.action,
      input.resourceType, input.resourceId, randomUUID(), input.before ?? null, input.after ?? null, input.reason ?? null]);
  } catch {
    throw new AuditUnavailableError("Audit write failed; operational change was not started");
  }
}
