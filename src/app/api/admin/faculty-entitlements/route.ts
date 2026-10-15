import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest } from "@/lib/full-system-auth";
import { listFacultyEntitlements } from "@/lib/full-system-entitlements";

export const runtime = "nodejs";

async function GETHandler(request: NextRequest) {
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  if (actor.platformRole !== "SYSTEM_ADMIN") return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const cursor = url.searchParams.get("cursor");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || cursor && !/^[0-9a-f-]{36}$/i.test(cursor)) {
    return NextResponse.json({ error: { code: "QUERY_INVALID" } }, { status: 400 });
  }
  return NextResponse.json({ data: await listFacultyEntitlements(limit, cursor) });
}

export const GET = observeRoute(GETHandler);
