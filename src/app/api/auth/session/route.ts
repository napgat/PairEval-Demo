import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, refreshFullSession, sameOrigin, FULL_SESSION_COOKIE, SESSION_SECONDS } from "@/lib/full-system-auth";

export const runtime = "nodejs";

async function GETHandler(request: NextRequest) {
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  return NextResponse.json({ data: { id: actor.id, email: actor.email, platformRole: actor.platformRole,
    canCreateClassroom: actor.canCreateClassroom, privacyAccepted: actor.privacyAccepted } });
}

async function POSTHandler(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const token = request.cookies.get(FULL_SESSION_COOKIE)?.value;
  if (!token || !await refreshFullSession(token)) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const response = NextResponse.json({ data: { refreshed: true } }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(FULL_SESSION_COOKIE, token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  return response;
}

export const GET = observeRoute(GETHandler);
export const POST = observeRoute(POSTHandler);
