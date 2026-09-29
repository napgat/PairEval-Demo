import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, normalizeEmail } from "./full-system-auth";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type VerifiedGoogleIdentity = { sub: string; email: string; hostedDomain: string | null; name: string };

export function oidcConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("PairEval Google OIDC is not configured");
  const uri = new URL(redirectUri);
  if (uri.pathname !== "/api/auth/oidc/callback" || (uri.protocol !== "https:" && uri.hostname !== "localhost")) {
    throw new Error("GOOGLE_REDIRECT_URI does not match the PairEval callback route");
  }
  return { clientId, clientSecret, redirectUri };
}

export function randomOidcValue(): string { return randomBytes(32).toString("base64url"); }
export function pkceChallenge(verifier: string): string { return createHash("sha256").update(verifier).digest("base64url"); }

export function callbackProblem(input: { state: string | null; code: string | null;
  cookieState: string | undefined; nonce: string | undefined; verifier: string | undefined;
  providerError: string | null }): { code: string; status: number; message?: string } | null {
  if (!input.state || !input.cookieState || input.state !== input.cookieState ||
      !input.nonce || !input.verifier) return { code: "OIDC_STATE_INVALID", status: 400 };
  if (input.providerError === "access_denied") return {
    code: "OIDC_CONSENT_DENIED", status: 403, message: "ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว" };
  if (input.providerError) return { code: "OIDC_PROVIDER_REJECTED", status: 403,
    message: "Google ไม่อนุญาตให้เข้าสู่ระบบในครั้งนี้" };
  if (!input.code) return { code: "OIDC_STATE_INVALID", status: 400 };
  return null;
}

export function validateGoogleClaims(claims: JWTPayload, expectedNonce: string): VerifiedGoogleIdentity {
  const email = typeof claims.email === "string" ? normalizeEmail(claims.email) : "";
  if (!claims.sub || typeof claims.sub !== "string" || claims.nonce !== expectedNonce || claims.email_verified !== true ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Google identity claims are invalid");
  }
  const hostedDomain = typeof claims.hd === "string" && claims.hd.trim() ? claims.hd.trim().toLowerCase() : null;
  return { sub: claims.sub, email, hostedDomain,
    name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email };
}

export async function exchangeGoogleCode(code: string, verifier: string, expectedNonce: string): Promise<VerifiedGoogleIdentity> {
  const config = oidcConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store",
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, code_verifier: verifier, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("Google authorization code exchange failed");
  const data = await response.json() as { id_token?: unknown };
  if (typeof data.id_token !== "string") throw new Error("Google did not return an ID token");
  const verified = await jwtVerify(data.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"], audience: config.clientId, algorithms: ["RS256"],
  });
  return validateGoogleClaims(verified.payload, expectedNonce);
}

/** Link only an existing, exact-match roster/entitlement user. No account picker or client-supplied role. */
export async function linkGoogleIdentity(identity: VerifiedGoogleIdentity): Promise<string> {
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{ id: string; google_sub: string | null; status: string;
      platform_role: string; can_create_classroom: boolean }>(
      `SELECT id, google_sub, status, platform_role, can_create_classroom
       FROM app_user WHERE google_sub = $1 OR email_lookup = $2 FOR UPDATE`,
      [identity.sub, identity.email]);
    if (found.rows.length !== 1 || found.rows[0].status === "DISABLED" ||
        found.rows[0].google_sub && found.rows[0].google_sub !== identity.sub) {
      throw new Error("Google identity is not authorized for this PairEval roster");
    }
    const id = found.rows[0].id;
    const memberDomains = await client.query<{ allowed_email_domains: string[] }>(
      `SELECT c.allowed_email_domains FROM classroom_member m
       JOIN classroom c ON c.id = m.classroom_id
       WHERE m.user_id = $1 AND m.membership_status = 'ACTIVE' AND c.status = 'ACTIVE'`, [id]);
    if (found.rows[0].platform_role !== "SYSTEM_ADMIN" && !found.rows[0].can_create_classroom &&
        !memberDomains.rows.some(row => domainAllowed(identity.hostedDomain, row.allowed_email_domains))) {
      throw new Error("Google identity is not authorized for an active PairEval classroom");
    }
    await client.query("UPDATE app_user SET google_sub = $2, status = 'ACTIVE', last_login_at = now() WHERE id = $1", [id, identity.sub]);
    await client.query("COMMIT");
    return id;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
