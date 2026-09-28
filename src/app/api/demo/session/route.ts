import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { openDemoDb } from "@/lib/demo-data";
import { SESSION_COOKIE } from "@/lib/demo-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const role = form.get("role");
  if (role !== "instructor" && role !== "student") return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
  const userId = role === "instructor" ? "instructor-01" : "student-01";
  const token = randomBytes(32).toString("hex");
  const db = openDemoDb();
  try {
    db.prepare("INSERT INTO demo_sessions VALUES (?, ?, ?)").run(token, userId, new Date().toISOString());
  } finally { db.close(); }
  const response = NextResponse.redirect(new URL(`/demo/${role}`, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}
