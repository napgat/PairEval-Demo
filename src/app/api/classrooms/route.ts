import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { actorForToken, openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { previewRosterCsv, validateClassroomName } from "@/lib/classroom-input";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!actor || actor.role !== "instructor") return NextResponse.json({ error: "เฉพาะผู้สอนที่เข้าสู่ Demo เท่านั้น" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 }); }
  const raw = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nameError = validateClassroomName(raw.name);
  const preview = previewRosterCsv(raw.csv);
  const errors = [...(nameError ? [nameError] : []), ...preview.errors];
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  const db = openDemoDb();
  const classroomId = randomUUID();
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO classrooms VALUES (?, ?, ?)").run(classroomId, (raw.name as string).trim(), "custom");
    db.prepare("INSERT INTO classroom_instructors VALUES (?, ?)").run(classroomId, actor.id);
    const groupIds = new Map<string, string>();
    const insertGroup = db.prepare("INSERT INTO groups VALUES (?, ?, ?)");
    const findUser = db.prepare("SELECT id, role FROM users WHERE email = ?");
    const insertUser = db.prepare("INSERT INTO users VALUES (?, ?, ?, 'student')");
    const insertMembership = db.prepare("INSERT INTO memberships VALUES (?, ?, ?)");
    for (const row of preview.rows) {
      let groupId = groupIds.get(row.groupname);
      if (!groupId) {
        groupId = randomUUID();
        insertGroup.run(groupId, classroomId, row.groupname);
        groupIds.set(row.groupname, groupId);
      }
      const existing = findUser.get(row.email) as { id: string; role: string } | undefined;
      if (existing?.role === "instructor") throw new Error(`แถว ${row.line}: อีเมลผู้สอนไม่สามารถอยู่ในรายชื่อนักศึกษา`);
      const userId = existing?.id ?? randomUUID();
      if (!existing) insertUser.run(userId, row.email, `นักศึกษา ${row.email.split("@")[0]}`);
      insertMembership.run(classroomId, groupId, userId);
    }
    db.exec("COMMIT");
    return NextResponse.json({ id: classroomId, students: preview.rows.length, groups: groupIds.size }, { status: 201 });
  } catch (error) {
    db.exec("ROLLBACK");
    return NextResponse.json({ errors: [error instanceof Error ? error.message : "บันทึกห้องเรียนไม่สำเร็จ"] }, { status: 422 });
  } finally { db.close(); }
}
