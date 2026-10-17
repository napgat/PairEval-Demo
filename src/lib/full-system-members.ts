import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { domainAllowed, normalizeEmail, type FullActor } from "./full-system-auth";
import { databasePool } from "./full-system-postgres";
import { runAuditedMutation } from "./full-system-audit-outbox";

export class MemberInputError extends Error {}
export class MemberNotFoundError extends Error {}
export class MemberConflictError extends Error {}
export class MemberAccountUnavailableError extends Error {}
export type StaffRole = "OWNER" | "CO_TEACHER" | "TA";
export type StaffMember = { userId: string; displayName: string; email: string; role: StaffRole };
const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

export async function requireOwner(client: PoolClient, actor: FullActor, classroomId: string, lock = true) {
  if (!validId(classroomId)) throw new MemberInputError("Invalid classroom ID");
  const found = await client.query<{ role: string; allowed_email_domains: string[] }>(
    `SELECT m.role,c.allowed_email_domains FROM classroom c
     JOIN classroom_member m ON m.classroom_id=c.id
     WHERE c.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.membership_status='ACTIVE' ${lock ? "FOR UPDATE OF c" : ""}`,
    [classroomId, actor.id]);
  const row = found.rows[0];
  if (!row || row.role !== "OWNER" || !domainAllowed(actor.hostedDomain, row.allowed_email_domains)) {
    throw new MemberNotFoundError("Classroom not found");
  }
}

export async function listStaffMembers(actor: FullActor, classroomId: string): Promise<StaffMember[]> {
  const client = await databasePool().connect();
  try {
    await requireOwner(client, actor, classroomId, false);
    const result = await client.query<{ user_id: string; display_name: string; email_raw: string; role: StaffRole }>(
      `SELECT m.user_id,u.display_name,u.email_raw,m.role FROM classroom_member m JOIN app_user u ON u.id=m.user_id
       WHERE m.classroom_id=$1 AND m.membership_status='ACTIVE' AND m.role IN ('OWNER','CO_TEACHER','TA')
       ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'CO_TEACHER' THEN 1 ELSE 2 END,u.display_name,u.email_lookup`, [classroomId]);
    return result.rows.map(row => ({ userId: row.user_id, displayName: row.display_name, email: row.email_raw, role: row.role }));
  } finally { client.release(); }
}

export async function addStaffMember(actor: FullActor, classroomId: string, userId: string, role: string) {
  if (!validId(userId)) throw new MemberInputError("Invalid staff member");
  return saveStaffMember(actor, classroomId, { userId }, role);
}

export async function addStaffMemberByEmail(actor: FullActor, classroomId: string, email: string, role: string) {
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email.trim())) {
    throw new MemberInputError("Invalid staff email");
  }
  return saveStaffMember(actor, classroomId, { email: normalizeEmail(email) }, role);
}

async function saveStaffMember(actor: FullActor, classroomId: string, target: { userId?: string; email?: string }, role: string) {
  if (!["CO_TEACHER", "TA"].includes(role)) throw new MemberInputError("Invalid staff role");
  return runAuditedMutation({
    prepare: async client => {
      await requireOwner(client, actor, classroomId);
      const user = await client.query<{ id: string }>(`SELECT id FROM app_user WHERE ${target.email !== undefined ? "email_lookup" : "id"}=$1 AND status <> 'DISABLED'`, [target.email ?? target.userId]);
      if (!user.rows[0]) throw new MemberAccountUnavailableError("Account unavailable");
      const userId = user.rows[0].id;
      const found = await client.query<{ id: string; role: string; membership_status: string }>(
        "SELECT id,role,membership_status FROM classroom_member WHERE classroom_id=$1 AND user_id=$2 FOR UPDATE", [classroomId, userId]);
      const previous = found.rows[0];
      if (previous && (previous.membership_status === "ACTIVE" || !["CO_TEACHER", "TA"].includes(previous.role))) {
        throw new MemberConflictError("User is already a member");
      }
      return { userId, previous };
    },
    intent: ({ userId, previous }) => ({ classroomId, actorUserId: actor.id, action: "CLASSROOM_ROLE_ADD_REQUESTED",
      resourceType: "classroom_member", resourceId: userId,
      before: previous ? { role: previous.role, membershipStatus: previous.membership_status } : undefined,
      after: { role, membershipStatus: "ACTIVE", restored: !!previous } }),
    mutate: async (client, { userId, previous }) => {
      const id = previous?.id ?? randomUUID();
      if (previous) {
        await client.query(`UPDATE classroom_member SET role=$2,membership_status='ACTIVE',withdrawn_at=NULL WHERE id=$1`, [id, role]);
      } else {
        await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
          VALUES ($1,$2,$3,$4)`, [id, classroomId, userId, role]);
      }
      return { id, userId, role, restored: !!previous };
    },
    committedAfter: result => ({ role: result.role, membershipStatus: "ACTIVE", restored: result.restored }),
  });
}

export async function removeStaffMember(actor: FullActor, classroomId: string, userId: string) {
  if (!validId(userId)) throw new MemberInputError("Invalid staff member");
  await runAuditedMutation({
    prepare: async client => {
      await requireOwner(client, actor, classroomId);
      const member = await client.query<{ role: string }>(
        "SELECT role FROM classroom_member WHERE classroom_id=$1 AND user_id=$2 AND membership_status='ACTIVE' FOR UPDATE",
        [classroomId, userId]);
      const role = member.rows[0]?.role;
      if (!role || role === "STUDENT") throw new MemberNotFoundError("Staff member not found");
      if (role === "OWNER") {
        const count = await client.query<{ count: string }>(
          "SELECT count(*) FROM classroom_member WHERE classroom_id=$1 AND role='OWNER' AND membership_status='ACTIVE'", [classroomId]);
        if (Number(count.rows[0].count) <= 1) throw new MemberConflictError("Cannot remove the final owner");
      }
      return role;
    },
    intent: role => ({ classroomId, actorUserId: actor.id, action: "CLASSROOM_ROLE_REMOVE_REQUESTED",
      resourceType: "classroom_member", resourceId: userId, before: { role } }),
    mutate: async client => {
      await client.query("UPDATE classroom_member SET membership_status='WITHDRAWN', withdrawn_at=now() WHERE classroom_id=$1 AND user_id=$2", [classroomId, userId]);
      return { membershipStatus: "WITHDRAWN" };
    },
    committedAfter: result => result,
  });
}
