import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin } from "@/lib/full-system-auth";
import { AuditOutcomePendingError, AuditUnavailableError } from "@/lib/full-system-audit";
import { addStaffMember, MemberConflictError, MemberInputError, MemberNotFoundError } from "@/lib/full-system-members";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = await addStaffMember(actor, id, body?.userId, body?.role);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof AuditOutcomePendingError) return NextResponse.json(
      { data: { status: error.commitState === "UNKNOWN" ? "COMMIT_UNKNOWN" : "AUDIT_PENDING",
        requestId: error.requestId } }, { status: 202, headers: { "Retry-After": "5" } });
    if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
    if (error instanceof MemberNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    if (error instanceof MemberConflictError) return NextResponse.json({ error: { code: "MEMBER_CONFLICT" } }, { status: 409 });
    if (error instanceof MemberInputError) return NextResponse.json({ error: { code: "MEMBER_INVALID" } }, { status: 422 });
    return NextResponse.json({ error: { code: "MEMBER_ADD_FAILED" } }, { status: 500 });
  }
}
