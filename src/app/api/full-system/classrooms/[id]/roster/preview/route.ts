import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, classroomRole, sameOrigin } from "@/lib/full-system-auth";
import { ClassroomInputError, previewRosterChange } from "@/lib/full-system-classrooms";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  const { id } = await context.params;
  const role = await classroomRole(actor, id);
  if (!role) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (role === "STUDENT") return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  try {
    const body = await request.json();
    const result = await previewRosterChange(id, body?.csv);
    return NextResponse.json({ data: result }, { status: result.errors.length ? 422 : 200 });
  } catch (error) {
    if (error instanceof ClassroomInputError) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    return NextResponse.json({ error: { code: "ROSTER_PREVIEW_FAILED" } }, { status: 500 });
  }
}
