import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { cloneAssignment } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { const body = await request.json(); return NextResponse.json({ data: await cloneAssignment(auth.actor,
    (await context.params).id, body?.name) }, { status: 201 }); }
  catch (error) { return assignmentError(error); }
}

export const POST = observeRoute(POSTHandler);
