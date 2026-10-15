import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { withdrawSyntheticStudent } from "@/lib/full-system-withdrawal";

export const runtime = "nodejs";
async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const { id, userId } = await context.params;
    return NextResponse.json({ data: await withdrawSyntheticStudent(auth.actor, id, userId, await request.json()) });
  } catch (error) { return assignmentError(error); }
}

export const POST = observeRoute(POSTHandler);
