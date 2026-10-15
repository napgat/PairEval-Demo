import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin, type FullActor } from "./full-system-auth";
import { AuditOutcomePendingError, AuditUnavailableError } from "./full-system-audit";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError, AssignmentForbiddenError } from "./full-system-assignments";
import { currentRequestContext } from "./request-context";

export async function assignmentActor(request: NextRequest, mutation = false): Promise<
  { actor: FullActor; error?: never } | { actor?: never; error: NextResponse }> {
  if (mutation && !sameOrigin(request)) return { error: NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 }) };
  const actor = await actorForRequest(request);
  if (!actor) return { error: NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }) };
  if (!actor.privacyAccepted) return { error: NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 }) };
  return { actor };
}

export function assignmentError(error: unknown): NextResponse {
  if (error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  if (error instanceof AssignmentForbiddenError) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  if (error instanceof AuditOutcomePendingError) return NextResponse.json(
    { data: { status: error.commitState === "UNKNOWN" ? "COMMIT_UNKNOWN" : "AUDIT_PENDING",
      requestId: error.requestId } }, { status: 202, headers: { "Retry-After": "5" } });
  if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
  if (error instanceof AssignmentNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (error instanceof AssignmentConflictError) return NextResponse.json(
    { error: { code: "ASSIGNMENT_CONFLICT", message: error.message } }, { status: 409 });
  if (error instanceof AssignmentInputError) return NextResponse.json(
    { error: { code: "ASSIGNMENT_INVALID", message: error.message } }, { status: 422 });
  const diagnostic = error as { name?: string; code?: string; constraint?: string };
  console.error(JSON.stringify({ event: "operation_failed", requestId: currentRequestContext().requestId,
    errorType: diagnostic?.name ?? "unknown", databaseCode: diagnostic?.code, constraint: diagnostic?.constraint }));
  return NextResponse.json({ error: { code: "ASSIGNMENT_FAILED" } }, { status: 500 });
}
