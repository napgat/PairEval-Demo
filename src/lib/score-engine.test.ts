import { describe, expect, it } from "vitest";
import { choicePoints, calculateScores, applyCompletion, type ScoreInput } from "./score-engine";

const example: ScoreInput = {
  assignment: { id: "a", groupMax: 15, individualMax: 5, groupDeadline: "2030-01-01", individualDeadline: "2030-01-01" },
  groups: [{ id: "gA", name: "A" }, { id: "gB", name: "B" }],
  students: [{ id: "a1", name: "A1", groupId: "gA" }, { id: "a2", name: "A2", groupId: "gA" }, { id: "a3", name: "A3", groupId: "gA" }],
  criteria: [{ id: "quality", name: "คุณภาพ", kind: "group", weightPercent: 60 }, { id: "presentation", name: "นำเสนอ", kind: "group", weightPercent: 40 }, { id: "team", name: "ร่วมมือ", kind: "individual", weightPercent: 100 }],
  pairs: [
    { id: "q", criterionId: "quality", evaluatorId: "a1", itemAId: "gA", itemBId: "gB" },
    { id: "p", criterionId: "presentation", evaluatorId: "a1", itemAId: "gA", itemBId: "gB" },
    { id: "i12", criterionId: "team", evaluatorId: "a3", itemAId: "a1", itemBId: "a2" },
    { id: "i13", criterionId: "team", evaluatorId: "a2", itemAId: "a1", itemBId: "a3" },
    { id: "i23", criterionId: "team", evaluatorId: "a1", itemAId: "a2", itemBId: "a3" },
  ],
  revisions: [
    { id: "rq", evaluatorId: "a1", kind: "group", number: 1, submitted: true, answers: [{ pairId: "q", choice: 2 }, { pairId: "p", choice: 4 }] },
    { id: "ri12", evaluatorId: "a3", kind: "individual", number: 1, submitted: true, answers: [{ pairId: "i12", choice: 2 }] },
    { id: "ri13", evaluatorId: "a2", kind: "individual", number: 1, submitted: true, answers: [{ pairId: "i13", choice: 1 }] },
    { id: "ri23", evaluatorId: "a1", kind: "individual", number: 1, submitted: true, answers: [{ pairId: "i23", choice: 3 }] },
  ],
};

describe("PRD v2.0 scoring in the offline Demo", () => {
  it("maps all six choices to complementary points", () => {
    expect([1, 2, 3, 4, 5, 6].map(choicePoints)).toEqual([[1, 0], [.8, .2], [.6, .4], [.4, .6], [.2, .8], [0, 1]]);
  });
  it("matches the hand calculation for weighted Group and Individual", () => {
    const result = calculateScores(example);
    // qA = .8*.6 + .4*.4 = .64; each item gets its own .6+.4q band.
    expect(result.groups.find(row => row.id === "gA")?.baseScore).toBeCloseTo(12.84);
    expect(result.groups.find(row => row.id === "gB")?.baseScore).toBeCloseTo(11.16);
    expect(result.students.find(row => row.id === "a1")?.individualBase).toBeCloseTo(4.8);
    expect(result.students.find(row => row.id === "a2")?.individualBase).toBeCloseTo(3.8);
    expect(result.students.find(row => row.id === "a3")?.individualBase).toBeCloseTo(3.4);
    expect(applyCompletion(12, 10, 9, true)).toBe(12);
    expect(applyCompletion(12, 10, 6, true)).toBeCloseTo(8);
    expect(applyCompletion(12, 10, 9, false)).toBe(0);
    for (const pair of example.pairs.filter(pair => pair.criterionId === "team")) {
      expect([pair.itemAId, pair.itemBId]).not.toContain(pair.evaluatorId);
    }
  });
  it("ignores draft and old revision, and re-submit changes score", () => {
    const revisions: ScoreInput["revisions"] = [...example.revisions,
      { id: "draft", evaluatorId: "a1", kind: "group", number: 9, submitted: false, answers: [{ pairId: "q", choice: 6 }] },
      { id: "r2", evaluatorId: "a1", kind: "group", number: 2, submitted: true, answers: [{ pairId: "q", choice: 6 }, { pairId: "p", choice: 4 }] },
    ];
    const result = calculateScores({ ...example, revisions });
    expect(result.groups.find(row => row.id === "gA")?.baseScore).toBeCloseTo(9.96);
    expect(result.groups.find(row => row.id === "gB")?.baseScore).toBeCloseTo(14.04);
  });
  it("applies TOTAL participation to both personal components without changing group base", () => {
    const input: ScoreInput = { ...example,
      pairs: [...example.pairs, { id: "q2", criterionId: "quality", evaluatorId: "a1", itemAId: "gA", itemBId: "gB" }, { id: "q3", criterionId: "quality", evaluatorId: "a2", itemAId: "gA", itemBId: "gB" }],
      revisions: example.revisions,
    };
    const result = calculateScores(input);
    const a1 = result.students.find(row => row.id === "a1")!;
    const a2 = result.students.find(row => row.id === "a2")!;
    expect(a1.p).toBe(.75);
    expect(a1.M).toBeCloseTo(5 / 6);
    expect(a1.groupScore).toBeCloseTo(10.7);
    expect(a1.individualScore).toBeCloseTo(4);
    expect(a2.M).toBeCloseTo(5 / 9);
    expect(a2.groupScore).toBeCloseTo(12.84 * 5 / 9);
    expect(result.groups.find(row => row.id === "gA")?.baseScore).toBeCloseTo(12.84);
  });
  it("marks uncovered items NO_DATA", () => {
    const result = calculateScores({ ...example, revisions: [] });
    expect(result.groups.every(row => row.baseScore === null)).toBe(true);
    expect(result.students.find(row => row.id === "a1")?.groupScore).toBeNull();
    expect(result.students.find(row => row.id === "a1")?.individualScore).toBeNull();
  });
  it("band maps individuals without dividing their scores by cohort size", () => {
    const students = ["a", "b"].flatMap(groupId => [1, 2, 3].map(n => ({ id: `${groupId}${n}`, name: `${groupId}${n}`, groupId })));
    const pairs = ["a", "b"].flatMap(groupId => [[1, 2, 3], [1, 3, 2], [2, 3, 1]].map(([a, b, evaluator]) => ({ id: `${groupId}${a}${b}`, criterionId: "team", evaluatorId: `${groupId}${evaluator}`, itemAId: `${groupId}${a}`, itemBId: `${groupId}${b}` })));
    const revisions = students.map(student => ({ id: `r-${student.id}`, evaluatorId: student.id, kind: "individual" as const, number: 1, submitted: true,
      answers: pairs.filter(pair => pair.evaluatorId === student.id).map(pair => ({ pairId: pair.id, choice: 2 })) }));
    const result = calculateScores({ ...example, groups: [{ id: "a", name: "A" }, { id: "b", name: "B" }], students,
      criteria: [{ id: "team", name: "team", kind: "individual", weightPercent: 100 }], pairs, revisions });
    expect(result.items.filter(item => item.groupId === "a").reduce((sum, item) => sum + item.points!, 0)).toBeCloseTo(12);
    expect(result.items.filter(item => item.groupId === "b").reduce((sum, item) => sum + item.points!, 0)).toBeCloseTo(12);
  });
});
