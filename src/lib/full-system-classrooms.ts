import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { previewFullRosterCsv, type FullRosterRow } from "./full-system-roster";
import { runAuditedMutation } from "./full-system-audit-outbox";

export class ClassroomInputError extends Error {}
export class RosterVersionError extends Error {}
export type ClassroomSummary = { id: string; name: string; role: string; status: string; rosterVersion: number };

function digest(csv: string): string { return createHash("sha256").update(csv).digest("hex"); }

async function upsertRoster(client: PoolClient, classroomId: string, rows: FullRosterRow[]): Promise<void> {
  const groups = new Map<string, string>();
  for (const row of rows) {
    let groupId = groups.get(row.groupName);
    if (!groupId) {
      const group = await client.query<{ id: string }>(`INSERT INTO group_entity (id,classroom_id,name)
        VALUES ($1,$2,$3) ON CONFLICT (classroom_id,name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [randomUUID(), classroomId, row.groupName]);
      groupId = group.rows[0].id; groups.set(row.groupName, groupId);
    }
    await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name)
      VALUES ($1,$2,$3,$4) ON CONFLICT (email_lookup) DO NOTHING`,
      [randomUUID(), row.email, row.email, row.displayName]);
    const user = await client.query<{ id: string }>("SELECT id FROM app_user WHERE email_lookup = $1", [row.email]);
    const member = await client.query(`INSERT INTO classroom_member
      (id,classroom_id,user_id,role,group_id,student_number)
      VALUES ($1,$2,$3,'STUDENT',$4,$5)
      ON CONFLICT (classroom_id,user_id) DO UPDATE SET group_id = EXCLUDED.group_id,
        student_number = EXCLUDED.student_number, membership_status = 'ACTIVE', withdrawn_at = NULL
      WHERE classroom_member.role = 'STUDENT' RETURNING id`,
      [randomUUID(), classroomId, user.rows[0].id, groupId, row.studentId]);
    if (member.rowCount !== 1) throw new ClassroomInputError(`row ${row.line}: user already has a staff role in this classroom`);
  }
  await client.query("UPDATE classroom SET roster_version = roster_version + 1 WHERE id = $1", [classroomId]);
}

export async function createClassroomWithRoster(actor: FullActor, input: {
  name: string; csv: string; timezone?: string; allowedEmailDomains?: string[]; ownerUserId?: string;
}): Promise<{ id: string; students: number; groups: number; warnings: string[] }> {
  if (!actor.canCreateClassroom && actor.platformRole !== "SYSTEM_ADMIN") throw new ClassroomInputError("FACULTY entitlement required");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 120) throw new ClassroomInputError("Classroom name must be 2–120 characters");
  const preview = previewFullRosterCsv(input.csv);
  if (preview.errors.length) throw new ClassroomInputError(preview.errors.join("; "));
  const domains = input.allowedEmailDomains ?? [];
  if (!Array.isArray(domains) || domains.some(domain => typeof domain !== "string" || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))) {
    throw new ClassroomInputError("Invalid allowedDomains");
  }
  const ownerId = actor.platformRole === "SYSTEM_ADMIN" ? input.ownerUserId : actor.id;
  if (!ownerId || !/^[0-9a-f-]{36}$/.test(ownerId)) throw new ClassroomInputError("A FACULTY owner is required");
  const classroomId = randomUUID();
  return runAuditedMutation({
    prepare: async client => {
      const creator = await client.query<{ platform_role: string; can_create_classroom: boolean }>(
        "SELECT platform_role, can_create_classroom FROM app_user WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE", [actor.id]);
      if (!creator.rows[0] || creator.rows[0].platform_role !== "SYSTEM_ADMIN" &&
          !creator.rows[0].can_create_classroom) throw new ClassroomInputError("FACULTY entitlement required");
      const owner = await client.query("SELECT 1 FROM app_user WHERE id = $1 AND can_create_classroom AND status = 'ACTIVE'", [ownerId]);
      if (owner.rowCount !== 1) throw new ClassroomInputError("Owner must have active FACULTY entitlement");
    },
    intent: () => ({ classroomId, actorUserId: actor.id, action: "CLASSROOM_CREATE_REQUESTED",
      resourceType: "classroom", resourceId: classroomId }),
    mutate: async client => {
      await client.query(`INSERT INTO classroom
        (id,name,slug,timezone,allowed_email_domains,created_by)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [classroomId, name, `classroom-${classroomId.slice(0, 8)}`, input.timezone ?? "Asia/Bangkok",
          domains.map(domain => domain.toLowerCase()), actor.id]);
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
        VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), classroomId, ownerId]);
      await upsertRoster(client, classroomId, preview.rows);
      return { id: classroomId, students: preview.rows.length, groups: preview.groups.length, warnings: preview.warnings };
    },
    committedAfter: result => ({ students: result.students, groups: result.groups }),
  });
}

export async function listClassrooms(actor: FullActor): Promise<ClassroomSummary[]> {
  const result = await databasePool().query<{ id: string; name: string; role: string; status: string;
    roster_version: number; allowed_email_domains: string[] }>(`SELECT c.id,c.name,m.role,c.status,c.roster_version,c.allowed_email_domains
    FROM classroom_member m JOIN classroom c ON c.id = m.classroom_id
    WHERE m.user_id = $1 AND m.membership_status = 'ACTIVE' AND c.status = 'ACTIVE' ORDER BY c.created_at DESC`, [actor.id]);
  return result.rows.filter(row => domainAllowed(actor.hostedDomain, row.allowed_email_domains))
    .map(row => ({ id: row.id, name: row.name, role: row.role, status: row.status, rosterVersion: row.roster_version }));
}

export async function previewRosterChange(classroomId: string, csv: string) {
  const preview = previewFullRosterCsv(csv);
  if (preview.errors.length) return { ...preview, digest: null, version: null, diff: null };
  const classroom = await databasePool().query<{ roster_version: number }>("SELECT roster_version FROM classroom WHERE id = $1", [classroomId]);
  if (!classroom.rows[0]) throw new ClassroomInputError("Classroom not found");
  const members = await databasePool().query<{ email_lookup: string; group_name: string }>(
    `SELECT u.email_lookup,g.name AS group_name FROM classroom_member m
     JOIN app_user u ON u.id=m.user_id JOIN group_entity g ON g.id=m.group_id
     WHERE m.classroom_id=$1 AND m.role='STUDENT'`, [classroomId]);
  const previous = new Map(members.rows.map(row => [row.email_lookup, row.group_name]));
  return { ...preview, digest: digest(csv), version: classroom.rows[0].roster_version,
    diff: { added: preview.rows.filter(row => !previous.has(row.email)).length,
      moved: preview.rows.filter(row => previous.has(row.email) && previous.get(row.email) !== row.groupName).length,
      unchanged: preview.rows.filter(row => previous.get(row.email) === row.groupName).length } };
}

export async function importRoster(actor: FullActor, classroomId: string, csv: string, expectedVersion: number, confirmDigest: string) {
  const preview = previewFullRosterCsv(csv);
  if (preview.errors.length) throw new ClassroomInputError(preview.errors.join("; "));
  if (digest(csv) !== confirmDigest) throw new ClassroomInputError("CSV differs from preview");
  return runAuditedMutation({
    prepare: async client => {
      const classroom = await client.query<{ roster_version: number }>(
        "SELECT roster_version FROM classroom WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE", [classroomId]);
      if (!classroom.rows[0]) throw new ClassroomInputError("Classroom not found");
      if (classroom.rows[0].roster_version !== expectedVersion) throw new RosterVersionError("Roster changed since preview");
      const membership = await client.query<{ role: string; allowed_email_domains: string[] }>(
        `SELECT m.role,c.allowed_email_domains FROM classroom_member m JOIN classroom c ON c.id = m.classroom_id
         WHERE m.classroom_id = $1 AND m.user_id = $2 AND m.membership_status = 'ACTIVE' FOR UPDATE`,
        [classroomId, actor.id]);
      if (!membership.rows[0] || membership.rows[0].role === "STUDENT" ||
          !domainAllowed(actor.hostedDomain, membership.rows[0].allowed_email_domains)) {
        throw new ClassroomInputError("Classroom not found");
      }
      return classroom.rows[0].roster_version;
    },
    intent: version => ({ classroomId, actorUserId: actor.id, action: "ROSTER_IMPORT_REQUESTED",
      resourceType: "classroom_roster", resourceId: classroomId, before: { rosterVersion: version } }),
    mutate: async client => {
      await upsertRoster(client, classroomId, preview.rows);
      return { students: preview.rows.length, groups: preview.groups.length, warnings: preview.warnings,
        rosterVersion: expectedVersion + 1 };
    },
    committedAfter: result => ({ students: result.students, groups: result.groups, rosterVersion: result.rosterVersion }),
  });
}

export async function listRoster(classroomId: string) {
  const result = await databasePool().query<{ id: string; email: string; display_name: string;
    student_id: string | null; group_name: string }>(`SELECT u.id,u.email_lookup AS email,u.display_name,m.student_number AS student_id,g.name AS group_name
    FROM classroom_member m JOIN app_user u ON u.id=m.user_id JOIN group_entity g ON g.id=m.group_id
    WHERE m.classroom_id=$1 AND m.role='STUDENT' AND m.membership_status='ACTIVE'
    ORDER BY g.name,u.email_lookup`, [classroomId]);
  return result.rows.map(row => ({ id: row.id, email: row.email, displayName: row.display_name,
    studentId: row.student_id, groupName: row.group_name }));
}
