import type { DatabaseSync } from "node:sqlite";
import { calculateScores, type ScoreInput, type ScoreKind, type ScoreResult } from "./score-engine";

export type AssignmentScore = { assignmentId: string; assignmentName: string; classroomId: string; groupDeadline: string; individualDeadline: string; result: ScoreResult };
export type PairAnswerCoverage = { criterionName: string; kind: ScoreKind; itemAName: string; itemBName: string; answered: number; assigned: number };

export function getPairAnswerCoverage(db: DatabaseSync, assignmentId: string): PairAnswerCoverage[] {
  const names = new Map((db.prepare(`SELECT id, name FROM groups UNION ALL SELECT id, display_name AS name FROM users`).all() as { id: string; name: string }[]).map(row => [row.id, row.name]));
  const rows = db.prepare(`SELECT criteria.name AS criterionName, criteria.kind,
    pair_assignments.item_a_id AS itemAId, pair_assignments.item_b_id AS itemBId,
    COUNT(*) AS assigned, COUNT(submission_answers.revision_id) AS answered
    FROM pair_assignments JOIN criteria ON criteria.id = pair_assignments.criterion_id
    LEFT JOIN submission_revisions ON submission_revisions.id = (
      SELECT id FROM submission_revisions AS latest
      WHERE latest.assignment_id = pair_assignments.assignment_id AND latest.evaluator_id = pair_assignments.evaluator_id AND latest.kind = criteria.kind
      ORDER BY latest.revision_number DESC LIMIT 1)
    LEFT JOIN submission_answers ON submission_answers.revision_id = submission_revisions.id AND submission_answers.pair_assignment_id = pair_assignments.id
    WHERE pair_assignments.assignment_id = ?
    GROUP BY pair_assignments.criterion_id, pair_assignments.item_a_id, pair_assignments.item_b_id
    ORDER BY criteria.kind, criteria.name, pair_assignments.item_a_id, pair_assignments.item_b_id`).all(assignmentId) as { criterionName: string; kind: ScoreKind; itemAId: string; itemBId: string; answered: number; assigned: number }[];
  return rows.map(row => ({ criterionName: row.criterionName, kind: row.kind, itemAName: names.get(row.itemAId) ?? row.itemAId,
    itemBName: names.get(row.itemBId) ?? row.itemBId, answered: row.answered, assigned: row.assigned }));
}

export function getAssignmentScore(db: DatabaseSync, assignmentId: string): AssignmentScore | null {
  const assignment = db.prepare("SELECT id, name, classroom_id AS classroomId, group_max AS groupMax, individual_max AS individualMax, group_deadline AS groupDeadline, individual_deadline AS individualDeadline FROM assignments WHERE id = ?")
    .get(assignmentId) as { id: string; name: string; classroomId: string; groupMax: number; individualMax: number; groupDeadline: string; individualDeadline: string } | undefined;
  if (!assignment) return null;
  const groups = db.prepare("SELECT id, name FROM groups WHERE classroom_id = ? ORDER BY name").all(assignment.classroomId) as ScoreInput["groups"];
  const students = db.prepare("SELECT users.id, users.display_name AS name, memberships.group_id AS groupId FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.classroom_id = ? ORDER BY users.id").all(assignment.classroomId) as ScoreInput["students"];
  const criteria = db.prepare("SELECT id, name, kind, weight_percent AS weightPercent FROM criteria WHERE assignment_id = ? ORDER BY id").all(assignmentId) as ScoreInput["criteria"];
  const pairs = db.prepare("SELECT id, criterion_id AS criterionId, evaluator_id AS evaluatorId, item_a_id AS itemAId, item_b_id AS itemBId FROM pair_assignments WHERE assignment_id = ?").all(assignmentId) as ScoreInput["pairs"];
  const rows = db.prepare("SELECT id, evaluator_id AS evaluatorId, kind, revision_number AS number FROM submission_revisions WHERE assignment_id = ? ORDER BY revision_number").all(assignmentId) as { id: string; evaluatorId: string; kind: ScoreKind; number: number }[];
  const getAnswers = db.prepare("SELECT pair_assignment_id AS pairId, choice FROM submission_answers WHERE revision_id = ?");
  const revisions: ScoreInput["revisions"] = rows.map(row => ({ ...row, submitted: true, answers: getAnswers.all(row.id) as { pairId: string; choice: number }[] }));
  return { assignmentId, assignmentName: assignment.name, classroomId: assignment.classroomId,
    groupDeadline: assignment.groupDeadline, individualDeadline: assignment.individualDeadline,
    result: calculateScores({ assignment, groups, students, criteria, pairs, revisions }) };
}

export function mayViewReport(db: DatabaseSync, assignmentId: string, instructorId: string): boolean {
  return !!db.prepare("SELECT 1 FROM assignments JOIN classroom_instructors ON classroom_instructors.classroom_id = assignments.classroom_id WHERE assignments.id = ? AND classroom_instructors.user_id = ?").get(assignmentId, instructorId);
}

export function mayViewOwnScore(db: DatabaseSync, assignmentId: string, studentId: string): boolean {
  return !!db.prepare("SELECT 1 FROM assignments JOIN memberships ON memberships.classroom_id = assignments.classroom_id WHERE assignments.id = ? AND memberships.user_id = ?").get(assignmentId, studentId);
}

export function scoreStatus(score: AssignmentScore, now = new Date()): "Interim" | "Final" {
  return !score.result.hasNoData && now.getTime() >= Date.parse(score.groupDeadline) && now.getTime() >= Date.parse(score.individualDeadline) ? "Final" : "Interim";
}

export function formatScore(value: number | null): string { return value === null ? "NO_DATA" : value.toFixed(2); }

function csvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function makeScoreCsv(score: AssignmentScore): string {
  const header = ["assignment", "group", "student_id", "student", "group_base", "individual_base", "group_score", "individual_score", "total", "group_answered", "group_assigned", "individual_answered", "individual_assigned", "status"];
  const status = scoreStatus(score);
  const groupNames = new Map(score.result.groups.map(group => [group.id, group.name]));
  const lines = [header.map(csvCell).join(",")];
  for (const student of score.result.students) lines.push([
    score.assignmentName, groupNames.get(student.groupId) ?? student.groupId, student.id, student.name,
    formatScore(student.groupBase), formatScore(student.individualBase), formatScore(student.groupScore), formatScore(student.individualScore), formatScore(student.total),
    student.groupAnswered, student.groupAssigned, student.individualAnswered, student.individualAssigned, status,
  ].map(csvCell).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
