import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const action = process.argv[2];
if (!["create", "remove"].includes(action)) throw new Error("Use create or remove");
process.loadEnvFile(join(process.cwd(), ".env.staging.local"));
process.loadEnvFile(join(process.cwd(), ".env.test-user.local"));
if (process.env.PAIR_EVAL_ENV !== "staging" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}
const email = process.env.PAIR_EVAL_TEST_EMAIL?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Test email is missing");
const manifestFile = join(process.cwd(), ".verification", "day2-oidc-fixture.json");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });

try {
  if (action === "create") {
    if (existsSync(manifestFile)) throw new Error("OIDC fixture manifest already exists");
    const existing = await pool.query("SELECT 1 FROM app_user WHERE email_lookup=$1", [email]);
    if (existing.rowCount) throw new Error("Test email is already enrolled; fixture will not overwrite it");
    const ownerId = randomUUID();
    const userId = randomUUID();
    const classroomId = randomUUID();
    const groupId = randomUUID();
    const ownerEmail = `day2-oidc-owner-${ownerId.slice(0, 8)}@example.test`;
    await mkdir(join(process.cwd(), ".verification"), { recursive: true });
    await writeFile(manifestFile, JSON.stringify({ email, ownerId, userId, classroomId, groupId }, null, 2) + "\n",
      { flag: "wx", mode: 0o600 });
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,'Synthetic OIDC Owner','ACTIVE',true),
               ($3,$4,$4,'Authorized Test Account','PENDING',false)`, [ownerId, ownerEmail, userId, email]);
      await client.query(`INSERT INTO classroom (id,name,slug,created_by) VALUES
        ($1,'Synthetic OIDC Login Class',$2,$3)`, [classroomId, `day2-oidc-${classroomId.slice(0, 8)}`, ownerId]);
      await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,'Synthetic Group')", [groupId, classroomId]);
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role) VALUES ($1,$2,$3,'OWNER')`,
        [randomUUID(), classroomId, ownerId]);
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id) VALUES
        ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), classroomId, userId, groupId]);
      await client.query("COMMIT");
    } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); await unlink(manifestFile).catch(() => {}); throw error; }
    finally { client?.release(); }
    console.log("OIDC staging fixture created for the authorized test account; classroom data remains privacy-gated");
  } else {
    const fixture = JSON.parse(await readFile(manifestFile, "utf8"));
    if (fixture.email !== email) throw new Error("Fixture email mismatch");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM app_session WHERE user_id=$1", [fixture.userId]);
      await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=$1", [fixture.userId]);
      await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [fixture.classroomId]);
      await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [fixture.classroomId]);
      await client.query("DELETE FROM classroom WHERE id=$1", [fixture.classroomId]);
      await client.query("DELETE FROM app_user WHERE id IN ($1,$2)", [fixture.ownerId, fixture.userId]);
      await client.query("COMMIT");
      await unlink(manifestFile);
      console.log("OIDC staging fixture removed; test account sessions revoked");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
} finally { await pool.end(); }
