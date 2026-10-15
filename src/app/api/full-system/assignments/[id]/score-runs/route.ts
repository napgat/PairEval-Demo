import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { createScoreRun, latestScoreRun } from "@/lib/full-system-score-runs";
import { mayRevealIdentities } from "@/lib/full-system-identity-access";
import { criterionQualityFeedback } from "@/lib/full-system-quality-feedback";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function GETHandler(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json({ data: await latestScoreRun(auth.actor, (await context.params).id),
    meta: { rawExportReady: Buffer.byteLength(process.env.PAIR_EVAL_EXPORT_KEY ?? "", "utf8") >= 32,
      canRevealIdentities: await mayRevealIdentities(auth.actor, (await context.params).id),
      qualityFeedback: await criterionQualityFeedback(auth.actor, (await context.params).id) } }); }
  catch (error) { return assignmentError(error); }
}
async function POSTHandler(request: NextRequest, context: Context) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await createScoreRun(auth.actor, (await context.params).id, body.kind) });
  } catch (error) { return assignmentError(error); }
}

export const GET = observeRoute(GETHandler);
export const POST = observeRoute(POSTHandler);
