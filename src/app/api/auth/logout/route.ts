import { NextResponse, type NextRequest } from "next/server";
import { FULL_SESSION_COOKIE, revokeFullSession, sameOrigin } from "@/lib/full-system-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  }
  await revokeFullSession(request.cookies.get(FULL_SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(new URL("/full-system", request.url), { status: 303 });
  response.cookies.set(FULL_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
