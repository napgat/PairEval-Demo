import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";

// Uses disposable synthetic accounts and a test-only direct session fixture. This does not test Google login
// or constitute approval of a Privacy Notice. Only PairEval operational databases are targeted.
const environment = process.argv[2] ?? "staging";
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(join(process.cwd(), environment === "development" ? ".env.local" : ".env.staging.local"));
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Operational database guard failed");
}
const origin = environment === "development" ? "http://localhost:3101" : "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const marker = randomUUID().slice(0, 8);
const ownerId = randomUUID();
const outsiderId = randomUUID();
const ownerEmail = `day2-owner-${marker}@example.test`;
const outsiderEmail = `day2-outsider-${marker}@example.test`;
const studentEmail = name => `day2-${name}-${marker}@example.test`;
const ownerToken = randomBytes(32).toString("hex");
const outsiderToken = randomBytes(32).toString("hex");
const tokenHash = value => createHash("sha256").update(value).digest("hex");
const createdUserEmails = [ownerEmail, outsiderEmail, studentEmail("a"), studentEmail("b"),
  studentEmail("new"), studentEmail("c")];
let classroomId;

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    ...(token ? { Cookie: `paireval_full_session=${token}` } : {}),
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  return { status: response.status, payload };
}

function expectStatus(result, status, label) {
  if (result.status !== status) throw new Error(`${label}: expected ${status}, got ${result.status}, code=${result.payload?.error?.code ?? "none"}`);
}

try {
  await pool.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
    VALUES ($1,$2,$2,'Synthetic Day 2 Owner','ACTIVE',true),
           ($3,$4,$4,'Synthetic Day 2 Outsider','ACTIVE',false)`, [ownerId, ownerEmail, outsiderId, outsiderEmail]);
  await pool.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version) VALUES
    ($1,'synthetic-staging-v1'),($2,'synthetic-staging-v1')`, [ownerId, outsiderId]);
  await pool.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at) VALUES
    ($1,$2,$3,now()+interval '15 minutes'),($4,$5,$6,now()+interval '15 minutes')`,
  [randomUUID(), ownerId, tokenHash(ownerToken), randomUUID(), outsiderId, tokenHash(outsiderToken)]);

  expectStatus(await api("/api/auth/session"), 401, "no session");
  expectStatus(await api("/api/auth/session", { token: ownerToken }), 200, "synthetic owner session");
  const initialCsv = `email,group_name,student_id,display_name\n${studentEmail("a")},G1,A1,Synthetic A\n${studentEmail("b")},G1,B1,Synthetic B`;
  const created = await api("/api/full-system/classrooms", { method: "POST", token: ownerToken,
    body: { name: `Synthetic Day 2 ${marker}`, csv: initialCsv } });
  expectStatus(created, 201, "classroom create");
  classroomId = created.payload?.data?.id;
  if (!classroomId) throw new Error("Classroom create did not return an ID");

  const ownerRooms = await api("/api/full-system/classrooms", { token: ownerToken });
  expectStatus(ownerRooms, 200, "owner classroom list");
  if (!ownerRooms.payload?.data?.some(room => room.id === classroomId)) throw new Error("Owner classroom is missing");
  const outsiderRooms = await api("/api/full-system/classrooms", { token: outsiderToken });
  expectStatus(outsiderRooms, 200, "outsider classroom list");
  if (outsiderRooms.payload?.data?.some(room => room.id === classroomId)) throw new Error("Cross-classroom list leak");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster`, { token: outsiderToken }),
    404, "cross-classroom roster denial");

  const before = await pool.query("SELECT roster_version FROM classroom WHERE id=$1", [classroomId]);
  const version = before.rows[0]?.roster_version;
  const rollbackCsv = `email,group_name,student_id,display_name\n${studentEmail("new")},G2,N1,Synthetic New\n${ownerEmail},G2,O1,Synthetic Owner`;
  const rollbackPreview = await api(`/api/full-system/classrooms/${classroomId}/roster/preview`, {
    method: "POST", token: ownerToken, body: { csv: rollbackCsv } });
  expectStatus(rollbackPreview, 200, "rollback preview");
  const rejectedImport = await api(`/api/full-system/classrooms/${classroomId}/roster/import`, {
    method: "POST", token: ownerToken, body: { csv: rollbackCsv, expectedVersion: version,
      confirmDigest: rollbackPreview.payload.data.digest } });
  expectStatus(rejectedImport, 422, "staff conflict import rollback");
  const afterReject = await pool.query(`SELECT c.roster_version,
    (SELECT count(*) FROM app_user WHERE email_lookup=$2)::integer AS inserted_student,
    (SELECT count(*) FROM group_entity WHERE classroom_id=$1 AND name='G2')::integer AS inserted_group
    FROM classroom c WHERE c.id=$1`, [classroomId, studentEmail("new")]);
  if (afterReject.rows[0]?.roster_version !== version || afterReject.rows[0]?.inserted_student !== 0 ||
      afterReject.rows[0]?.inserted_group !== 0) throw new Error("Roster import did not roll back atomically");

  const goodCsv = `email,group_name,student_id,display_name\n${studentEmail("a")},G1,A1,Synthetic A\n${studentEmail("b")},G1,B1,Synthetic B\n${studentEmail("c")},G1,C1,Synthetic C`;
  const preview = await api(`/api/full-system/classrooms/${classroomId}/roster/preview`, {
    method: "POST", token: ownerToken, body: { csv: goodCsv } });
  expectStatus(preview, 200, "roster preview");
  const imported = await api(`/api/full-system/classrooms/${classroomId}/roster/import`, {
    method: "POST", token: ownerToken, body: { csv: goodCsv, expectedVersion: preview.payload.data.version,
      confirmDigest: preview.payload.data.digest } });
  expectStatus(imported, 200, "roster import");
  if (imported.payload?.data?.rosterVersion !== version + 1) throw new Error("Roster version did not increase");
  const stale = await api(`/api/full-system/classrooms/${classroomId}/roster/import`, {
    method: "POST", token: ownerToken, body: { csv: goodCsv, expectedVersion: version,
      confirmDigest: preview.payload.data.digest } });
  expectStatus(stale, 409, "stale roster version");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members/${ownerId}`, {
    method: "DELETE", token: ownerToken }), 409, "final owner guard");
  expectStatus(await api("/api/auth/logout", { method: "POST", token: ownerToken }), 303, "logout");
  expectStatus(await api("/api/auth/session", { token: ownerToken }), 401, "revoked session");
  console.log(`${environment} synthetic API smoke passed: create/list/scope, atomic rollback, import/version, final-owner, logout`);
} finally {
  await pool.query("UPDATE app_session SET revoked_at=now() WHERE user_id IN ($1,$2) AND revoked_at IS NULL", [ownerId, outsiderId]).catch(() => {});
  if (classroomId) {
    await pool.query("DELETE FROM classroom_member WHERE classroom_id=$1", [classroomId]);
    await pool.query("DELETE FROM group_entity WHERE classroom_id=$1", [classroomId]);
    await pool.query("DELETE FROM classroom WHERE id=$1", [classroomId]);
  }
  await pool.query("DELETE FROM app_session WHERE user_id IN ($1,$2)", [ownerId, outsiderId]);
  await pool.query("DELETE FROM privacy_notice_acceptance WHERE user_id IN ($1,$2)", [ownerId, outsiderId]);
  await pool.query("DELETE FROM app_user WHERE email_lookup = ANY($1::text[])", [createdUserEmails]);
  await pool.end();
}
