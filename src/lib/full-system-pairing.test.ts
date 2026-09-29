import { describe, expect, it } from "vitest";
import { planFullSystemPairs, type PairStudent } from "./full-system-pairing";

const students = (sizes: number[]): PairStudent[] => sizes.flatMap((size, group) =>
  Array.from({ length: size }, (_, index) => ({ id: `u${group}-${index}`, groupId: `g${group}` })));
const plan = (sizes: number[], side: "GROUP" | "INDIVIDUAL", cap = 8, seed = "7") =>
  planFullSystemPairs({ students: students(sizes), groups: sizes.map((_, index) => `g${index}`),
    criteria: [{ id: "criterion", side }], targetCoverage: 5, maxWorkload: cap,
    seed, groupEnabled: true, individualEnabled: true });

describe("Full System deterministic bounded pairing", () => {
  it("gives each group pair exact feasible coverage with no self-group evaluator", () => {
    const result = plan([4, 4, 4], "GROUP");
    expect(result.feasible).toBe(true);
    expect(result.parts[0]).toMatchObject({ pairCount: 3, coverage: 4, assignmentCount: 12 });
    const byId = new Map(students([4, 4, 4]).map(student => [student.id, student.groupId]));
    for (const row of result.comparisons) {
      expect(byId.get(row.evaluatorId)).not.toBe(row.aId);
      expect(byId.get(row.evaluatorId)).not.toBe(row.bId);
    }
    const loads = Object.values(result.parts[0].workload);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
  });

  it("reports two groups infeasible without fabricating evaluators", () => {
    const result = plan([7, 7], "GROUP");
    expect(result.feasible).toBe(false);
    expect(result.parts[0].coverage).toBe(0);
    expect(result.parts[0].reason).toContain("minEligible=0");
    expect(result.comparisons).toHaveLength(0);
  });
  it("reduces target coverage to the highest feasible positive value with numerical reason", () => {
    const result = plan([3, 5, 4], "GROUP");
    expect(result.feasible).toBe(true);
    expect(result.parts[0]).toMatchObject({ pairCount: 3, requested: 5,
      coverage: 3, assignmentCount: 9 });
    expect(result.parts[0].reason).toContain("actual=3");
    expect(result.parts[0].reason).toContain("minEligible=3");
  });

  it("keeps individual evaluators in group and off their pair, with workload cap", () => {
    const result = plan([7], "INDIVIDUAL", 8);
    expect(result.feasible).toBe(true);
    expect(result.parts[0].pairCount).toBe(21);
    expect(result.parts[0].coverage).toBeLessThan(5);
    const loads = Object.values(result.parts[0].workload);
    expect(Math.max(...loads)).toBeLessThanOrEqual(8);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
    for (const row of result.comparisons) {
      expect(row.evaluatorId).not.toBe(row.aId); expect(row.evaluatorId).not.toBe(row.bId);
    }
  });

  it("disables individual groups of size two and flags size three", () => {
    const result = plan([2, 3], "INDIVIDUAL");
    expect(result.parts[0].coverage).toBe(0);
    expect(result.parts[1]).toMatchObject({ coverage: 1, lowConfidence: true });
    expect(result.comparisons).toHaveLength(3);
  });

  it("reproduces pair assignment and left/right with the same seed", () => {
    const a = plan([6, 6, 6, 6], "GROUP", 8, "same");
    expect(a).toEqual(plan([6, 6, 6, 6], "GROUP", 8, "same"));
    expect(a.comparisons).not.toEqual(plan([6, 6, 6, 6], "GROUP", 8, "different").comparisons);
    for (const part of a.parts) expect(part.assignmentCount).toBe(part.pairCount * part.coverage);
  });

  it("preserves uniqueness, eligibility, exact coverage and balanced loads across synthetic sizes", () => {
    for (const sizes of [[3, 3, 3], [4, 5, 6], [2, 4, 7], [7, 7, 7, 7]]) {
      for (const side of ["GROUP", "INDIVIDUAL"] as const) {
        const result = plan(sizes, side);
        const owner = new Map(students(sizes).map(student => [student.id, student.groupId]));
        const unique = new Set<string>();
        for (const part of result.parts) {
          const actual = result.comparisons.filter(row => row.criterionId === part.criterionId &&
            (side === "GROUP" || owner.get(row.aId) === part.groupId));
          expect(actual).toHaveLength(part.assignmentCount);
          expect(part.assignmentCount).toBe(part.pairCount * part.coverage);
          const loads = Object.values(part.workload);
          if (loads.length) expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
        }
        for (const row of result.comparisons) {
          expect(row.aId < row.bId).toBe(true);
          expect(row.evaluatorId).not.toBe(row.aId); expect(row.evaluatorId).not.toBe(row.bId);
          if (side === "GROUP") expect([row.aId, row.bId]).not.toContain(owner.get(row.evaluatorId));
          else expect(owner.get(row.evaluatorId)).toBe(owner.get(row.aId));
          const key = `${row.criterionId}:${row.aId}:${row.bId}:${row.evaluatorId}`;
          expect(unique.has(key)).toBe(false); unique.add(key);
        }
      }
    }
  });
});
