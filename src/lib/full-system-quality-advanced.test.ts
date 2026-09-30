import { describe, expect, it } from "vitest";
import { qualityReport } from "./full-system-quality";
import { kendallW, midranks, type SyntheticQualityContext } from "./full-system-quality-advanced";
import { calculateItemScores, type ScorePair, type ScoreAnswer } from "./full-system-scoring";

function friendshipFixture() {
  const pairs: ScorePair[] = [], answers: ScoreAnswer[] = [];
  const evaluator = "private-target", friend = "private-friend";
  const others = ["a", "b", "c"];
  const raters = [evaluator, ...Array.from({ length: 5 }, (_, i) => `private-reference-${i}`)];
  for (const [r, id] of raters.entries()) for (const [i, item] of others.entries()) {
    const pair: ScorePair = { id: `${r}-${i}`, aId: item, bId: friend, evaluatorId: id, criterionId: "individual", side: "INDIVIDUAL", displayLeft: r % 2 ? "B" : "A" };
    const f = r === 0 ? 1 : [0, .2, .2, .4, .4][r - 1];
    pairs.push(pair); answers.push({ pairId: pair.id, evaluatorId: id, weight: 1, choice: pair.displayLeft === "B" ? 6 - f * 5 : 1 + f * 5, activeDurationMs: 2000 });
  }
  const context: SyntheticQualityContext = { synthetic: true,
    students: [...raters, friend, ...others].map(id => ({ id, groupId: "synthetic-group" })),
    friendships: [{ evaluatorId: evaluator, friendId: friend }] };
  return { pairs, answers, context };
}
function panel(rankRows: number[][]) {
  const pairs: ScorePair[] = [], answers: ScoreAnswer[] = [];
  for (const [r, ranks] of rankRows.entries()) for (let a = 0; a < ranks.length; a++) for (let b = a + 1; b < ranks.length; b++) {
    const p: ScorePair = { id: `${r}-${a}-${b}`, criterionId: "c", side: "GROUP", aId: `item-${a}`, bId: `item-${b}`, evaluatorId: `private-rater-${r}`, displayLeft: r % 2 ? "B" : "A" };
    const aWins = ranks[a] < ranks[b];
    pairs.push(p); answers.push({ pairId: p.id, evaluatorId: p.evaluatorId, weight: 1, choice: aWins === (p.displayLeft === "A") ? 1 : 6 });
  }
  return { pairs, answers };
}
describe("synthetic QS-05–07 statistical definitions", () => {
  it("uses complete recorded active durations, the strict 3-second boundary and disables real telemetry", () => {
    const f = friendshipFixture();
    const target = () => qualityReport(f.pairs, f.answers, f.context).measures.find(v => v.id === "QS-05" && v.evaluatorCode === "Evaluator 006")!;
    f.answers.slice(0, 3).forEach(a => { a.activeDurationMs = 3000; });
    expect(target()).toMatchObject({ ratio: 3, flagged: false, count: 3, total: 3 });
    f.answers[0].activeDurationMs = 2999; expect(target().flagged).toBe(true);
    f.answers[0].activeDurationMs = null; expect(target()).toMatchObject({ ratio: null, flagged: false, reason: "INCOMPLETE_ACTIVE_DURATION" });
    f.context.synthetic = false;
    expect(qualityReport(f.pairs, f.answers, f.context).measures.filter(v => v.id === "QS-05").every(v => v.ratio === null)).toBe(true);
  });
  it("matches explicit friends to independent raters of identical comparisons; checks a numeric z example", () => {
    const f = friendshipFixture(); const before = JSON.stringify(f);
    const r = qualityReport(f.pairs, f.answers, f.context);
    const row = r.measures.find(v => v.id === "QS-06" && v.reason === "MATCHED_REFERENCE_COHORT")!;
    expect(row).toMatchObject({ count: 3, total: 5, flagged: true });
    expect(row.ratio).toBeCloseTo(.76 / Math.sqrt(.028), 12);
    expect(JSON.stringify(r)).not.toContain("private-target"); expect(JSON.stringify(r)).not.toContain("private-friend");
    expect(JSON.stringify(f)).toBe(before);
    const settings = { groupMax: 0, individualMax: 10, floor: .6, ceiling: 1, minComparisons: 3, kMin: 3, completionThreshold: .9 };
    const scores = () => calculateItemScores({ ...f, criteria: [{ id: "individual", side: "INDIVIDUAL", weightPct: 100 }], groupIds: [], studentIds: f.context.students.map(s => s.id), settings });
    const previous = scores(); qualityReport(f.pairs, f.answers, f.context); expect(scores()).toEqual(previous);
  });
  it("does not infer friendship from group membership and handles insufficient/constant reference data", () => {
    const f = friendshipFixture(); f.context.friendships = [];
    expect(qualityReport(f.pairs, f.answers, f.context).measures.filter(v => v.id === "QS-06").every(v => v.ratio === null && v.reason === "NO_EXPLICIT_FRIENDS")).toBe(true);
    f.context.friendships = [{ evaluatorId: "private-target", friendId: "private-friend" }];
    f.answers.splice(-3);
    expect(qualityReport(f.pairs, f.answers, f.context).measures.find(v => v.id === "QS-06" && v.evaluatorCode === "Evaluator 006"))
      .toMatchObject({ ratio: null, reason: "MIN_5_REFERENCE_RATERS" });
    const z = friendshipFixture(); z.answers.slice(3).forEach(a => { a.choice = 3; });
    // Use identical canonical friend credit despite alternating left/right.
    z.answers.slice(3).forEach(a => { a.choice = z.pairs.find(p => p.id === a.pairId)!.displayLeft === "B" ? 5 : 2; });
    expect(qualityReport(z.pairs, z.answers, z.context).measures.find(v => v.id === "QS-06" && v.evaluatorCode === "Evaluator 006"))
      .toMatchObject({ ratio: null, reason: "ZERO_REFERENCE_VARIANCE" });
  });
  it("does not flag the exact z = 2 boundary with valid forced-choice votes", () => {
    const f = friendshipFixture();
    // Three comparisons per rater: integer friend-credit sums are 3 vs [0,0,1,2,2].
    // Reference mean and sample SD are both 1/15; target mean is 3/15, so z = 2.
    const credits = [[1, 1, 1], [0, 0, 0], [0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 0]];
    f.answers.forEach((answer, i) => {
      const units = credits[Math.floor(i / 3)][i % 3];
      answer.choice = f.pairs[i].displayLeft === "B" ? 6 - units : 1 + units;
    });
    const row = () => qualityReport(f.pairs, f.answers, f.context).measures.find(v => v.id === "QS-06" && v.reason === "MATCHED_REFERENCE_COHORT")!;
    expect(row().ratio).toBeCloseTo(2, 12); expect(row().flagged).toBe(false);
    f.answers[0].choice = 3;
    expect(row().ratio).toBeCloseTo(3, 12); expect(row().flagged).toBe(true);
  });
  it("uses valid complete rank panels with ties and leaves all-tied/undersized panels unassessable", () => {
    expect(midranks([10, 5, 5])).toEqual([1, 2.5, 2.5]);
    expect(kendallW([[1, 2, 3], [1, 2, 3], [1, 2, 3]])).toBe(1);
    expect(kendallW([[1, 2, 3], [2, 3, 1], [3, 1, 2]])).toBe(0);
    expect(kendallW([[1, 2.5, 2.5], [1, 2, 3], [1, 3, 2]])).toBeCloseTo(9 / 11, 12);
    expect(kendallW([[2, 2, 2], [2, 2, 2], [2, 2, 2]])).toBeNull();
    expect(kendallW([[1, 2, 3], [1, 2, 3]])).toBeNull();
    expect(() => kendallW([[1, 1, 3], [1, 2, 3], [1, 2, 3]])).toThrow("Invalid rank panel");
  });
  it("uses strict W < .2 without filling sparse votes or leaking identities", () => {
    const f = panel([[1, 2, 3, 4], [1, 2, 3, 4], [4, 2, 3, 1]]);
    const row = qualityReport(f.pairs, f.answers).measures.find(v => v.id === "QS-07")!;
    expect(row).toMatchObject({ ratio: .2, flagged: false, count: 3, total: 4 });
    const low = panel([[1, 2, 3], [2, 3, 1], [3, 1, 2]]);
    const q = qualityReport(low.pairs, low.answers);
    expect(q.measures.find(v => v.id === "QS-07")).toMatchObject({ ratio: 0, flagged: true });
    expect(JSON.stringify(q)).not.toContain("private-rater");
    low.answers.pop(); const sparse = qualityReport(low.pairs, low.answers);
    expect(sparse.measures.filter(v => v.id === "QS-07").every(v => v.ratio === null && !v.flagged)).toBe(true);
  });
});
