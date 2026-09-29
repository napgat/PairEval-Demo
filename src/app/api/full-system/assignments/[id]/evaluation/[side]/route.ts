import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { getEvaluation, saveEvaluationDraft, submitEvaluation } from "@/lib/full-system-evaluation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; side: string }> };
export async function GET(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  const { id, side } = await context.params;
  try { return NextResponse.json({ data: await getEvaluation(auth.actor, id, side.toUpperCase()) }); }
  catch (error) { return assignmentError(error); }
}
export async function PUT(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  const { id, side } = await context.params;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await saveEvaluationDraft(auth.actor, id, side.toUpperCase(),
      body.pairId, body.choice) });
  } catch (error) { return assignmentError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  const { id, side } = await context.params;
  try { return NextResponse.json({ data: await submitEvaluation(auth.actor, id, side.toUpperCase(),
    request.headers.get("Idempotency-Key")) }); }
  catch (error) { return assignmentError(error); }
}
