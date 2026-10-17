import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin } from "@/lib/full-system-auth";
import { AuditOutcomePendingError, AuditUnavailableError } from "@/lib/full-system-audit";
import { addStaffMember, addStaffMemberByEmail, listStaffMembers, MemberAccountUnavailableError, MemberConflictError, MemberInputError, MemberNotFoundError } from "@/lib/full-system-members";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function GETHandler(request: NextRequest, context: Context) {
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  try { return NextResponse.json({ data: await listStaffMembers(actor, (await context.params).id) }); }
  catch (error) {
    if (error instanceof MemberNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    if (error instanceof MemberInputError) return NextResponse.json({ error: { code: "MEMBER_INVALID" } }, { status: 422 });
    return NextResponse.json({ error: { code: "MEMBER_LIST_FAILED" } }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || (body.email !== undefined) === (body.userId !== undefined)) {
      throw new MemberInputError("Provide exactly one staff identifier");
    }
    const data = body.email !== undefined ? await addStaffMemberByEmail(actor, id, body.email, body.role) :
      await addStaffMember(actor, id, body.userId, body.role);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
    if (error instanceof MemberAccountUnavailableError) return NextResponse.json({ error: { code: "MEMBER_ACCOUNT_UNAVAILABLE" } }, { status: 422 });
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

export const POST = observeRoute(POSTHandler);
export const GET = observeRoute(GETHandler);
