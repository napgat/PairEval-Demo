import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest } from "@/lib/full-system-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  return NextResponse.json({ data: { id: actor.id, email: actor.email, platformRole: actor.platformRole,
    canCreateClassroom: actor.canCreateClassroom, privacyAccepted: actor.privacyAccepted } });
}
