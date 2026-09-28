import { NextResponse, type NextRequest } from "next/server";
import { actorForToken, openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { getPairingPreview, savePairingPlan } from "@/lib/pairing-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function authorizedDb(request: NextRequest, assignmentId: string) {
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!actor || actor.role !== "instructor") return null;
  const db = openDemoDb();
  const allowed = db.prepare("SELECT 1 FROM assignments JOIN classroom_instructors ON classroom_instructors.classroom_id = assignments.classroom_id WHERE assignments.id = ? AND classroom_instructors.user_id = ?").get(assignmentId, actor.id);
  if (!allowed) { db.close(); return null; }
  return db;
}

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const db = authorizedDb(request, id);
  if (!db) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูการจัดคู่" }, { status: 403 });
  try {
    const preview = getPairingPreview(db, id);
    return preview ? NextResponse.json(preview) : NextResponse.json({ error: "ไม่พบงานประเมิน" }, { status: 404 });
  } finally { db.close(); }
}

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const db = authorizedDb(request, id);
  if (!db) return NextResponse.json({ error: "ไม่มีสิทธิ์สร้างคู่" }, { status: 403 });
  try {
    const result = savePairingPlan(db, id);
    const status = result.result === "created" ? 201 : result.result === "infeasible" ? 422 : result.result === "already_exists" ? 409 : 404;
    return NextResponse.json(result, { status });
  } finally { db.close(); }
}
