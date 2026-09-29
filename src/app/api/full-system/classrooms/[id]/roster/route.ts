import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, classroomRole } from "@/lib/full-system-auth";
import { listRoster } from "@/lib/full-system-classrooms";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!actor.privacyAccepted) return NextResponse.json({ error: { code: "PRIVACY_NOTICE_REQUIRED" } }, { status: 428 });
  const { id } = await context.params;
  const role = await classroomRole(actor, id);
  if (!role) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (role === "STUDENT") return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  return NextResponse.json({ data: await listRoster(id) });
}
