import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { planPairAssignments, type PairingCriterion, type PairingGroup, type PairingStudent } from "./pairing-engine";

export type CoveragePair = {
  criterionId: string; criterionName: string; kind: "group" | "individual";
  itemAId: string; itemBId: string; itemAName: string; itemBName: string;
  eligibleCount: number; target: number; planned: number; actual: number;
};
export type PairingPreview = {
  assignmentId: string; target: number; status: "ready" | "infeasible" | "generated" | "partial_existing";
  issues: string[]; pairs: CoveragePair[]; totalPairs: number;
  plannedAssignments: number; actualAssignments: number;
  workloads: { evaluatorId: string; name: string; planned: number; actual: number }[];
};

function loadInput(db: DatabaseSync, assignmentId: string) {
  const assignment = db.prepare("SELECT id, classroom_id FROM assignments WHERE id = ?").get(assignmentId) as { id: string; classroom_id: string } | undefined;
  if (!assignment) return null;
  const groups = db.prepare("SELECT id, name FROM groups WHERE classroom_id = ? ORDER BY id").all(assignment.classroom_id) as PairingGroup[];
  const students = db.prepare("SELECT users.id, users.display_name AS name, memberships.group_id AS groupId FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.classroom_id = ? ORDER BY users.id").all(assignment.classroom_id) as PairingStudent[];
  const criteria = db.prepare("SELECT id, kind, name FROM criteria WHERE assignment_id = ? ORDER BY id").all(assignmentId) as PairingCriterion[];
  return { assignmentId, groups, students, criteria, target: 5 };
}

export function getPairingPreview(db: DatabaseSync, assignmentId: string): PairingPreview | null {
  const input = loadInput(db, assignmentId);
  if (!input) return null;
  const plan = planPairAssignments(input);
  const saved = db.prepare("SELECT criterion_id AS criterionId, item_a_id AS itemAId, item_b_id AS itemBId, COUNT(*) AS actual FROM pair_assignments WHERE assignment_id = ? GROUP BY criterion_id, item_a_id, item_b_id").all(assignmentId) as { criterionId: string; itemAId: string; itemBId: string; actual: number }[];
  const actualMap = new Map(saved.map(row => [`${row.criterionId}/${row.itemAId}/${row.itemBId}`, row.actual]));
  const actualAssignments = saved.reduce((sum, row) => sum + row.actual, 0);
  const actualByEvaluator = new Map((db.prepare("SELECT evaluator_id AS evaluatorId, COUNT(*) AS actual FROM pair_assignments WHERE assignment_id = ? GROUP BY evaluator_id").all(assignmentId) as { evaluatorId: string; actual: number }[]).map(row => [row.evaluatorId, row.actual]));
  const plannedByEvaluator = new Map<string, number>();
  if (!plan.issues.length && actualAssignments === 0) for (const item of plan.assignments) plannedByEvaluator.set(item.evaluatorId, (plannedByEvaluator.get(item.evaluatorId) ?? 0) + 1);
  const pairs: CoveragePair[] = plan.pairs.map(pair => ({
    criterionId: pair.criterionId, criterionName: pair.criterionName, kind: pair.kind,
    itemAId: pair.itemAId, itemBId: pair.itemBId, itemAName: pair.itemAName, itemBName: pair.itemBName,
    eligibleCount: pair.eligibleCount, target: plan.target,
    planned: plan.issues.length || actualAssignments ? 0 : pair.selectedEvaluatorIds.length,
    actual: actualMap.get(`${pair.criterionId}/${pair.itemAId}/${pair.itemBId}`) ?? 0,
  }));
  const complete = actualAssignments > 0 && !plan.issues.length && saved.length === pairs.length && actualAssignments === pairs.length * plan.target && pairs.every(pair => pair.actual === plan.target);
  const status: PairingPreview["status"] = actualAssignments > 0 ? complete ? "generated" : "partial_existing" : plan.issues.length ? "infeasible" : "ready";
  const issues = [...plan.issues];
  if (status === "partial_existing") issues.push("ข้อมูลคู่ที่บันทึกไว้ไม่ครบ target; ระบบไม่สร้างทับหรือเติมบางส่วนอัตโนมัติ");
  const workloads = input.students.map(student => ({ evaluatorId: student.id, name: student.name,
    planned: status === "ready" ? plannedByEvaluator.get(student.id) ?? 0 : 0,
    actual: actualByEvaluator.get(student.id) ?? 0 }));
  return { assignmentId, target: plan.target, status, issues, pairs,
    totalPairs: pairs.length, plannedAssignments: status === "ready" ? plan.assignments.length : 0, actualAssignments, workloads };
}

export function savePairingPlan(db: DatabaseSync, assignmentId: string): { preview: PairingPreview | null; result: "created" | "not_found" | "infeasible" | "already_exists" } {
  db.exec("BEGIN IMMEDIATE");
  try {
    const input = loadInput(db, assignmentId);
    if (!input) { db.exec("ROLLBACK"); return { preview: null, result: "not_found" }; }
    const preview = getPairingPreview(db, assignmentId)!;
    if (preview.status !== "ready") {
      db.exec("ROLLBACK");
      return { preview, result: preview.status === "infeasible" ? "infeasible" : "already_exists" };
    }
    const plan = planPairAssignments(input);
    const insert = db.prepare("INSERT INTO pair_assignments VALUES (?, ?, ?, ?, ?, ?)");
    for (const item of plan.assignments) insert.run(randomUUID(), item.assignmentId, item.criterionId, item.evaluatorId, item.itemAId, item.itemBId);
    db.exec("COMMIT");
    return { preview: getPairingPreview(db, assignmentId), result: "created" };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
