import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

const action = process.argv[2];
if (!["status", "apply"].includes(action)) throw new Error("Use status or apply");
process.loadEnvFile(".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== "staging" || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("Staging operational database guard failed");
}
const teacherEmail = process.env.PAIR_EVAL_TEACHER_EMAIL?.trim().toLowerCase();
const studentEmail = process.env.PAIR_EVAL_STUDENT_EMAIL?.trim().toLowerCase();
if (!teacherEmail || !studentEmail || teacherEmail === studentEmail ||
    ![teacherEmail, studentEmail].every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
  throw new Error("Two distinct demo-access email addresses are required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const manifestPath = join(process.cwd(), ".verification", "staging-demo-access.json");
try {
  const existing = await pool.query(
    "SELECT email_lookup FROM app_user WHERE email_lookup=ANY($1::text[])", [[teacherEmail, studentEmail]]);
  if (action === "status") {
    const roles = await pool.query(`SELECT u.email_lookup,u.status,u.can_create_classroom,
      m.role,c.name AS classroom_name,p.notice_version
      FROM app_user u LEFT JOIN classroom_member m ON m.user_id=u.id
      LEFT JOIN classroom c ON c.id=m.classroom_id AND c.status='ACTIVE'
      LEFT JOIN privacy_notice_acceptance p ON p.user_id=u.id
      WHERE u.email_lookup=ANY($1::text[])`, [[teacherEmail, studentEmail]]);
    const account = email => roles.rows.filter(row => row.email_lookup === email).map(row => ({
      status: row.status, role: row.role, canCreateClassroom: row.can_create_classroom,
      classroom: row.classroom_name, noticeAcknowledged: row.notice_version === "student-demo-staging-v1" }));
    console.log(JSON.stringify({ teacher: account(teacherEmail), student: account(studentEmail),
      localManifestExists: existsSync(manifestPath) }));
  } else {
    if (existing.rowCount || existsSync(manifestPath)) {
      throw new Error("An account or local manifest already exists; refusing to overwrite demo access");
    }
    const teacherId = randomUUID(), studentId = randomUUID(), classroomId = randomUUID();
    const groups = [randomUUID(), randomUUID(), randomUUID()];
    const suffix = randomUUID().slice(0, 8);
    const syntheticIds = Array.from({ length: 11 }, () => randomUUID());
    const manifest = { teacherEmail, studentEmail, teacherId, studentId, classroomId, groups,
      syntheticIds, slug: `student-preview-${suffix}` };
    await mkdir(join(process.cwd(), ".verification"), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO app_user
        (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,'Demo Teacher','PENDING',true),
               ($3,$4,$4,'Demo Student','PENDING',false)`, [teacherId, teacherEmail, studentId, studentEmail]);
      await client.query(`INSERT INTO classroom (id,name,slug,timezone,created_by)
        VALUES ($1,'PairEval Student Project Preview',$2,'Asia/Bangkok',$3)`,
      [classroomId, manifest.slug, teacherId]);
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
        VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), classroomId, teacherId]);
      for (let index = 0; index < groups.length; index++) {
        await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,$3)",
          [groups[index], classroomId, `Synthetic Group ${index + 1}`]);
      }
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
        VALUES ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), classroomId, studentId, groups[0]]);
      for (let index = 0; index < syntheticIds.length; index++) {
        const email = `staging-preview-${suffix}-${index + 1}@example.test`;
        await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status)
          VALUES ($1,$2,$2,$3,'ACTIVE')`,
        [syntheticIds[index], email, `Synthetic Classmate ${index + 1}`]);
        const groupIndex = index < 3 ? 0 : index < 7 ? 1 : 2;
        await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
          VALUES ($1,$2,$3,'STUDENT',$4)`,
        [randomUUID(), classroomId, syntheticIds[index], groups[groupIndex]]);
      }
      await client.query("COMMIT");
      console.log("Staging demo access created: teacher OWNER, student STUDENT, 11 synthetic classmates, no assignments or scores");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      await unlink(manifestPath).catch(() => {});
      throw error;
    } finally { client.release(); }
  }
} finally { await pool.end(); }
