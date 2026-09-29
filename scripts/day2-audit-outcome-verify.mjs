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
  const role = await audit.query(`SELECT current_user AS name,
    has_table_privilege(current_user,'audit_event','INSERT') AS insert_ok,
    has_table_privilege(current_user,'audit_event','UPDATE') AS update_ok,
    has_table_privilege(current_user,'audit_event','DELETE') AS delete_ok,
    pg_has_role(current_user,'neon_superuser','member') AS superuser`);
  const access = role.rows[0];
  if (access?.name !== "paireval_audit_app" || !access.insert_ok || access.update_ok ||
      access.delete_ok || access.superuser) throw new Error("Unsafe audit role");
  const outbox = await operational.query(`SELECT id,request_id,action,delivered_at
    FROM audit_outbox ORDER BY created_at,id`);
  const pending = outbox.rows.filter(row => !row.delivered_at).length;
  let committed = 0; let rejected = 0;
  const actions = new Map();
  for (const row of outbox.rows) {
    if (!row.delivered_at) continue;
    const events = await audit.query(`SELECT id,action FROM audit_event
      WHERE request_id=$1 AND (id=$2 OR action LIKE '%_REQUESTED')`, [row.request_id, row.id]);
    const intent = events.rows.find(event => event.action.endsWith("_REQUESTED"));
    const outcome = events.rows.find(event => event.id === row.id);
    if (!intent || !outcome || outcome.action !== row.action ||
        intent.action.slice(0, -"_REQUESTED".length) !== row.action.replace(/_(COMMITTED|REJECTED)$/, "")) {
      throw new Error("Audit intent/outcome correlation mismatch");
    }
    if (row.action.endsWith("_COMMITTED")) committed++;
    else if (row.action.endsWith("_REJECTED")) rejected++;
    else throw new Error("Unexpected audit outcome action");
    actions.set(row.action, (actions.get(row.action) ?? 0) + 1);
  }
  const residual = await operational.query(`SELECT
    (SELECT count(*)::integer FROM app_user WHERE email_lookup LIKE 'day2-%@example.test') AS users,
    (SELECT count(*)::integer FROM classroom WHERE name LIKE 'Synthetic Day 2 %' OR name LIKE 'Synthetic Role %' OR name LIKE 'Synthetic Day 3 %' OR name LIKE 'Synthetic Day 4 %' OR name LIKE 'Synthetic Day 5 %' OR name LIKE 'Synthetic Day 7 %') AS classrooms,
    (SELECT count(*)::integer FROM app_user WHERE email_lookup LIKE 'day3-%@example.test') AS day3_users,
    (SELECT count(*)::integer FROM app_user WHERE email_lookup LIKE 'day4-%@example.test') AS day4_users,
    (SELECT count(*)::integer FROM app_user WHERE email_lookup LIKE 'day5-%@example.test') AS day5_users,
    (SELECT count(*)::integer FROM app_user WHERE email_lookup LIKE 'day7-%@example.test') AS day7_users`);
  console.log(`Audit outcome verification (${environment}): committed=${committed}, rejected=${rejected}, pending=${pending}, syntheticUsers=${residual.rows[0].users}, day3Users=${residual.rows[0].day3_users}, day4Users=${residual.rows[0].day4_users}, day5Users=${residual.rows[0].day5_users}, day7Users=${residual.rows[0].day7_users}, syntheticClassrooms=${residual.rows[0].classrooms}`);
  console.log(`Assignment audit outcomes (${environment}): ${JSON.stringify(Object.fromEntries([...actions].filter(([action]) => action.startsWith("ASSIGNMENT_"))))}`);
  console.log(`Evaluation audit outcomes (${environment}): ${JSON.stringify(Object.fromEntries([...actions].filter(([action]) => action.startsWith("EVALUATION_"))))}`);
  console.log(`Score/appeal audit outcomes (${environment}): ${JSON.stringify(Object.fromEntries([...actions].filter(([action]) => action.startsWith("SCORE_") || action.startsWith("APPEAL_"))))}`);
  if (pending || residual.rows[0].users || residual.rows[0].day3_users || residual.rows[0].day4_users ||
      residual.rows[0].day5_users || residual.rows[0].day7_users || residual.rows[0].classrooms) process.exitCode = 1;
} finally { await operational.end(); await audit.end(); }
