import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { databasePool } from "./full-system-postgres";
import { NOTICE_VERSION, SYNTHETIC_NOTICE_VERSION } from "./full-system-notice-version";

export const FULL_SESSION_COOKIE = "paireval_full_session";
export const SESSION_SECONDS = 12 * 60 * 60;

export type FullActor = {
  id: string;
  email: string;
  hostedDomain: string | null;
  platformRole: "USER" | "SYSTEM_ADMIN";
  canCreateClassroom: boolean;
  privacyAccepted: boolean;
};

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }

export async function actorForRequest(request: NextRequest): Promise<FullActor | null> {
  const token = request.cookies.get(FULL_SESSION_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const found = await databasePool().query<{
    id: string; email_lookup: string; hosted_domain: string | null; platform_role: "USER" | "SYSTEM_ADMIN";
    can_create_classroom: boolean; privacy_accepted: boolean;
  }>(`SELECT u.id, u.email_lookup, s.hosted_domain, u.platform_role, u.can_create_classroom,
       (p.notice_version = $2 OR
        (u.email_lookup LIKE '%@example.test' AND p.notice_version = $3)) AS privacy_accepted
       FROM app_session s JOIN app_user u ON u.id = s.user_id
       LEFT JOIN privacy_notice_acceptance p ON p.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL AND u.status = 'ACTIVE'`,
    [tokenHash(token), NOTICE_VERSION, SYNTHETIC_NOTICE_VERSION]);
  const row = found.rows[0];
  return row ? { id: row.id, email: row.email_lookup, hostedDomain: row.hosted_domain,
    platformRole: row.platform_role, canCreateClassroom: row.can_create_classroom,
    privacyAccepted: row.privacy_accepted === true } : null;
}

export async function createFullSession(userId: string, hostedDomain: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await databasePool().query(`INSERT INTO app_session (id, user_id, token_hash, hosted_domain, expires_at)
    VALUES ($1,$2,$3,$4,now() + interval '12 hours')`, [randomUUID(), userId, tokenHash(token), hostedDomain]);
  return token;
}

export async function revokeFullSession(token: string | undefined): Promise<void> {
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await databasePool().query("UPDATE app_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash(token)]);
  }
}

export function domainAllowed(hostedDomain: string | null, domains: string[]): boolean {
  return domains.length === 0 || !!hostedDomain && domains.some(domain => domain.toLowerCase() === hostedDomain.toLowerCase());
}

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export type ClassroomRole = "OWNER" | "CO_TEACHER" | "TA" | "STUDENT";
export async function classroomRole(actor: FullActor, classroomId: string): Promise<ClassroomRole | null> {
  const found = await databasePool().query<{ role: ClassroomRole; allowed_email_domains: string[] }>(
    `SELECT m.role, c.allowed_email_domains FROM classroom_member m
     JOIN classroom c ON c.id = m.classroom_id
     WHERE m.classroom_id = $1 AND m.user_id = $2 AND m.membership_status = 'ACTIVE' AND c.status = 'ACTIVE'`,
    [classroomId, actor.id]);
  const row = found.rows[0];
  return row && domainAllowed(actor.hostedDomain, row.allowed_email_domains) ? row.role : null;
}
