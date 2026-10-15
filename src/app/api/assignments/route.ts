import { observeRoute } from "@/lib/observe-route";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { actorForToken, openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { validateAssignment } from "@/lib/assignment-input";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!actor || actor.role !== "instructor") return NextResponse.json({ error: "เฉพาะผู้สอนที่เข้าสู่ Demo เท่านั้น" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 }); }
  const result = validateAssignment(payload);
  if (!result.value) return NextResponse.json({ errors: result.errors }, { status: 422 });
  const value = result.value;
  const db = openDemoDb();
  const assignmentId = randomUUID();
  try {
    const allowed = db.prepare("SELECT 1 FROM classroom_instructors WHERE classroom_id = ? AND user_id = ?").get(value.classroomId, actor.id);
    if (!allowed) return NextResponse.json({ error: "ไม่มีสิทธิ์จัดการห้องนี้" }, { status: 403 });
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO assignments VALUES (?, ?, ?, ?, ?, ?, ?)").run(assignmentId, value.classroomId, value.name, value.groupMax, value.individualMax, value.groupDeadline, value.individualDeadline);
    const insertCriterion = db.prepare("INSERT INTO criteria VALUES (?, ?, ?, ?, ?)");
    for (const criterion of value.groupCriteria) insertCriterion.run(randomUUID(), assignmentId, "group", criterion.name, criterion.weightPercent);
    for (const criterion of value.individualCriteria) insertCriterion.run(randomUUID(), assignmentId, "individual", criterion.name, criterion.weightPercent);
    db.exec("COMMIT");
    return NextResponse.json({ id: assignmentId }, { status: 201 });
  } catch (error) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกงานไม่สำเร็จ" }, { status: 422 });
  } finally { db.close(); }
}

export const POST = observeRoute(POSTHandler);
