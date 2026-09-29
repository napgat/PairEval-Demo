import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { createScoreRun, latestScoreRun } from "@/lib/full-system-score-runs";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await latestScoreRun(auth.actor, (await context.params).id) }); }
  catch (error) { return assignmentError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await createScoreRun(auth.actor, (await context.params).id, body.kind) });
  } catch (error) { return assignmentError(error); }
}
