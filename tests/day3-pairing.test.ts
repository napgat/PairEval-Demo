import { describe, expect, it } from "vitest";
import { planPairAssignments, type PairingInput } from "../src/lib/pairing-engine";

function fixture(sizes: number[]): PairingInput {
  const groups = sizes.map((_, index) => ({ id: `group-${index + 1}`, name: `Group ${index + 1}` }));
  const students = groups.flatMap((group, groupIndex) => Array.from({ length: sizes[groupIndex] }, (_, index) => ({ id: `${group.id}-student-${index + 1}`, groupId: group.id, name: `${group.name} Student ${index + 1}` })));
  return { assignmentId: "assignment-test", groups, students, criteria: [
    { id: "group-criterion-1", kind: "group", name: "Group 1" },
    { id: "group-criterion-2", kind: "group", name: "Group 2" },
    { id: "individual-criterion", kind: "individual", name: "Individual" },
  ], target: 5 };
}

describe("Pairing Engine", () => {
  it("covers every group and individual pair with five distinct eligible evaluators", () => {
    const input = fixture([7, 7, 7]);
    const plan = planPairAssignments(input);
    expect(plan.issues).toEqual([]);
    expect(plan.pairs).toHaveLength(69);
    expect(plan.assignments).toHaveLength(345);
    const studentById = new Map(input.students.map(student => [student.id, student]));
    for (const pair of plan.pairs) {
      expect(pair.selectedEvaluatorIds).toHaveLength(5);
      expect(new Set(pair.selectedEvaluatorIds).size).toBe(5);
      expect(pair.eligibleCount).toBeGreaterThanOrEqual(5);
      for (const evaluatorId of pair.selectedEvaluatorIds) {
        const evaluator = studentById.get(evaluatorId)!;
        if (pair.kind === "group") {
          expect(evaluator.groupId).not.toBe(pair.itemAId);
          expect(evaluator.groupId).not.toBe(pair.itemBId);
        } else {
          expect(evaluator.id).not.toBe(pair.itemAId);
          expect(evaluator.id).not.toBe(pair.itemBId);
          expect(studentById.get(pair.itemAId)?.groupId).toBe(evaluator.groupId);
          expect(studentById.get(pair.itemBId)?.groupId).toBe(evaluator.groupId);
        }
      }
    }
    const loads = input.students.map(student => plan.assignments.filter(item => item.evaluatorId === student.id).length);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(2);
  });
  it("rejects the two-group, two-person seed shape without any assignments", () => {
    const plan = planPairAssignments(fixture([2, 2]));
    expect(plan.pairs).toHaveLength(4);
    expect(plan.assignments).toHaveLength(0);
    expect(plan.issues).toHaveLength(4);
    expect(plan.pairs.every(pair => pair.selectedEvaluatorIds.length === 0)).toBe(true);
    expect(plan.issues.some(issue => issue.includes("ต้องการ 5 คน"))).toBe(true);
  });
  it("does not produce a partial group plan when individual coverage is infeasible", () => {
    const plan = planPairAssignments(fixture([6, 6, 6]));
    expect(plan.pairs.filter(pair => pair.kind === "group").every(pair => pair.eligibleCount >= 5)).toBe(true);
    expect(plan.pairs.filter(pair => pair.kind === "individual").every(pair => pair.eligibleCount === 4)).toBe(true);
    expect(plan.assignments).toHaveLength(0);
  });
  it("is deterministic for the same assignment and roster", () => {
    const input = fixture([7, 7, 7]);
    expect(planPairAssignments(input)).toEqual(planPairAssignments(input));
  });
});
