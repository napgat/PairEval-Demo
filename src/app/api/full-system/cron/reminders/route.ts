import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { runReminderSweep, validCronAuthorization } from "@/lib/full-system-reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function GETHandler(request: NextRequest) {
  if (!validCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET) ||
      !["development", "staging", "production"].includes(process.env.PAIR_EVAL_ENV ?? "")) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  try {
    return NextResponse.json({ data: await runReminderSweep() },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "REMINDER_JOB_FAILED" } }, { status: 503 });
  }
}

export const GET = observeRoute(GETHandler);
