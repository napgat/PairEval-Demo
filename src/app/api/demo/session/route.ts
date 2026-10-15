import { observeRoute } from "@/lib/observe-route";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
  const form = await request.formData();
  const role = form.get("role");
  if (role !== "instructor" && role !== "student") return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
  const selectedId = form.get("userId");
  const userId = role === "instructor" ? "instructor-01" : typeof selectedId === "string" && selectedId ? selectedId : "student-01";
  const token = randomBytes(32).toString("hex");
  const db = openDemoDb();
  try {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = ?").get(userId, role)) return NextResponse.json({ error: "ไม่พบบัญชีตัวอย่างสำหรับบทบาทนี้" }, { status: 400 });
    db.prepare("INSERT INTO demo_sessions VALUES (?, ?, ?)").run(token, userId, new Date().toISOString());
  } finally { db.close(); }
  const response = NextResponse.redirect(new URL(`/demo/${role}`, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

export const POST = observeRoute(POSTHandler);
