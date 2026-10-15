import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { exportOwnPersonalData } from "@/lib/full-system-privacy";
export const runtime = "nodejs";
async function POSTHandler(request: NextRequest) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { const data = await exportOwnPersonalData(auth.actor);
    return NextResponse.json(data, { headers: { "Content-Disposition": 'attachment; filename="paireval-my-data.json"', "Cache-Control": "no-store" } });
  } catch (e) { return assignmentError(e); }
}

export const POST = observeRoute(POSTHandler);
