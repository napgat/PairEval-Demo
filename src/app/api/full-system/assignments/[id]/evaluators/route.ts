import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { addPairEvaluators } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await addPairEvaluators(auth.actor,
    (await context.params).id, await request.json()) }); }
  catch (error) { return assignmentError(error); }
}
