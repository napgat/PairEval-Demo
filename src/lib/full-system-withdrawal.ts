import { randomUUID } from "node:crypto";
import type { FullActor } from "./full-system-auth";
import { requireOwner, MemberNotFoundError } from "./full-system-members";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { planFullSystemPairs, type PairCriterion, type PairStudent, type PlannedComparison } from "./full-system-pairing";
import { recomputeMutationScores } from "./full-system-score-runs";
import { enqueueAssignmentNotifications } from "./full-system-notifications";

const validId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
const key = (p: PlannedComparison) => [p.criterionId, p.side, p.aId, p.bId, p.evaluatorId].join(":");

/** OQ-4 provisional development policy. Real records and future effective times are not supported. */
export async function withdrawSyntheticStudent(actor: FullActor, classroomId: string, userId: string,
    raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AssignmentInputError("Invalid withdrawal request");
  const input = raw as Record<string, unknown>;
  if (!validId(classroomId) || !validId(userId) || typeof input.reason !== "string" ||
      input.reason.trim().length < 10 || input.reason.length > 1000 || typeof input.effectiveAt !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(input.effectiveAt) || !Number.isFinite(Date.parse(input.effectiveAt)) ||
      !Number.isSafeInteger(input.expectedRosterVersion) || Number(input.expectedRosterVersion) < 0) throw new AssignmentInputError("Invalid withdrawal request");
  if (!["development", "staging"].includes(process.env.PAIR_EVAL_ENV ?? "")) {
    throw new AssignmentConflictError("Synthetic withdrawal is available only in development/staging");
  }
  const reason = input.reason.trim(); const effectiveAt = new Date(input.effectiveAt).toISOString();
  return runAuditedMutation({
    prepare: async client => {
      try { await requireOwner(client, actor, classroomId); }
      catch (error) { if (error instanceof MemberNotFoundError) throw new AssignmentNotFoundError("Classroom not found"); throw error; }
      const roster = await client.query(`SELECT roster_version FROM classroom WHERE id=$1`, [classroomId]);
      if (roster.rows[0].roster_version !== input.expectedRosterVersion) throw new AssignmentConflictError("Roster changed since preview");
      const member = await client.query(`SELECT m.membership_status,u.email_lookup FROM classroom_member m
        JOIN app_user u ON u.id=m.user_id WHERE m.classroom_id=$1 AND m.user_id=$2 AND m.role='STUDENT' FOR UPDATE OF m`, [classroomId, userId]);
      if (!member.rows[0]) throw new AssignmentNotFoundError("Student not found");
      if (member.rows[0].membership_status !== "ACTIVE") throw new AssignmentConflictError("Student is already withdrawn");
      const synthetic = await client.query(`SELECT bool_and(u.email_lookup LIKE '%@example.test' OR u.email_lookup LIKE '%.invalid') AS ok
        FROM classroom_member m JOIN app_user u ON u.id=m.user_id WHERE m.classroom_id=$1 AND m.role='STUDENT'`, [classroomId]);
      if (!synthetic.rows[0].ok) throw new AssignmentConflictError("Only an entirely synthetic student roster is supported");
      const time = await client.query(`SELECT $1::timestamptz <= clock_timestamp() AS effective`, [effectiveAt]);
      if (!time.rows[0].effective) throw new AssignmentConflictError("Future effective withdrawal is not supported");
      const jobs = await client.query(`SELECT id,generation,status,target_coverage,max_workload,group_max_score,individual_max_score
        FROM assignment WHERE classroom_id=$1 AND status NOT IN ('DRAFT','ARCHIVED') ORDER BY id FOR UPDATE`, [classroomId]);
      if (jobs.rows.some(row => row.status === "FINALIZED")) throw new AssignmentConflictError("Reopen finalized assignments before withdrawal correction");
      return jobs.rows;
    },
    intent: jobs => ({ actorUserId: actor.id, classroomId, action: "STUDENT_WITHDRAW_REQUESTED",
      resourceType: "classroom_member", resourceId: userId, reason,
      before: { membershipStatus: "ACTIVE", rosterVersion: input.expectedRosterVersion },
      after: { membershipStatus: "WITHDRAWN", effectiveAt, assignments: jobs.map(row => row.id) } }),
    mutate: async (client, jobs) => {
      await client.query(`UPDATE classroom_member SET membership_status='WITHDRAWN',withdrawn_at=$3
        WHERE classroom_id=$1 AND user_id=$2`, [classroomId, userId, effectiveAt]);
      await client.query(`UPDATE classroom SET roster_version=roster_version+1 WHERE id=$1`, [classroomId]);
      const students = (await client.query<{ id: string; groupId: string }>(`SELECT user_id AS id,group_id AS "groupId"
        FROM classroom_member WHERE classroom_id=$1 AND role='STUDENT' AND membership_status='ACTIVE' ORDER BY user_id`, [classroomId])).rows;
      const groups = [...new Set(students.map(student => student.groupId))];
      const results = [];
      for (const a of jobs) {
        const criteria = (await client.query<PairCriterion>(`SELECT id,side FROM criterion WHERE assignment_id=$1 AND active ORDER BY id`, [a.id])).rows;
        const old = (await client.query<PlannedComparison>(`SELECT criterion_id AS "criterionId",side,
          COALESCE(group_a_id,student_a_id) AS "aId",COALESCE(group_b_id,student_b_id) AS "bId",
          evaluator_user_id AS "evaluatorId",display_left AS "displayLeft" FROM active_pair_assignment
          WHERE assignment_id=$1 AND generation=$2 AND source<>'INSTRUCTOR_SELF' ORDER BY id`, [a.id, a.generation])).rows;
        const plan = planFullSystemPairs({ students: students as PairStudent[], groups, criteria,
          targetCoverage: a.target_coverage, maxWorkload: a.max_workload, seed: `withdrawal:${a.id}:${userId}`,
          groupEnabled: Number(a.group_max_score) > 0, individualEnabled: Number(a.individual_max_score) > 0, fixed: old });
        if (!plan.feasible) throw new AssignmentConflictError(`Withdrawal reassignment infeasible: ${plan.parts.map(p => p.reason).filter(Boolean).join("; ")}`);
        const existing = new Set(old.map(key));
        const additions = plan.comparisons.filter(p => !existing.has(key(p)));
        const artifacts = (await client.query<{ side: string; item_id: string; url: string }>(`SELECT 'GROUP' AS side,group_id AS item_id,artifact_url AS url
          FROM group_artifact WHERE assignment_id=$1 UNION ALL SELECT 'INDIVIDUAL',student_user_id,artifact_url
          FROM individual_artifact WHERE assignment_id=$1`, [a.id])).rows;
        const artifact = (p: PlannedComparison, itemId: string) => artifacts.find(row => row.side === p.side && row.item_id === itemId)?.url ?? null;
        for (const p of additions) await client.query(`INSERT INTO pair_assignment
          (id,assignment_id,criterion_id,side,group_a_id,group_b_id,student_a_id,student_b_id,evaluator_user_id,display_left,generation,left_artifact_url,right_artifact_url)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [randomUUID(), a.id, p.criterionId, p.side,
          p.side === "GROUP" ? p.aId : null, p.side === "GROUP" ? p.bId : null,
          p.side === "INDIVIDUAL" ? p.aId : null, p.side === "INDIVIDUAL" ? p.bId : null,
          p.evaluatorId, p.displayLeft, a.generation, artifact(p, p.displayLeft === "A" ? p.aId : p.bId), artifact(p, p.displayLeft === "A" ? p.bId : p.aId)]);
        const snapshot = await recomputeMutationScores(client, actor, a.id);
        const notifications = await enqueueAssignmentNotifications(client, { assignmentId: a.id, classroomId,
          generation: a.generation, event: "PAIRS_REGENERATED", keySuffix: `withdrawal:${userId}` });
        results.push({ assignmentId: a.id, generation: a.generation, addedPairs: additions.length,
          parts: plan.parts, snapshotId: snapshot.id, snapshotNo: snapshot.snapshotNo, notifications });
      }
      return { userId, membershipStatus: "WITHDRAWN", effectiveAt, rosterVersion: Number(input.expectedRosterVersion) + 1, assignments: results };
    },
    committedAfter: result => result,
  });
}
