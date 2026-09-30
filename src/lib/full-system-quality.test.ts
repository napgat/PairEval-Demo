import { describe, expect, it } from "vitest";
import { qualityReport } from "./full-system-quality";
import type { ScoreAnswer, ScorePair } from "./full-system-scoring";

function fixture(choices: number[]) {
  const pairs: ScorePair[] = choices.map((_, i) => ({ id: `p${i}`, criterionId: "c1",
    side: "GROUP", aId: "a", bId: `b${i}`, displayLeft: i % 2 ? "B" : "A", evaluatorId: "private-rater-id" }));
  const answers: ScoreAnswer[] = choices.map((choice, i) => ({ pairId: `p${i}`, choice,
    evaluatorId: "private-rater-id", weight: 1 }));
  return { pairs, answers };
}

describe("advisory quality report", () => {
  it("uses strict 80% boundaries and measures displayed position, not canonical item", () => {
    const { pairs, answers } = fixture([1, 1, 1, 1, 6]);
    const report = qualityReport(pairs, answers);
    expect(report.measures.find(row => row.id === "QS-02")).toMatchObject({ count: 4, total: 5, ratio: .8, flagged: false });
    expect(report.measures.find(row => row.id === "QS-03")).toMatchObject({ ratio: .8, flagged: false });
    answers[4].choice = 2;
    const changed = qualityReport(pairs, answers);
    expect(changed.measures.find(row => row.id === "QS-02")?.flagged).toBe(false);
    expect(changed.measures.find(row => row.id === "QS-03")).toMatchObject({ ratio: 1, flagged: true });
    answers[4].choice = 1;
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-02")?.flagged).toBe(true);
  });
  it("detects cycles with reversed display and separates criteria and evaluators", () => {
    const pairs: ScorePair[] = [
      { id: "ab", aId: "a", bId: "b", displayLeft: "A" },
      { id: "bc", aId: "b", bId: "c", displayLeft: "B" },
      { id: "ac", aId: "a", bId: "c", displayLeft: "A" },
    ].map(pair => ({ ...pair, criterionId: "c1", side: "GROUP", evaluatorId: "r1" } as ScorePair));
    const answers: ScoreAnswer[] = [1, 6, 6].map((choice, i) => ({ pairId: pairs[i].id, choice, evaluatorId: "r1", weight: 1 }));
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-04"))
      .toMatchObject({ count: 1, total: 1, ratio: 1, flagged: true });
    answers[2].choice = 1;
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-04"))
      .toMatchObject({ count: 0, total: 1, ratio: 0, flagged: false });
    pairs[2].criterionId = "other-criterion";
    expect(qualityReport(pairs, answers).measures.filter(row => row.id === "QS-04")
      .every(row => row.ratio === null && !row.flagged)).toBe(true);
    pairs[2].criterionId = "c1"; pairs[2].evaluatorId = "r2"; answers[2].evaluatorId = "r2";
    expect(qualityReport(pairs, answers).measures.filter(row => row.id === "QS-04")
      .every(row => row.total === 0)).toBe(true);
  });
  it("counts each complete triangle once and does not count incomplete triples", () => {
    const pairs: ScorePair[] = [];
    for (const [a, b] of [["a", "b"], ["b", "c"], ["a", "c"], ["a", "d"], ["b", "d"], ["c", "d"]]) {
      pairs.push({ id: `${a}${b}`, aId: a, bId: b, criterionId: "c1", side: "GROUP", displayLeft: "A", evaluatorId: "r1" });
    }
    const answers = pairs.map(pair => ({ pairId: pair.id, choice: pair.id === "ac" ? 6 : 1, evaluatorId: "r1", weight: 1 }));
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-04"))
      .toMatchObject({ count: 1, total: 4, ratio: .25, flagged: true });
    answers.splice(2, 1);
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-04")?.total).toBe(2);
  });
  it("keeps inputs intact, avoids evaluator identity in output and handles no answers", () => {
    const { pairs, answers } = fixture([1, 1, 1]);
    const before = JSON.stringify({ pairs, answers });
    expect(JSON.stringify(qualityReport(pairs, answers))).not.toContain("private-rater-id");
    expect(JSON.stringify({ pairs, answers })).toBe(before);
    expect(qualityReport(pairs, []).measures).toEqual([]);
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-04"))
      .toMatchObject({ ratio: null, flagged: false, total: 0 });
    expect(() => qualityReport(pairs, [{ ...answers[0], evaluatorId: "outsider" }])).toThrow();
  });
  it("does not flag exactly 20% cycles", () => {
    const pairs: ScorePair[] = [];
    const answers: ScoreAnswer[] = [];
    for (let i = 0; i < 5; i++) {
      for (const [a, b] of [["a", "b"], ["b", "c"], ["a", "c"]]) {
        const id = `${i}${a}${b}`;
        pairs.push({ id, aId: `${i}${a}`, bId: `${i}${b}`, criterionId: "c1",
          side: "GROUP", displayLeft: "A", evaluatorId: "r1" });
        answers.push({ pairId: id, choice: i === 0 && a === "a" && b === "c" ? 6 : 1,
          evaluatorId: "r1", weight: 1 });
      }
    }
    expect(qualityReport(pairs, answers).measures.find(row => row.id === "QS-04"))
      .toMatchObject({ count: 1, total: 5, ratio: .2, flagged: false });
  });
});
