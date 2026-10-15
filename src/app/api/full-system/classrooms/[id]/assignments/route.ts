import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { createAssignment, listAssignments } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function GETHandler(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await listAssignments(auth.actor, (await context.params).id) }); }
  catch (error) { return assignmentError(error); }
}
async function POSTHandler(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await createAssignment(auth.actor, (await context.params).id,
    await request.json()) }, { status: 201 }); }
  catch (error) { return assignmentError(error); }
}

export const GET = observeRoute(GETHandler);
export const POST = observeRoute(POSTHandler);
