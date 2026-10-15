import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd();
let existing = "";
try {
  existing = await readFile(".env.local", "utf8");
} catch {}
const prior = Object.fromEntries(
  existing
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (prior.PAIR_EVAL_ENV && !["development"].includes(prior.PAIR_EVAL_ENV))
  throw Error("This helper only manages synthetic development databases");
if (
  prior.DATABASE_URL &&
  !["127.0.0.1", "localhost"].includes(new URL(prior.DATABASE_URL).hostname)
)
  throw Error("Refusing to replace a remote database configuration");
const directory = resolve(
    prior.PAIR_EVAL_LOCAL_PGDATA || ".verification/local-postgres",
  ),
  port = 55432;
const pass = prior.DATABASE_URL
  ? new URL(prior.DATABASE_URL).password
  : randomBytes(24).toString("hex");
const auditPass = prior.AUDIT_DATABASE_URL
  ? new URL(prior.AUDIT_DATABASE_URL).password
  : randomBytes(24).toString("hex");
await mkdir(directory, { recursive: true });
const server = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password: pass,
  port,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let initialized = false;
try {
  await access(directory + "/PG_VERSION");
  initialized = true;
} catch {}
if (!initialized) await server.initialise();
await server.start();
const operationalDb = "paireval_review_utf8",
  auditDb = "paireval_review_audit_utf8";
const admin = server.getPgClient("postgres", "127.0.0.1");
await admin.connect();
for (const name of [operationalDb, auditDb])
  if (
    !(await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount
  )
    await admin.query(
      `CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
await admin.end();
const audit = server.getPgClient(auditDb, "127.0.0.1");
await audit.connect();
await audit.query(await readFile("db/audit/001_audit.sql", "utf8"));
if (
  !(await audit.query("SELECT 1 FROM pg_roles WHERE rolname='neon_superuser'"))
    .rowCount
)
  await audit.query("CREATE ROLE neon_superuser NOLOGIN");
if (
  !(
    await audit.query(
      "SELECT 1 FROM pg_roles WHERE rolname='paireval_audit_app'",
    )
  ).rowCount
)
  await audit.query(
    `CREATE ROLE paireval_audit_app LOGIN PASSWORD '${auditPass}'`,
  );
await audit.query(`GRANT CONNECT ON DATABASE ${auditDb} TO paireval_audit_app`);
await audit.query("GRANT USAGE ON SCHEMA public TO paireval_audit_app");
await audit.query("GRANT SELECT,INSERT ON audit_event TO paireval_audit_app");
await audit.end();
const config = {
  ...prior,
  PAIR_EVAL_ENV: "development",
  DATABASE_URL: `postgresql://postgres:${pass}@127.0.0.1:${port}/${operationalDb}`,
  PAIR_EVAL_EXPECTED_DB_HOST: "127.0.0.1",
  AUDIT_DATABASE_URL: `postgresql://paireval_audit_app:${auditPass}@localhost:${port}/${auditDb}`,
  PAIR_EVAL_LOCAL_PGDATA: directory,
  APP_ORIGIN: "http://localhost:3101",
  PAIR_EVAL_ACADEMIC_START_MONTH: prior.PAIR_EVAL_ACADEMIC_START_MONTH || "8",
};
for (const key of [
  "PAIR_EVAL_EXPORT_KEY",
  "PAIR_EVAL_PRIVACY_KEY",
  "PAIR_EVAL_BACKUP_KEY",
  "CRON_SECRET",
])
  config[key] ||= randomBytes(32).toString("hex");
await writeFile(
  root + "/.env.local",
  Object.entries(config)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
console.log(
  "Local UTF-8 PostgreSQL ready; synthetic operational and append-only audit databases are separate",
);
await new Promise((r) => {
  process.once("SIGINT", r);
  process.once("SIGTERM", r);
});
await server.stop();
