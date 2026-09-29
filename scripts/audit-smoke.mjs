import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";

const environment = process.argv[2];
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(join(process.cwd(), environment === "development" ? ".env.local" : ".env.staging.local"));
if (process.env.PAIR_EVAL_ENV !== environment) throw new Error("Environment guard mismatch");
const auditUrl = process.env.AUDIT_DATABASE_URL;
const operationalUrl = process.env.DATABASE_URL;
if (!auditUrl || !operationalUrl || new URL(auditUrl).hostname === new URL(operationalUrl).hostname) {
  throw new Error("Separate audit database is not configured");
}
const pool = new Pool({ connectionString: auditUrl, max: 1, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  const role = await client.query("SELECT current_user AS role_name");
  if (role.rows[0]?.role_name !== "paireval_audit_app") throw new Error("Unsafe audit role");
  await client.query("BEGIN");
  const id = randomUUID();
  await client.query(`INSERT INTO audit_event
    (id,classroom_id,action,resource_type,resource_id,request_id)
    VALUES ($1,NULL,'SYNTHETIC_PERMISSION_TEST','smoke',$2,$3)`, [id, id, randomUUID()]);
  const read = await client.query("SELECT id FROM audit_event WHERE id=$1", [id]);
  if (read.rows[0]?.id !== id) throw new Error("Audit SELECT failed");
  const denied = [
    ["UPDATE", "UPDATE audit_event SET reason='forbidden' WHERE id=$1"],
    ["DELETE", "DELETE FROM audit_event WHERE id=$1"],
    ["TRUNCATE", "TRUNCATE audit_event"],
  ];
  for (const [action, sql] of denied) {
    await client.query("SAVEPOINT denied_write");
    let code;
    try { await client.query(sql, action === "TRUNCATE" ? [] : [id]); }
    catch (error) { code = error.code; }
    await client.query("ROLLBACK TO SAVEPOINT denied_write");
    if (code !== "42501") throw new Error(`${action} was not denied with insufficient_privilege`);
  }
  await client.query("ROLLBACK");
  console.log(`Audit INSERT/SELECT allowed and UPDATE/DELETE/TRUNCATE denied (${environment}); synthetic event rolled back`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally { client.release(); await pool.end(); }
