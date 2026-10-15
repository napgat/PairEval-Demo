import { observeRoute } from "@/lib/observe-route";
import { runAuditSmoke, AuditSmokeError } from "@/lib/full-system-audit";
import { validSmokeToken } from "@/lib/full-system-postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function POSTHandler(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!validSmokeToken(token)) return new Response(null, { status: 404 });
  try {
    const result = await runAuditSmoke();
    return Response.json({ status: "ok", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ status: "unavailable", stage: error instanceof AuditSmokeError ? error.stage : "UNKNOWN" },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const POST = observeRoute(POSTHandler);
