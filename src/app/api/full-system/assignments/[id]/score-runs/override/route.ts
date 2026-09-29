import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { overrideScore } from "@/lib/full-system-score-runs";

export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await overrideScore(auth.actor, (await context.params).id,
      body.side, body.itemId, body.value, body.reason) });
  } catch (error) { return assignmentError(error); }
}
