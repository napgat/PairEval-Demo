import type { FullActor } from "./full-system-auth";
import { domainAllowed } from "./full-system-auth";
import { databasePool } from "./full-system-postgres";
import { runAuditedMutation } from "./full-system-audit-outbox";
import {
  AssignmentForbiddenError,
  AssignmentNotFoundError,
} from "./full-system-assignments";
import type { ScoreRun } from "./full-system-score-runs";
export async function archivedClassrooms(actor: FullActor) {
  const result = await databasePool().query(
    "SELECT c.id,c.name,c.timezone,m.role,c.allowed_email_domains FROM classroom c JOIN classroom_member m ON m.classroom_id=c.id WHERE c.status='ARCHIVED' AND m.user_id=$1 AND m.membership_status='ACTIVE' ORDER BY c.created_at DESC",
    [actor.id],
  );
  return result.rows
    .filter((r) => domainAllowed(actor.hostedDomain, r.allowed_email_domains))
    .map(({ id, name, timezone, role }) => ({ id, name, timezone, role }));
}
export async function setClassroomArchived(
  actor: FullActor,
  id: string,
  archived: boolean,
) {
  return runAuditedMutation({
    prepare: async (client) => {
      const r = await client.query(
        "SELECT c.status,c.allowed_email_domains,m.role FROM classroom c JOIN classroom_member m ON m.classroom_id=c.id WHERE c.id=$1 AND m.user_id=$2 AND m.membership_status='ACTIVE' FOR UPDATE OF c",
        [id, actor.id],
      );
      const row = r.rows[0];
      if (!row || !domainAllowed(actor.hostedDomain, row.allowed_email_domains))
        throw new AssignmentNotFoundError("Classroom not found");
      if (row.role !== "OWNER")
        throw new AssignmentForbiddenError(
          "Only the Owner can archive classrooms",
        );
      return row;
    },
    intent: (row) => ({
      actorUserId: actor.id,
      classroomId: id,
      action: "CLASSROOM_ARCHIVE_REQUESTED",
      resourceType: "classroom",
      resourceId: id,
      before: { status: row.status },
      after: { status: archived ? "ARCHIVED" : "ACTIVE" },
    }),
    mutate: async (client) => {
      await client.query("UPDATE classroom SET status=$2 WHERE id=$1", [
        id,
        archived ? "ARCHIVED" : "ACTIVE",
      ]);
      return { id, status: archived ? "ARCHIVED" : "ACTIVE" };
    },
  });
}
export async function archivedClassroom(actor: FullActor, id: string) {
  const room = (await archivedClassrooms(actor)).find((r) => r.id === id);
  if (!room) throw new AssignmentNotFoundError("Archive not found");
  const rows = await databasePool().query<{
    id: string;
    name: string;
    status: string;
    output: ScoreRun | null;
  }>(
    `SELECT a.id,a.name,a.status,(SELECT output_json FROM score_snapshot s WHERE s.assignment_id=a.id AND s.generation=a.generation ORDER BY snapshot_no DESC LIMIT 1)AS output FROM assignment a WHERE a.classroom_id=$1 ORDER BY a.created_at DESC`,
    [id],
  );
  const instructor = ["OWNER", "CO_TEACHER"].includes(room.role);
  return {
    room,
    assignments: rows.rows.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      students:
        room.role === "TA"
          ? []
          : (a.output?.students ?? [])
              .filter((s) => instructor || s.id === actor.id)
              .map((s) => ({
                name: s.displayName,
                total:
                  !instructor && s.flags.includes("BELOW_K") ? null : s.total,
                kind: a.output!.kind,
              })),
    })),
  };
}
