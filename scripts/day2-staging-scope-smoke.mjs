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
const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const emails = users.map((_, index) => `day2-scope-${index}-${suffix}@example.test`);
const classroomId = randomUUID();
const groupId = randomUUID();
const tokens = users.map(() => randomBytes(32).toString("hex"));
const hash = token => createHash("sha256").update(token).digest("hex");

async function request(path, token, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, { method, headers: {
    Cookie: `paireval_full_session=${token}`,
    ...(method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json" }),
  }, body: body ? JSON.stringify(body) : undefined });
  const payload = (response.headers.get("content-type") ?? "").includes("application/json") ? await response.json() : null;
  return { status: response.status, payload };
}
function expectStatus(result, status, label) {
  if (result.status !== status) throw new Error(`${label}: expected ${status}, got ${result.status}, code=${result.payload?.error?.code ?? "none"}`);
}

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < users.length; index++) {
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [users[index], emails[index], `Synthetic ${index}`, index === 0]);
      if (index !== 3) await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
        VALUES ($1,'synthetic-staging-v1')`, [users[index]]);
      await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '15 minutes')`, [randomUUID(), users[index], hash(tokens[index])]);
    }
    await client.query(`INSERT INTO classroom (id,name,slug,created_by) VALUES
      ($1,'Synthetic Scope Class',$2,$3)`, [classroomId, `day2-scope-${suffix}`, users[0]]);
    await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,'Synthetic Group')", [groupId, classroomId]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role) VALUES ($1,$2,$3,'OWNER')`,
      [randomUUID(), classroomId, users[0]]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id) VALUES
      ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), classroomId, users[2], groupId]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }

  const ownerList = await request("/api/full-system/classrooms", tokens[0]);
  expectStatus(ownerList, 200, "owner list");
  if (!ownerList.payload?.data?.some(room => room.id === classroomId)) throw new Error("Owner classroom missing");
  const outsiderList = await request("/api/full-system/classrooms", tokens[1]);
  expectStatus(outsiderList, 200, "outsider list");
  if (outsiderList.payload?.data?.some(room => room.id === classroomId)) throw new Error("Classroom leaked to outsider");
  expectStatus(await request(`/api/full-system/classrooms/${classroomId}/roster`, tokens[0]), 200, "owner roster");
  expectStatus(await request(`/api/full-system/classrooms/${classroomId}/roster`, tokens[1]), 404, "outsider direct roster");
  expectStatus(await request(`/api/full-system/classrooms/${classroomId}/roster`, tokens[2]), 403, "student roster");
  expectStatus(await request(`/api/full-system/classrooms/${classroomId}/roster/preview`, tokens[2], "POST",
    { csv: "email,group_name\nsynthetic@example.test,G1" }), 403, "student preview");
  expectStatus(await request("/api/full-system/classrooms", tokens[3]), 428, "privacy gate");
  console.log("Staging synthetic scope smoke passed: owner, outsider, student, direct API, privacy gate");
} finally {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [classroomId]);
      await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [classroomId]);
      await client.query("DELETE FROM classroom WHERE id=$1", [classroomId]);
      await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [users]);
      await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [users]);
      await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [users]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } finally { await pool.end(); }
}
