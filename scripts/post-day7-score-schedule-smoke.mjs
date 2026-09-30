import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const environment = process.argv[2] ?? "development";
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
const mode = process.argv[3] ?? "direct";
if (!["direct", "ui-prepare", "ui-verify"].includes(mode)) throw new Error("Use direct, ui-prepare or ui-verify");
const stateFile = join(process.cwd(), ".verification", `scheduled-score-${environment}.json`);
if (mode === "ui-prepare" && existsSync(stateFile)) throw new Error("Previous UI fixture must be verified and cleaned first");
const saved = mode === "ui-verify" ? JSON.parse(readFileSync(stateFile, "utf8")) : null;
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational database guard failed");
}
const origin = process.env.PAIR_EVAL_SCORE_CRON_ORIGIN ?? (environment === "development" ?
  "http://localhost:3102" : "https://paireval-full-staging.vercel.app");
const token = process.env.CRON_SECRET;
if (mode === "direct" && (!token || Buffer.byteLength(token) < 16)) throw new Error("CRON_SECRET required for direct score smoke");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
  connectionTimeoutMillis: 30000 });
const owner = saved?.owner ?? randomUUID(), student = saved?.student ?? randomUUID();
const room = saved?.room ?? randomUUID(), group = saved?.group ?? randomUUID();
const assignment = saved?.assignment ?? randomUUID(), generation = saved?.generation ?? randomUUID();
const suffix = randomUUID().slice(0, 8);
let fixtureCreated = mode === "ui-verify";
let retainFixture = false;
async function cron(authorization) {
  const response = await fetch(`${origin}/api/full-system/cron/scores`, { method: "POST",
    headers: { Authorization: `Bearer ${authorization}` } });
  const payload = await response.json();
  return { status: response.status, payload };
}
try {
 if (mode !== "ui-verify") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [id, role] of [[owner, "owner"], [student, "student"]]) {
      const email = `score-schedule-${role}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user(id,email_lookup,email_raw,display_name,status)
        VALUES ($1,$2,$2,$3,'ACTIVE')`, [id, email, `Synthetic score ${role}`]);
    }
    await client.query(`INSERT INTO classroom(id,name,slug,created_by,timezone)
      VALUES ($1,$2,$3,$4,'Asia/Bangkok')`, [room, `Synthetic score ${suffix}`, `score-schedule-${suffix}`, owner]);
    await client.query(`INSERT INTO group_entity(id,classroom_id,name) VALUES ($1,$2,'G1')`, [group, room]);
    await client.query(`INSERT INTO classroom_member(id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), room, owner]);
    await client.query(`INSERT INTO classroom_member(id,classroom_id,user_id,role,group_id)
      VALUES ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), room, student, group]);
    await client.query(`INSERT INTO assignment(id,classroom_id,name,slug,group_max_score,
      individual_max_score,generation,status,published_at,created_by)
      VALUES ($1,$2,'Synthetic scheduled score','scheduled-score',0,0,1,'OPEN',
        now()-interval '2 days',$3)`, [assignment, room, owner]);
    await client.query(`INSERT INTO assignment_generation(id,assignment_id,generation,seed,status)
      VALUES ($1,$2,1,'synthetic-scheduler','ACTIVE')`, [generation, assignment]);
    await client.query("COMMIT"); fixtureCreated = true;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
 }

 if (mode === "ui-prepare") {
  mkdirSync(join(process.cwd(), ".verification"), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ owner, student, room, group, assignment, generation,
    preparedAt: new Date().toISOString() }));
  retainFixture = true;
  console.log(`${environment} synthetic score fixture ready for Vercel Cron Jobs > scores > Run`);
 } else {
 if (mode === "direct") {
  const denied = await cron(`${token}wrong`);
  if (denied.status !== 404) throw new Error(`Unauthorized scheduler returned ${denied.status}`);
  const parallel = await Promise.all([cron(token), cron(token)]);
  if (parallel.some(result => result.status !== 200 || result.payload?.data?.failed !== 0) ||
      parallel.reduce((sum, result) => sum + result.payload.data.created, 0) !== 1) {
    throw new Error(`Concurrent scheduler calls were not idempotent: ${parallel.map(v => v.status).join(",")}`);
  }
  const second = await cron(token);
  if (second.status !== 200 || second.payload?.data?.failed !== 0 || second.payload?.data?.created !== 0) {
    throw new Error(`Scheduler replay was not idempotent: ${second.status}`);
  }
 }
  const evidence = await pool.query(`SELECT r.local_date,r.snapshot_id,s.kind,s.created_by,
    (SELECT count(*)::integer FROM scheduled_score_run WHERE assignment_id=$1) AS runs,
    (SELECT count(*)::integer FROM score_snapshot WHERE assignment_id=$1) AS snapshots
    FROM scheduled_score_run r JOIN score_snapshot s ON s.id=r.snapshot_id
    WHERE r.assignment_id=$1`, [assignment]);
  const row = evidence.rows[0];
  if (row?.runs !== 1 || row.snapshots !== 1 || row.kind !== "INTERIM" ||
      row.created_by !== "00000000-0000-4000-8000-000000000026") {
    throw new Error("Scheduled score snapshot or idempotency evidence mismatched");
  }
  if (mode === "ui-verify") {
    const invocation = await pool.query(`SELECT count(*)::integer AS n FROM score_job_invocation
      WHERE origin='VERCEL_CRON' AND status='COMPLETED' AND started_at >= $1::timestamptz
        AND (result_json->>'created')::integer >= 1`, [saved.preparedAt]);
    if (invocation.rows[0].n < 1) throw new Error("No completed Vercel manual Run invocation for fixture");
    console.log(`${environment} Vercel manual Cron Run passed: Interim snapshot, schedule key and invocation evidence`);
  } else console.log(`${environment} scheduled score smoke passed: denied token, concurrent due snapshot and retry`);
 }
} finally {
  if (fixtureCreated && !retainFixture) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM scheduled_score_run WHERE assignment_id=$1", [assignment]);
      await client.query(`DELETE FROM score_snapshot_item WHERE score_snapshot_id IN
        (SELECT id FROM score_snapshot WHERE assignment_id=$1)`, [assignment]);
      await client.query("DELETE FROM score_snapshot WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM assignment_generation WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM assignment WHERE id=$1", [assignment]);
      await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [room]);
      await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [room]);
      await client.query("DELETE FROM classroom WHERE id=$1", [room]);
      await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [[owner, student]]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
    finally { client.release(); }
    if (mode === "ui-verify") unlinkSync(stateFile);
  }
  await pool.end();
}
