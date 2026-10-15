import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin } from "@/lib/full-system-auth";
import { AuditOutcomePendingError, AuditUnavailableError } from "@/lib/full-system-audit";
import { MemberConflictError, MemberInputError, MemberNotFoundError, removeStaffMember } from "@/lib/full-system-members";

export const runtime = "nodejs";

async function DELETEHandler(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  try {
    const { id, userId } = await context.params;
    await removeStaffMember(actor, id, userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuditOutcomePendingError) return NextResponse.json(
      { data: { status: error.commitState === "UNKNOWN" ? "COMMIT_UNKNOWN" : "AUDIT_PENDING",
        requestId: error.requestId } }, { status: 202, headers: { "Retry-After": "5" } });
    if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
    if (error instanceof MemberNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    if (error instanceof MemberConflictError) return NextResponse.json({ error: { code: "MEMBER_CONFLICT" } }, { status: 409 });
    if (error instanceof MemberInputError) return NextResponse.json({ error: { code: "MEMBER_INVALID" } }, { status: 422 });
    return NextResponse.json({ error: { code: "MEMBER_REMOVE_FAILED" } }, { status: 500 });
  }
}

export const DELETE = observeRoute(DELETEHandler);
