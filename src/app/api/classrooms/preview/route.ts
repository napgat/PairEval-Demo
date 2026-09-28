import { NextResponse, type NextRequest } from "next/server";
import { actorForToken } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";
import { previewRosterCsv } from "@/lib/classroom-input";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = actorForToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!actor || actor.role !== "instructor") return NextResponse.json({ error: "เฉพาะผู้สอนที่เข้าสู่ Demo เท่านั้น" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 }); }
  const csv = payload && typeof payload === "object" && "csv" in payload ? (payload as { csv: unknown }).csv : undefined;
  const preview = previewRosterCsv(csv);
  return NextResponse.json(preview, { status: preview.errors.length ? 422 : 200 });
}
