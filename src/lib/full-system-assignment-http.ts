import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin, type FullActor } from "./full-system-auth";
import { AuditOutcomePendingError, AuditUnavailableError } from "./full-system-audit";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";

export async function assignmentActor(request: NextRequest, mutation = false): Promise<
  { actor: FullActor; error?: never } | { actor?: never; error: NextResponse }> {
  if (mutation && !sameOrigin(request)) return { error: NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 }) };
  const actor = await actorForRequest(request);
  if (!actor) return { error: NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }) };
  if (!actor.privacyAccepted) return { error: NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 }) };
  return { actor };
}

export function assignmentError(error: unknown): NextResponse {
  if (error instanceof AuditOutcomePendingError) return NextResponse.json(
    { data: { status: error.commitState === "UNKNOWN" ? "COMMIT_UNKNOWN" : "AUDIT_PENDING",
      requestId: error.requestId } }, { status: 202, headers: { "Retry-After": "5" } });
  if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
  if (error instanceof AssignmentNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (error instanceof AssignmentConflictError) return NextResponse.json(
    { error: { code: "ASSIGNMENT_CONFLICT", message: error.message } }, { status: 409 });
  if (error instanceof AssignmentInputError) return NextResponse.json(
    { error: { code: "ASSIGNMENT_INVALID", message: error.message } }, { status: 422 });
  return NextResponse.json({ error: { code: "ASSIGNMENT_FAILED" } }, { status: 500 });
}
