import { databasePool } from "./full-system-postgres";
import { writeAuditIntent } from "./full-system-audit";
import type { FullActor } from "./full-system-auth";

export class EntitlementInputError extends Error {}
export class EntitlementNotFoundError extends Error {}

export async function listFacultyEntitlements(limit: number, cursor: string | null) {
  const result = await databasePool().query<{ id: string; can_create_classroom: boolean }>(
    `SELECT id,can_create_classroom FROM app_user
     WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`, [cursor, limit + 1]);
  const rows = result.rows.slice(0, limit);
  return { items: rows.map(row => ({ userId: row.id, canCreateClassroom: row.can_create_classroom })),
    nextCursor: result.rows.length > limit ? rows.at(-1)?.id ?? null : null };
}

export async function setFacultyEntitlement(actor: FullActor, userId: string, enabled: boolean, reason: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || typeof enabled !== "boolean" ||
      typeof reason !== "string" || reason.trim().length < 3 || reason.length > 500) {
    throw new EntitlementInputError("Invalid entitlement change");
  }
  await writeAuditIntent({ actorUserId: actor.id, action: "FACULTY_ENTITLEMENT_CHANGE_REQUESTED",
    resourceType: "app_user", resourceId: userId });
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN");
    const admin = await client.query("SELECT 1 FROM app_user WHERE id=$1 AND platform_role='SYSTEM_ADMIN' AND status='ACTIVE' FOR UPDATE", [actor.id]);
    if (admin.rowCount !== 1) throw new EntitlementInputError("SYSTEM_ADMIN role required");
    const updated = await client.query<{ id: string; can_create_classroom: boolean }>(
      "UPDATE app_user SET can_create_classroom=$2 WHERE id=$1 AND status <> 'DISABLED' RETURNING id,can_create_classroom",
      [userId, enabled]);
    if (!updated.rows[0]) throw new EntitlementNotFoundError("User not found");
    await client.query("COMMIT");
    return { userId: updated.rows[0].id, canCreateClassroom: updated.rows[0].can_create_classroom };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
