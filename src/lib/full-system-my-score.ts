import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";
import { calculateItemScores, participation, type ScoreAnswer, type ScorePair } from "./full-system-scoring";

export async function getMyScore(actor: FullActor, assignmentId: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(assignmentId)) {
    throw new AssignmentInputError("Invalid assignment ID");
  }
  const client = await databasePool().connect();
  try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const scope = await client.query(`SELECT a.id,a.generation,a.status,a.group_max_score,a.individual_max_score,
    a.score_floor,a.score_ceiling,a.min_comparisons,a.completion_threshold,
    m.group_id,c.allowed_email_domains
    FROM assignment a JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=a.classroom_id
    WHERE a.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.role='STUDENT'
      AND m.membership_status='ACTIVE'`, [assignmentId, actor.id]);
  const a = scope.rows[0];
  if (!a || !domainAllowed(actor.hostedDomain, a.allowed_email_domains)) throw new AssignmentNotFoundError("Score not found");
  if (a.generation < 1 || a.status === "DRAFT") throw new AssignmentConflictError("Assignment is not published");
  const [groups, students, criteria, pairs, answers] = await Promise.all([
    client.query<{ id: string }>(`SELECT id FROM group_entity WHERE classroom_id=(SELECT classroom_id FROM assignment WHERE id=$1)`, [assignmentId]),
    client.query<{ id: string }>(`SELECT user_id AS id FROM classroom_member WHERE classroom_id=(SELECT classroom_id FROM assignment WHERE id=$1)
      AND role='STUDENT' AND membership_status='ACTIVE'`, [assignmentId]),
    client.query(`SELECT id,side,weight_pct FROM criterion WHERE assignment_id=$1 AND active`, [assignmentId]),
    client.query(`SELECT id,criterion_id,side,group_a_id,group_b_id,student_a_id,student_b_id,display_left,evaluator_user_id
      FROM pair_assignment WHERE assignment_id=$1 AND generation=$2`, [assignmentId, a.generation]),
    client.query(`SELECT sa.pair_assignment_id,sa.choice,sr.evaluator_user_id,p.side
      FROM (SELECT DISTINCT ON (evaluator_user_id,side) id,evaluator_user_id,side
        FROM submission_revision WHERE assignment_id=$1 AND generation=$2
        ORDER BY evaluator_user_id,side,revision_number DESC) sr
      JOIN submission_answer sa ON sa.revision_id=sr.id
      JOIN pair_assignment p ON p.id=sa.pair_assignment_id
      WHERE p.assignment_id=$1 AND p.generation=$2 AND p.evaluator_user_id=sr.evaluator_user_id
        AND p.side=sr.side`, [assignmentId, a.generation]),
  ]);
  const scorePairs: ScorePair[] = pairs.rows.map(p => ({ id: p.id, criterionId: p.criterion_id,
    side: p.side, aId: p.side === "GROUP" ? p.group_a_id : p.student_a_id,
    bId: p.side === "GROUP" ? p.group_b_id : p.student_b_id,
    displayLeft: p.display_left, evaluatorId: p.evaluator_user_id }));
  const scoreAnswers: ScoreAnswer[] = answers.rows.map(row => ({ pairId: row.pair_assignment_id,
    choice: row.choice, evaluatorId: row.evaluator_user_id, weight: 1 }));
  const values = calculateItemScores({ criteria: criteria.rows.map(c => ({ id: c.id, side: c.side,
    weightPct: Number(c.weight_pct) })), pairs: scorePairs, answers: scoreAnswers,
    groupIds: groups.rows.map(g => g.id), studentIds: students.rows.map(s => s.id),
    settings: { groupMax: Number(a.group_max_score), individualMax: Number(a.individual_max_score),
      floor: Number(a.score_floor), ceiling: Number(a.score_ceiling), minComparisons: a.min_comparisons,
      kMin: 3, completionThreshold: Number(a.completion_threshold) } });
  const group = values.find(item => item.side === "GROUP" && item.itemId === a.group_id);
  const individual = values.find(item => item.side === "INDIVIDUAL" && item.itemId === actor.id);
  const assigned = scorePairs.filter(pair => pair.evaluatorId === actor.id).length;
  const answered = scoreAnswers.filter(answer => answer.evaluatorId === actor.id).length;
  const { p, M } = participation(answered, assigned, Number(a.completion_threshold));
  const groupComponent = group?.component ?? null;
  const individualAvailable = Number(a.individual_max_score) === 0 || !!individual?.anonymous;
  const individualComponent = Number(a.individual_max_score) === 0 ? 0 : individualAvailable ? individual?.component ?? null : null;
  const total = groupComponent === null || individualComponent === null ? null :
    (groupComponent + individualComponent) * M;
  const result = { assignmentId, status: "INTERIM", label: "ชั่วคราว — อาจเปลี่ยนแปลงได้",
    groupComponent, individualComponent, individualStatus: Number(a.individual_max_score) === 0 ? "DISABLED" :
      individualAvailable ? individualComponent === null ? "NO_DATA" : "AVAILABLE" : "INSUFFICIENT_DATA",
    groupStatus: groupComponent === null ? "NO_DATA" : "AVAILABLE", total,
    answered, assigned, p, M,
    lowConfidence: !!group?.criteria.some(c => c.lowConfidence) || !!individual?.criteria.some(c => c.lowConfidence) };
  await client.query("COMMIT");
  return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
