import { NextResponse, type NextRequest } from "next/server";
import { actorForToken, openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { getAssignmentScore, makeScoreCsv, mayViewReport } from "@/lib/score-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (actor?.role !== "instructor") return NextResponse.json({ error: "เฉพาะผู้สอน" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const db = openDemoDb({ readOnly: true });
  try {
    if (!mayViewReport(db, id, actor.id)) return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งออกงานนี้" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const score = getAssignmentScore(db, id);
    if (!score) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
    return new NextResponse(makeScoreCsv(score), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="paireval-${encodeURIComponent(id)}-scores.csv"`, "Cache-Control": "no-store" } });
  } finally { db.close(); }
}
