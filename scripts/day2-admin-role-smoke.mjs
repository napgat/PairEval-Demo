import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

process.loadEnvFile(".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== "staging" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}

const origin = "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const suffix = randomUUID().slice(0, 8);
const userIds = Array.from({ length: 6 }, () => randomUUID());
const [, ownerId, outsiderId, staffId, taId, studentId] = userIds;
const emails = userIds.map((_, index) => `day2-role-${index}-${suffix}@example.test`);
const tokens = userIds.map(() => randomBytes(32).toString("hex"));
const classroomId = randomUUID();
const groupId = randomUUID();
const hash = token => createHash("sha256").update(token).digest("hex");

async function api(path, token, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    Cookie: `paireval_full_session=${token}`,
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < userIds.length; index++) {
      await client.query(`INSERT INTO app_user
        (id,email_lookup,email_raw,display_name,status,platform_role,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4,$5)`, [userIds[index], emails[index],
        `Synthetic Role ${index}`, index === 0 ? "SYSTEM_ADMIN" : "USER", index === 1]);
      await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
        VALUES ($1,'synthetic-staging-v1')`, [userIds[index]]);
      await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '15 minutes')`, [randomUUID(), userIds[index], hash(tokens[index])]);
    }
    await client.query(`INSERT INTO classroom (id,name,slug,created_by)
      VALUES ($1,$2,$3,$4)`, [classroomId, `Synthetic Role ${suffix}`, `day2-role-${suffix}`, ownerId]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), classroomId, ownerId]);
    await client.query(`INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,'Synthetic Group')`, [groupId, classroomId]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
      VALUES ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), classroomId, studentId, groupId]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }

  expectStatus(await api("/api/admin/faculty-entitlements", tokens[1]), 403, "non-admin entitlement list");
  expectStatus(await api("/api/admin/faculty-entitlements?limit=2", tokens[0]), 200, "admin entitlement list");
  expectStatus(await api("/api/full-system/classrooms", tokens[0]), 200, "admin classroom list");
  const adminRooms = await api("/api/full-system/classrooms", tokens[0]);
  if (adminRooms.payload?.data?.some(room => room.id === classroomId)) throw new Error("Admin inherited classroom access");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster`, tokens[0]), 404, "admin direct roster denial");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster`, tokens[5]), 403, "student roster denial");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster/preview`, tokens[5], "POST",
    { csv: "email,group_name\nstudent@example.test,G1" }), 403, "student preview denial");
  expectStatus(await api("/api/full-system/classrooms", tokens[5], "POST",
    { name: "Synthetic denied", csv: "email,group_name\nstudent@example.test,G1" }), 403, "student classroom create denial");
  const expired = randomBytes(32).toString("hex");
  const revoked = randomBytes(32).toString("hex");
  await pool.query(`INSERT INTO app_session (id,user_id,token_hash,created_at,expires_at)
    VALUES ($1,$2,$3,now()-interval '2 hours',now()-interval '1 hour')`,
  [randomUUID(), ownerId, hash(expired)]);
  await pool.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at,revoked_at)
    VALUES ($1,$2,$3,now()+interval '1 hour',now())`, [randomUUID(), ownerId, hash(revoked)]);
  expectStatus(await api("/api/auth/session", expired), 401, "expired session denial");
  expectStatus(await api("/api/auth/session", revoked), 401, "revoked session denial");
  expectStatus(await api(`/api/admin/faculty-entitlements/${outsiderId}`, tokens[1], "PUT",
    { canCreateClassroom: true, reason: "synthetic entitlement test" }), 403, "non-admin entitlement change");
  expectStatus(await api(`/api/admin/faculty-entitlements/${outsiderId}`, tokens[0], "PUT",
    { canCreateClassroom: true, reason: "synthetic entitlement test" }), 200, "admin grants entitlement");
  const granted = await pool.query("SELECT can_create_classroom FROM app_user WHERE id=$1", [outsiderId]);
  if (granted.rows[0]?.can_create_classroom !== true) throw new Error("Entitlement grant not committed");

  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members`, tokens[2], "POST",
    { userId: staffId, role: "TA" }), 404, "outsider adds staff");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members`, tokens[1], "POST",
    { userId: staffId, role: "CO_TEACHER" }), 201, "owner adds staff");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster`, tokens[3]), 200, "co-teacher roster");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster/preview`, tokens[3], "POST",
    { csv: "email,group_name\nstudent@example.test,G1" }), 200, "co-teacher roster preview");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members`, tokens[3], "POST",
    { userId: taId, role: "TA" }), 404, "co-teacher cannot add staff");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members`, tokens[1], "POST",
    { userId: taId, role: "TA" }), 201, "owner adds TA");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/roster`, tokens[4]), 200, "TA roster");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members/${staffId}`, tokens[4], "DELETE"),
    404, "TA cannot remove staff");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members/${staffId}`, tokens[2], "DELETE"),
    404, "outsider removes staff");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members/${staffId}`, tokens[1], "DELETE"),
    204, "owner removes staff");
  const withdrawn = await pool.query(`SELECT membership_status FROM classroom_member
    WHERE classroom_id=$1 AND user_id=$2`, [classroomId, staffId]);
  if (withdrawn.rows[0]?.membership_status !== "WITHDRAWN") throw new Error("Staff withdrawal not committed");
  expectStatus(await api(`/api/full-system/classrooms/${classroomId}/members/${ownerId}`, tokens[1], "DELETE"),
    409, "final owner guard");
  console.log("Staging synthetic role/session smoke passed: admin, owner, co-teacher, TA, student, outsider, expiry/revocation, entitlement, final-owner guard");
} finally {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [classroomId]);
    await client.query("DELETE FROM group_entity WHERE id=$1", [groupId]);
    await client.query("DELETE FROM classroom WHERE id=$1", [classroomId]);
    await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [userIds]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
