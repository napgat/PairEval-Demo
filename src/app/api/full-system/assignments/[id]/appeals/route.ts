import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { listAppeals, resolveAppeal, submitAppeal } from "@/lib/full-system-appeals";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await listAppeals(auth.actor, (await context.params).id) }); }
  catch (error) { return assignmentError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await submitAppeal(auth.actor, (await context.params).id,
      body.message) });
  } catch (error) { return assignmentError(error); }
}
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await resolveAppeal(auth.actor, (await context.params).id,
      body.appealId, body.status, body.resolution) });
  } catch (error) { return assignmentError(error); }
}
