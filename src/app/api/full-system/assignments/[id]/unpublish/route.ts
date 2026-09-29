import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { unpublishAssignment } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { const body = await request.json(); return NextResponse.json({ data: await unpublishAssignment(auth.actor,
    (await context.params).id, body?.reason) }); }
  catch (error) { return assignmentError(error); }
}
