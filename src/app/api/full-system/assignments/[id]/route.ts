import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { getAssignment, replaceDraftAssignment } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await getAssignment(auth.actor, (await context.params).id) }); }
  catch (error) { return assignmentError(error); }
}
export async function PUT(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await replaceDraftAssignment(auth.actor,
    (await context.params).id, await request.json()) }); }
  catch (error) { return assignmentError(error); }
}
