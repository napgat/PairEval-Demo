import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";

export class MemberInputError extends Error {}
export class MemberNotFoundError extends Error {}
export class MemberConflictError extends Error {}

export async function requireOwner(client: PoolClient, actor: FullActor, classroomId: string) {
  const found = await client.query<{ role: string; allowed_email_domains: string[] }>(
    `SELECT m.role,c.allowed_email_domains FROM classroom c
     JOIN classroom_member m ON m.classroom_id=c.id
     WHERE c.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.membership_status='ACTIVE' FOR UPDATE OF c`,
    [classroomId, actor.id]);
  const row = found.rows[0];
  if (!row || row.role !== "OWNER" || !domainAllowed(actor.hostedDomain, row.allowed_email_domains)) {
    throw new MemberNotFoundError("Classroom not found");
  }
}

export async function addStaffMember(actor: FullActor, classroomId: string, userId: string, role: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["CO_TEACHER", "TA"].includes(role)) {
    throw new MemberInputError("Invalid staff member");
  }
  return runAuditedMutation({
    prepare: async client => {
      await requireOwner(client, actor, classroomId);
      const user = await client.query("SELECT 1 FROM app_user WHERE id=$1 AND status <> 'DISABLED'", [userId]);
      if (user.rowCount !== 1) throw new MemberNotFoundError("User not found");
      const existing = await client.query("SELECT 1 FROM classroom_member WHERE classroom_id=$1 AND user_id=$2", [classroomId, userId]);
      if (existing.rowCount) throw new MemberConflictError("User is already a member");
    },
    intent: () => ({ classroomId, actorUserId: actor.id, action: "CLASSROOM_ROLE_ADD_REQUESTED",
      resourceType: "classroom_member", resourceId: userId, after: { role } }),
    mutate: async client => {
      const id = randomUUID();
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
        VALUES ($1,$2,$3,$4)`, [id, classroomId, userId, role]);
      return { id, userId, role };
    },
  });
}

export async function removeStaffMember(actor: FullActor, classroomId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new MemberInputError("Invalid staff member");
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
