import { Pool } from "pg";

const environment = process.argv[2];
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL || !process.env.AUDIT_DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST ||
    new URL(process.env.DATABASE_URL).hostname === new URL(process.env.AUDIT_DATABASE_URL).hostname) {
  throw new Error("Operational/audit environment guard failed");
}

const operational = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const audit = new Pool({ connectionString: process.env.AUDIT_DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
try {
  const role = await audit.query(`SELECT current_user AS role_name,
    has_table_privilege(current_user,'audit_event','INSERT') AS can_insert,
    has_table_privilege(current_user,'audit_event','UPDATE') AS can_update,
    has_table_privilege(current_user,'audit_event','DELETE') AS can_delete,
    has_table_privilege(current_user,'audit_event','TRUNCATE') AS can_truncate,
    pg_has_role(current_user,'neon_superuser','member') AS member_of_superuser`);
  const access = role.rows[0];
  if (access?.role_name !== "paireval_audit_app" || !access.can_insert || access.can_update ||
      access.can_delete || access.can_truncate || access.member_of_superuser) throw new Error("Unsafe audit role");
  const pending = await operational.query(`SELECT id,request_id,classroom_id,actor_user_id,action,
    resource_type,resource_id,before_json,after_json,reason FROM audit_outbox
    WHERE delivered_at IS NULL ORDER BY created_at,id LIMIT 100`);
  let delivered = 0;
  for (const row of pending.rows) {
    await audit.query(`INSERT INTO audit_event
      (id,classroom_id,actor_user_id,action,resource_type,resource_id,request_id,before_json,after_json,reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
    [row.id, row.classroom_id, row.actor_user_id, row.action, row.resource_type,
      row.resource_id, row.request_id, row.before_json, row.after_json, row.reason]);
    const found = await audit.query("SELECT action,request_id FROM audit_event WHERE id=$1", [row.id]);
    if (found.rows[0]?.action !== row.action || found.rows[0]?.request_id !== row.request_id) {
      throw new Error("Audit outcome idempotency mismatch");
    }
    await operational.query("UPDATE audit_outbox SET delivered_at=now() WHERE id=$1 AND delivered_at IS NULL", [row.id]);
    delivered++;
  }
  const remaining = await operational.query("SELECT count(*)::integer AS n FROM audit_outbox WHERE delivered_at IS NULL");
  console.log(`Audit outbox drain (${environment}): delivered=${delivered}, pending=${remaining.rows[0].n}`);
} finally { await operational.end(); await audit.end(); }
