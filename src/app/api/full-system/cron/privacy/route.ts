import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { validCronAuthorization } from "@/lib/full-system-reminder-job";
import { runPrivacyRetention } from "@/lib/full-system-privacy";
import { captureRequestContext } from "@/lib/request-context";
export const runtime = "nodejs";
async function GETHandler(request: NextRequest) {
  if (!validCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  captureRequestContext(request);
  try { return NextResponse.json({ data: await runPrivacyRetention() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: { code: "RETENTION_FAILED" } }, { status: 503 }); }
}

export const GET = observeRoute(GETHandler);
