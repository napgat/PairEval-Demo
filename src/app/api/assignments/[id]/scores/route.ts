import { NextResponse, type NextRequest } from "next/server";
import { actorForToken, openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { getAssignmentScore, getPairAnswerCoverage, mayViewOwnScore, mayViewReport, scoreStatus } from "@/lib/score-store";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!actor) return NextResponse.json({ error: "ต้องเข้าสู่ระบบเดโม" }, { status: 401, headers });
  const db = openDemoDb({ readOnly: true });
  try {
    const allowed = actor.role === "instructor" ? mayViewReport(db, id, actor.id) : mayViewOwnScore(db, id, actor.id);
    if (!allowed) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูคะแนนงานนี้" }, { status: 403, headers });
    const score = getAssignmentScore(db, id);
    if (!score) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404, headers });
    const status = scoreStatus(score);
    if (actor.role === "instructor") return NextResponse.json({ assignmentId: id, status, ...score.result, pairCoverage: getPairAnswerCoverage(db, id) }, { headers });
    const own = score.result.students.find(student => student.id === actor.id);
    if (!own) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 403, headers });
    return NextResponse.json({ assignmentId: id, status, score: own }, { headers });
  } finally { db.close(); }
}
