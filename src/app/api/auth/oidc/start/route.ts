import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { oidcConfig, pkceChallenge, randomOidcValue } from "@/lib/full-system-oidc";

export const runtime = "nodejs";

function GETHandler(request: NextRequest) {
  let config;
  try { config = oidcConfig(); } catch { return NextResponse.json({ error: { code: "OIDC_NOT_CONFIGURED" } }, { status: 503 }); }
  if (new URL(config.redirectUri).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: { code: "OIDC_ORIGIN_MISMATCH" } }, { status: 503 });
  }
  const state = randomOidcValue();
  const nonce = randomOidcValue();
  const verifier = randomOidcValue();
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: "code", scope: "openid email profile", state, nonce,
    code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" }).toString();
  const response = NextResponse.redirect(authorize);
  const options = { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax" as const,
    path: "/api/auth/oidc/callback", maxAge: 600 };
  response.cookies.set("paireval_oidc_state", state, options);
  response.cookies.set("paireval_oidc_nonce", nonce, options);
  response.cookies.set("paireval_oidc_verifier", verifier, options);
  return response;
}

export const GET = observeRoute(GETHandler);
