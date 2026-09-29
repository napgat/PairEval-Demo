import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { feasibility } from "@/lib/full-system-assignments";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await feasibility(auth.actor, (await context.params).id,
    new URL(request.url).searchParams.get("seed") ?? "1") }); }
  catch (error) { return assignmentError(error); }
}
