import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { changeAssignmentDeadlines } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await changeAssignmentDeadlines(auth.actor,
    (await context.params).id, await request.json()) }); }
  catch (error) { return assignmentError(error); }
}

export const PATCH = observeRoute(PATCHHandler);
