import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { startActiveTiming, recordActiveTiming } from "@/lib/full-system-active-timing";
import { AssignmentInputError } from "@/lib/full-system-assignments";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; side: string }> };
async function POSTHandler(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { const { id, side } = await context.params; const body = await request.json();
    if (!body || typeof body.pairId !== "string") throw new AssignmentInputError("Timing pair required");
    return NextResponse.json({ data: await startActiveTiming(auth.actor, id, side.toUpperCase(), body.pairId) });
  } catch (e) { return assignmentError(e); }
}
async function PUTHandler(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { const { id, side } = await context.params; const body = await request.json();
    if (!body || typeof body.pairId !== "string") throw new AssignmentInputError("Timing pair required");
    return NextResponse.json({ data: await recordActiveTiming(auth.actor, id, side.toUpperCase(), body.pairId, body) });
  } catch (e) { return assignmentError(e); }
}

export const POST = observeRoute(POSTHandler);
export const PUT = observeRoute(PUTHandler);
