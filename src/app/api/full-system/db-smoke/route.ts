import { runDatabaseSmoke, validSmokeToken } from "@/lib/full-system-postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!validSmokeToken(token)) return new Response(null, { status: 404 });
  try {
    const result = await runDatabaseSmoke();
    return Response.json({ status: "ok", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
