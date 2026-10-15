import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { actorForToken, openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { getEvaluationView, writeEvaluation, type EvaluationKind } from "@/lib/evaluation-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; kind: string }> };
const noStore = { "Cache-Control": "no-store" };

function identity(request: NextRequest, kind: string) {
  if (kind !== "group" && kind !== "individual") return null;
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  return actor?.role === "student" ? { actorId: actor.id, kind: kind as EvaluationKind } : null;
}

async function GETHandler(request: NextRequest, context: Context) {
  const { id, kind } = await context.params;
  const user = identity(request, kind);
  if (!user) return NextResponse.json({ error: "เฉพาะนักศึกษาที่เข้าสู่ Demo เท่านั้น" }, { status: 403, headers: noStore });
  const db = openDemoDb({ readOnly: true });
  try {
    const view = getEvaluationView(db, id, user.kind, user.actorId);
    return view ? NextResponse.json(view, { headers: noStore }) : NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงงานนี้" }, { status: 403, headers: noStore });
  } finally { db.close(); }
}

async function write(request: NextRequest, context: Context, action: "draft" | "submit") {
  const { id, kind } = await context.params;
  const user = identity(request, kind);
  if (!user) return NextResponse.json({ error: "เฉพาะนักศึกษาที่เข้าสู่ Demo เท่านั้น" }, { status: 403, headers: noStore });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const answers = payload && typeof payload === "object" && !Array.isArray(payload) && "answers" in payload ? (payload as { answers: unknown }).answers : undefined;
  const db = openDemoDb();
  try {
    const result = writeEvaluation(db, id, user.kind, user.actorId, answers, action);
    return result.view ? NextResponse.json(result.view, { headers: noStore }) : NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  } finally { db.close(); }
}

async function PUTHandler(request: NextRequest, context: Context) { return write(request, context, "draft"); }
async function POSTHandler(request: NextRequest, context: Context) { return write(request, context, "submit"); }

export const GET = observeRoute(GETHandler);
export const PUT = observeRoute(PUTHandler);
export const POST = observeRoute(POSTHandler);
