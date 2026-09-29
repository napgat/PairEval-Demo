import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin } from "@/lib/full-system-auth";
import { ClassroomInputError, createClassroomWithRoster, listClassrooms } from "@/lib/full-system-classrooms";
import { AuditOutcomePendingError, AuditUnavailableError } from "@/lib/full-system-audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  return NextResponse.json({ data: await listClassrooms(actor) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  if (!actor.canCreateClassroom && actor.platformRole !== "SYSTEM_ADMIN") {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || typeof body.csv !== "string") throw new ClassroomInputError("Invalid classroom request");
    const result = await createClassroomWithRoster(actor, body);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof AuditOutcomePendingError) return NextResponse.json(
      { data: { status: error.commitState === "UNKNOWN" ? "COMMIT_UNKNOWN" : "AUDIT_PENDING",
        requestId: error.requestId } }, { status: 202, headers: { "Retry-After": "5" } });
    if (error instanceof AuditUnavailableError) return NextResponse.json({ error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
    if (error instanceof ClassroomInputError) return NextResponse.json({ error: { code: "CLASSROOM_INVALID", message: error.message } }, { status: 422 });
    return NextResponse.json({ error: { code: "CLASSROOM_CREATE_FAILED" } }, { status: 500 });
  }
}
