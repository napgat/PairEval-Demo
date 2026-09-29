import { describe, expect, it } from "vitest";
import { calculateItemScores, choicePoints, mappedScore, participation } from "./full-system-scoring";

describe("PRD v2.1 scoring", () => {
  it("maps all six forced choices and preserves displayed side", () => {
    expect([1, 2, 3, 4, 5, 6].map(choicePoints)).toEqual([
      [1, 0], [0.8, 0.2], [0.6, 0.4], [0.4, 0.6], [0.2, 0.8], [0, 1]]);
    const scored = calculateItemScores({ criteria: [{ id: "c", side: "GROUP", weightPct: 100 }],
      pairs: [{ id: "p", criterionId: "c", side: "GROUP", aId: "a", bId: "b", displayLeft: "B", evaluatorId: "e" }],
      answers: [{ pairId: "p", choice: 1, evaluatorId: "e", weight: 1 }], groupIds: ["a", "b"], studentIds: [],
      settings: { groupMax: 10, individualMax: 0, floor: .6, ceiling: 1, minComparisons: 3,
        kMin: 3, completionThreshold: .9 } });
    expect(scored.map(item => item.component)).toEqual([6, 10]);
    expect(scored.every(item => item.criteria[0].lowConfidence)).toBe(true);
  });
  it("matches PRD worked example and participation math", () => {
    const group = mappedScore(.72, 40, 15, .6, 1) + mappedScore(.55, 35, 15, .6, 1) +
      mappedScore(.61, 25, 15, .6, 1);
    const individual = mappedScore(.68, 50, 5, .6, 1) + mappedScore(.45, 50, 5, .6, 1);
    expect(group).toBeCloseTo(12.798, 6);
    expect(individual).toBeCloseTo(4.13, 6);
    expect(group + individual).toBeCloseTo(16.928, 6);
    const partial = mappedScore(.31, 50, 5, .6, 1) + mappedScore(.35, 50, 5, .6, 1);
    const { p, M } = participation(9, 15, .9);
    expect(partial).toBeCloseTo(3.66, 6);
    expect(p).toBeCloseTo(.6, 6); expect(M).toBeCloseTo(2 / 3, 6);
    expect((group + partial) * M).toBeCloseTo(10.972, 3);
  });
  it("distinguishes no submitted data from a low-confidence value and enforces k threshold", () => {
    const input = { criteria: [{ id: "c", side: "INDIVIDUAL" as const, weightPct: 100 }],
      pairs: [{ id: "p", criterionId: "c", side: "INDIVIDUAL" as const, aId: "a", bId: "b", displayLeft: "A" as const, evaluatorId: "e" }],
      groupIds: [] as string[], studentIds: ["a", "b"],
      settings: { groupMax: 0, individualMax: 5, floor: .6, ceiling: 1, minComparisons: 3,
        kMin: 3, completionThreshold: .9 } };
    const none = calculateItemScores({ ...input, answers: [] });
    expect(none[0].component).toBeNull(); expect(none[0].anonymous).toBe(false);
    const one = calculateItemScores({ ...input, answers: [{ pairId: "p", choice: 2, evaluatorId: "e", weight: 1 }] });
    expect(one[0].component).not.toBeNull(); expect(one[0].anonymous).toBe(false);
    expect(one[0].criteria[0].lowConfidence).toBe(true);
  });
});
