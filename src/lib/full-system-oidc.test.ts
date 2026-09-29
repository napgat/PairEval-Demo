import { describe, expect, it } from "vitest";
import { domainAllowed, normalizeEmail, tokenHash } from "./full-system-auth";
import { callbackProblem, pkceChallenge, validateGoogleClaims } from "./full-system-oidc";

describe("Full System OIDC claim handling", () => {
  const claims = { sub: "google-sub", nonce: "nonce", email: " First.Last+tag@Uni.ac.th ",
    email_verified: true, hd: "Uni.ac.th", name: "Student" };

  it("keeps dots and plus tags in exact roster email matching", () => {
    const identity = validateGoogleClaims(claims, "nonce");
    expect(identity.email).toBe("first.last+tag@uni.ac.th");
    expect(identity.hostedDomain).toBe("uni.ac.th");
    expect(normalizeEmail(" firstlast@uni.ac.th ")).not.toBe(identity.email);
  });

  it("rejects nonce and unverified email claims", () => {
    expect(() => validateGoogleClaims(claims, "other")).toThrow();
    expect(() => validateGoogleClaims({ ...claims, email_verified: false }, "nonce")).toThrow();
    expect(() => validateGoogleClaims({ ...claims, sub: "" }, "nonce")).toThrow();
    expect(() => validateGoogleClaims({ ...claims, email: "not-an-email" }, "nonce")).toThrow();
    expect(() => validateGoogleClaims({ ...claims, email: undefined }, "nonce")).toThrow();
  });

  it("uses verified hosted domain for classroom scope", () => {
    expect(domainAllowed("uni.ac.th", ["UNI.AC.TH"])).toBe(true);
    expect(domainAllowed("other.ac.th", ["uni.ac.th"])).toBe(false);
    expect(domainAllowed(null, ["uni.ac.th"])).toBe(false);
  });

  it("hashes the session token and uses SHA-256 PKCE", () => {
    expect(tokenHash("secret")).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash("secret")).not.toContain("secret");
    expect(pkceChallenge("verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("reports Google consent denial only after matching the stored state", () => {
    const input = { state: "stored", code: null, cookieState: "stored", nonce: "nonce",
      verifier: "verifier", providerError: "access_denied" };
    expect(callbackProblem(input)).toMatchObject({ code: "OIDC_CONSENT_DENIED", status: 403 });
    expect(callbackProblem({ ...input, state: "wrong" })).toMatchObject({ code: "OIDC_STATE_INVALID", status: 400 });
    expect(callbackProblem({ ...input, providerError: null })).toMatchObject({ code: "OIDC_STATE_INVALID", status: 400 });
  });
});
