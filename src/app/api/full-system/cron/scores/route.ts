import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { validCronAuthorization } from "@/lib/full-system-reminder-job";
import { runScheduledScoreSweep } from "@/lib/full-system-score-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function invoke(request: NextRequest, origin: "VERCEL_CRON" | "MANUAL") {
  if (!validCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET) ||
      !["development", "staging", "production"].includes(process.env.PAIR_EVAL_ENV ?? "")) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  try {
    const data = await runScheduledScoreSweep(new Date(), origin);
    return NextResponse.json({ data }, {
      status: data.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "SCORE_JOB_FAILED" } }, { status: 503 });
  }
}

function GETHandler(request: NextRequest) { return invoke(request, "VERCEL_CRON"); }
function POSTHandler(request: NextRequest) { return invoke(request, "MANUAL"); }

export const GET = observeRoute(GETHandler);
export const POST = observeRoute(POSTHandler);
