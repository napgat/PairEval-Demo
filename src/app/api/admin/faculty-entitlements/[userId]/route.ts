import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin } from "@/lib/full-system-auth";
import { AuditUnavailableError } from "@/lib/full-system-audit";
import { EntitlementInputError, EntitlementNotFoundError, setFacultyEntitlement } from "@/lib/full-system-entitlements";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  if (actor.platformRole !== "SYSTEM_ADMIN") return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  try {
    const { userId } = await context.params;
    const body = await request.json();
    const result = await setFacultyEntitlement(actor, userId, body?.canCreateClassroom, body?.reason);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
    if (error instanceof EntitlementNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    if (error instanceof EntitlementInputError) return NextResponse.json({ error: { code: "ENTITLEMENT_INVALID" } }, { status: 422 });
    return NextResponse.json({ error: { code: "ENTITLEMENT_UPDATE_FAILED" } }, { status: 500 });
  }
}
