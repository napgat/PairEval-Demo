import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { listStudentAssignments } from "@/lib/full-system-evaluation";

export const runtime = "nodejs";
async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await listStudentAssignments(auth.actor, (await context.params).id) }); }
  catch (error) { return assignmentError(error); }
}

export const GET = observeRoute(GETHandler);
