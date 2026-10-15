import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { listComparisonReviews, reviewComparison } from "@/lib/full-system-comparison-review";

export const runtime = "nodejs";
async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await listComparisonReviews(auth.actor, (await context.params).id,
    request.nextUrl.searchParams.get("cursor")) }); }
  catch (error) { return assignmentError(error); }
}
async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await reviewComparison(auth.actor, (await context.params).id, await request.json()) }); }
  catch (error) { return assignmentError(error); }
}

export const GET = observeRoute(GETHandler);
export const POST = observeRoute(POSTHandler);
