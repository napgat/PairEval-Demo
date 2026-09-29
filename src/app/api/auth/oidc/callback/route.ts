import { NextResponse, type NextRequest } from "next/server";
import { createFullSession, FULL_SESSION_COOKIE, SESSION_SECONDS } from "@/lib/full-system-auth";
import { exchangeGoogleCode, linkGoogleIdentity, oidcConfig } from "@/lib/full-system-oidc";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieState = request.cookies.get("paireval_oidc_state")?.value;
  const nonce = request.cookies.get("paireval_oidc_nonce")?.value;
  const verifier = request.cookies.get("paireval_oidc_verifier")?.value;
  let response: NextResponse;
  if (!state || !code || !cookieState || state !== cookieState || !nonce || !verifier || url.searchParams.has("error")) {
    response = NextResponse.json({ error: { code: "OIDC_STATE_INVALID" } }, { status: 400 });
  } else {
    try {
      const config = oidcConfig();
      if (new URL(config.redirectUri).origin !== url.origin) throw new Error("Callback origin mismatch");
      const identity = await exchangeGoogleCode(code, verifier, nonce);
      const userId = await linkGoogleIdentity(identity);
      const token = await createFullSession(userId, identity.hostedDomain);
      response = NextResponse.redirect(new URL("/full-system", url), { status: 303 });
      response.cookies.set(FULL_SESSION_COOKIE, token, { httpOnly: true, secure: url.protocol === "https:",
        sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
    } catch {
      response = NextResponse.json({ error: { code: "OIDC_LOGIN_REJECTED" } }, { status: 403 });
    }
  }
  for (const name of ["paireval_oidc_state", "paireval_oidc_nonce", "paireval_oidc_verifier"]) {
    response.cookies.set(name, "", { path: "/api/auth/oidc/callback", maxAge: 0 });
  }
  return response;
}
