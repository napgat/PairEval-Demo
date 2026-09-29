import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";

export type EvaluationSide = "GROUP" | "INDIVIDUAL";
const sideOk = (side: string): side is EvaluationSide => side === "GROUP" || side === "INDIVIDUAL";
const idOk = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
type Scope = { classroom_id: string; generation: number; status: string; deadline: Date | null;
  group_id: string; group_size: number; timezone: string; deadline_open: boolean };

async function scope(client: PoolClient, actor: FullActor, assignmentId: string, side: EvaluationSide,
    lock = false): Promise<Scope> {
  const found = await client.query<Scope & { allowed_email_domains: string[] }>(`SELECT a.classroom_id,a.generation,a.status,
    ${side === "GROUP" ? "a.group_deadline_utc" : "a.individual_deadline_utc"} AS deadline,
    (${side === "GROUP" ? "a.group_deadline_utc" : "a.individual_deadline_utc"} > clock_timestamp()) AS deadline_open,
    m.group_id,c.timezone,c.allowed_email_domains,
    (SELECT count(*)::integer FROM classroom_member peer WHERE peer.classroom_id=a.classroom_id
      AND peer.group_id=m.group_id AND peer.role='STUDENT' AND peer.membership_status='ACTIVE') AS group_size
    FROM assignment a JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=a.classroom_id
    WHERE a.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.role='STUDENT'
      AND m.membership_status='ACTIVE' ${lock ? "FOR UPDATE OF a" : ""}`, [assignmentId, actor.id]);
  const row = found.rows[0];
  if (!row || !domainAllowed(actor.hostedDomain, row.allowed_email_domains)) {
    throw new AssignmentNotFoundError("Evaluation not found");
  }
  if (side === "INDIVIDUAL" && row.group_size <= 2) throw new AssignmentConflictError("Individual evaluation is disabled for groups of two or fewer");
  if (row.generation < 1) throw new AssignmentConflictError("Assignment is not published");
  return row;
}
function writable(row: Scope): void {
  if (row.status !== "OPEN" || !row.deadline_open) {
    throw new AssignmentConflictError("Evaluation deadline passed or assignment is not OPEN");
  }
}
async function eligiblePair(client: PoolClient, assignmentId: string, evaluatorId: string,
    side: EvaluationSide, generation: number, pairId: string): Promise<void> {
  const found = await client.query(`SELECT 1 FROM pair_assignment WHERE id=$1 AND assignment_id=$2
    AND evaluator_user_id=$3 AND side=$4 AND generation=$5`, [pairId, assignmentId, evaluatorId, side, generation]);
  if (found.rowCount !== 1) throw new AssignmentNotFoundError("Pair not assigned to this evaluator");
}
export async function getEvaluation(actor: FullActor, assignmentId: string, side: string) {
  if (!idOk(assignmentId) || !sideOk(side)) throw new AssignmentInputError("Invalid evaluation path");
  const client = await databasePool().connect();
  try {
    const row = await scope(client, actor, assignmentId, side);
    const criteria = await client.query(`SELECT id,name,description,weight_pct FROM criterion
      WHERE assignment_id=$1 AND side=$2 AND active ORDER BY display_order`, [assignmentId, side]);
    const pairs = await client.query(`SELECT p.id,p.criterion_id,p.left_artifact_url,p.right_artifact_url,
      CASE WHEN p.display_left='A' THEN COALESCE(ga.name,ua.display_name) ELSE COALESCE(gb.name,ub.display_name) END AS left_name,
      CASE WHEN p.display_left='A' THEN COALESCE(gb.name,ub.display_name) ELSE COALESCE(ga.name,ua.display_name) END AS right_name,
      d.choice AS draft_choice, sa.choice AS submitted_choice
      FROM pair_assignment p
      LEFT JOIN group_entity ga ON ga.id=p.group_a_id LEFT JOIN group_entity gb ON gb.id=p.group_b_id
      LEFT JOIN app_user ua ON ua.id=p.student_a_id LEFT JOIN app_user ub ON ub.id=p.student_b_id
      LEFT JOIN evaluation_draft_answer d ON d.pair_assignment_id=p.id AND d.assignment_id=p.assignment_id
        AND d.evaluator_user_id=$2 AND d.side=$3 AND d.generation=p.generation
      LEFT JOIN submission_revision sr ON sr.id=(SELECT latest.id FROM submission_revision latest
        WHERE latest.assignment_id=p.assignment_id AND latest.evaluator_user_id=$2
          AND latest.side=$3 AND latest.generation=p.generation ORDER BY latest.revision_number DESC LIMIT 1)
      LEFT JOIN submission_answer sa ON sa.revision_id=sr.id AND sa.pair_assignment_id=p.id
      WHERE p.assignment_id=$1 AND p.evaluator_user_id=$2 AND p.side=$3 AND p.generation=$4
      ORDER BY p.criterion_id,p.id`, [assignmentId, actor.id, side, row.generation]);
    const submitted = await client.query(`SELECT revision_number,submitted_at FROM submission_revision
      WHERE assignment_id=$1 AND evaluator_user_id=$2 AND side=$3 AND generation=$4
      ORDER BY revision_number DESC LIMIT 1`, [assignmentId, actor.id, side, row.generation]);
    const draft = await client.query(`SELECT updated_at FROM evaluation_draft WHERE assignment_id=$1
      AND evaluator_user_id=$2 AND side=$3 AND generation=$4`, [assignmentId, actor.id, side, row.generation]);
    return { assignmentId, side, generation: row.generation, timezone: row.timezone,
      deadline: row.deadline?.toISOString() ?? null, readOnly: row.status !== "OPEN" || !row.deadline_open,
      disabledReason: side === "INDIVIDUAL" && pairs.rows.length === 0 ? "No individual pairs are assigned" : null,
      criteria: criteria.rows.map(c => ({ id: c.id, name: c.name, description: c.description, weightPct: Number(c.weight_pct) })),
      pairs: pairs.rows.map(p => ({ id: p.id, criterionId: p.criterion_id, leftName: p.left_name,
        rightName: p.right_name, leftArtifactUrl: p.left_artifact_url, rightArtifactUrl: p.right_artifact_url,
        choice: p.draft_choice ?? p.submitted_choice ?? null })),
      draftSavedAt: draft.rows[0]?.updated_at?.toISOString() ?? null,
      latestSubmission: submitted.rows[0] ? { revision: submitted.rows[0].revision_number,
        submittedAt: submitted.rows[0].submitted_at.toISOString() } : null };
  } finally { client.release(); }
}

export async function listStudentAssignments(actor: FullActor, classroomId: string) {
  if (!idOk(classroomId)) throw new AssignmentInputError("Invalid classroom ID");
  const found = await databasePool().query(`SELECT c.timezone,c.allowed_email_domains,m.group_id,
    (SELECT count(*)::integer FROM classroom_member peer WHERE peer.classroom_id=c.id
      AND peer.group_id=m.group_id AND peer.role='STUDENT' AND peer.membership_status='ACTIVE') AS group_size
    FROM classroom c JOIN classroom_member m ON m.classroom_id=c.id
    WHERE c.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.role='STUDENT'
      AND m.membership_status='ACTIVE'`, [classroomId, actor.id]);
  const row = found.rows[0];
  if (!row || !domainAllowed(actor.hostedDomain, row.allowed_email_domains)) {
    throw new AssignmentNotFoundError("Classroom not found");
  }
  const assignments = await databasePool().query(`SELECT id,name,description,status,generation,
    group_max_score,individual_max_score,group_deadline_utc,individual_deadline_utc
    FROM assignment WHERE classroom_id=$1 AND generation>0 AND status IN ('OPEN','CLOSED','FINALIZED')
    ORDER BY created_at DESC`, [classroomId]);
  return { timezone: row.timezone, assignments: assignments.rows.map(a => ({ id: a.id, name: a.name,
    description: a.description, status: a.status, groupEnabled: Number(a.group_max_score) > 0,
    individualEnabled: Number(a.individual_max_score) > 0 && row.group_size > 2,
    individualDisabledReason: Number(a.individual_max_score) > 0 && row.group_size <= 2 ?
      "กลุ่มมีสมาชิกไม่เกิน 2 คน จึงไม่มีการประเมินรายบุคคล" : null,
    groupDeadline: a.group_deadline_utc?.toISOString() ?? null,
    individualDeadline: a.individual_deadline_utc?.toISOString() ?? null })) };
}

export async function saveEvaluationDraft(actor: FullActor, assignmentId: string, side: string,
    pairId: string, choice: number | null) {
  if (!idOk(assignmentId) || !sideOk(side) || !idOk(pairId) || choice !== null &&
      (!Number.isInteger(choice) || choice < 1 || choice > 6)) throw new AssignmentInputError("Invalid evaluation answer");
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN");
    const row = await scope(client, actor, assignmentId, side, true); writable(row);
    await eligiblePair(client, assignmentId, actor.id, side, row.generation, pairId);
    await client.query(`INSERT INTO evaluation_draft (assignment_id,evaluator_user_id,side,generation)
      VALUES ($1,$2,$3,$4) ON CONFLICT (assignment_id,evaluator_user_id,side,generation)
      DO UPDATE SET updated_at=now()`, [assignmentId, actor.id, side, row.generation]);
    if (choice === null) await client.query(`DELETE FROM evaluation_draft_answer WHERE assignment_id=$1
      AND evaluator_user_id=$2 AND side=$3 AND generation=$4 AND pair_assignment_id=$5`,
    [assignmentId, actor.id, side, row.generation, pairId]);
    else await client.query(`INSERT INTO evaluation_draft_answer
      (assignment_id,evaluator_user_id,side,generation,pair_assignment_id,choice)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (assignment_id,evaluator_user_id,side,generation,pair_assignment_id)
      DO UPDATE SET choice=EXCLUDED.choice,updated_at=now()`,
    [assignmentId, actor.id, side, row.generation, pairId, choice]);
    await client.query("COMMIT");
    return { saved: true, pairId, choice };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function submitEvaluation(actor: FullActor, assignmentId: string, side: string) {
  if (!idOk(assignmentId) || !sideOk(side)) throw new AssignmentInputError("Invalid evaluation path");
  return runAuditedMutation({
    prepare: async client => {
      const row = await scope(client, actor, assignmentId, side, true); writable(row);
      return row;
    },
    intent: row => ({ actorUserId: actor.id, classroomId: row.classroom_id,
      action: "EVALUATION_SUBMIT_REQUESTED", resourceType: "assignment", resourceId: assignmentId,
      before: { side, generation: row.generation } }),
    mutate: async (client, row) => {
      writable(await scope(client, actor, assignmentId, side, true));
      const answers = await client.query<{ pair_assignment_id: string; choice: number }>(`SELECT d.pair_assignment_id,d.choice
        FROM evaluation_draft_answer d JOIN pair_assignment p ON p.id=d.pair_assignment_id
        WHERE d.assignment_id=$1 AND d.evaluator_user_id=$2 AND d.side=$3 AND d.generation=$4
          AND p.assignment_id=$1 AND p.evaluator_user_id=$2 AND p.side=$3 AND p.generation=$4`,
      [assignmentId, actor.id, side, row.generation]);
      if (!answers.rows.length) throw new AssignmentConflictError("Answer at least one pair before submitting");
      const number = await client.query<{ n: number }>(`SELECT COALESCE(max(revision_number),0)::integer+1 AS n
        FROM submission_revision WHERE assignment_id=$1 AND evaluator_user_id=$2 AND side=$3 AND generation=$4`,
      [assignmentId, actor.id, side, row.generation]);
      const revisionId = randomUUID();
      await client.query(`INSERT INTO submission_revision (id,assignment_id,evaluator_user_id,side,generation,revision_number)
        VALUES ($1,$2,$3,$4,$5,$6)`, [revisionId, assignmentId, actor.id, side, row.generation, number.rows[0].n]);
      for (const answer of answers.rows) await client.query(`INSERT INTO submission_answer
        (revision_id,pair_assignment_id,choice) VALUES ($1,$2,$3)`, [revisionId, answer.pair_assignment_id, answer.choice]);
      const assigned = await client.query<{ n: number }>(`SELECT count(*)::integer AS n FROM pair_assignment
        WHERE assignment_id=$1 AND evaluator_user_id=$2 AND side=$3 AND generation=$4`,
      [assignmentId, actor.id, side, row.generation]);
      return { revision: number.rows[0].n, answered: answers.rows.length, assigned: assigned.rows[0].n };
    },
    committedAfter: result => result,
  });
}
