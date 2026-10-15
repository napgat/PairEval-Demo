import type { ScoreAnswer, ScorePair } from "./full-system-scoring";
import type { QualityMeasure } from "./full-system-quality";

export type SyntheticQualityContext = { synthetic: boolean; timingEnabled?: boolean;
  students: Array<{ id: string; groupId: string }>;
  friendships: Array<{ evaluatorId: string; friendId: string }> };
type Vote = { pair: ScorePair; answer: ScoreAnswer };
const key = (p: ScorePair) => JSON.stringify([p.criterionId, ...[p.aId, p.bId].sort()]);
const credit = (v: Vote, id: string) => {
  const left = 6 - v.answer.choice;
  const a = v.pair.displayLeft === "A" ? left : 5 - left;
  return (id === v.pair.aId ? a : 5 - a) / 5;
};
/** Midranks. Integer preference credits avoid floating-point tie ambiguity. */
export function midranks(values: number[]) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
  const ranks = Array(values.length).fill(0) as number[];
  for (let i = 0; i < order.length;) {
    let j = i + 1; while (j < order.length && order[j].value === order[i].value) j++;
    for (let k = i; k < j; k++) ranks[order[k].index] = (i + 1 + j) / 2;
    i = j;
  }
  return ranks;
}
/** Complete subjects-by-raters panel; Kendall W with the standard tie correction. */
export function kendallW(rankRows: number[][]): number | null {
  const m = rankRows.length, n = rankRows[0]?.length ?? 0;
  if (m < 3 || n < 3 || rankRows.some(r => r.length !== n || r.some(x => !Number.isFinite(x)))) return null;
  let tieCorrection = 0;
  for (const row of rankRows) {
    // Require actual permutations of midranks, not arbitrary scores.
    const groups = new Map<number, number>(); row.forEach(r => groups.set(r, (groups.get(r) ?? 0) + 1));
    let position = 1;
    for (const [rank, t] of [...groups].sort(([a], [b]) => a - b)) {
      if (rank !== position + (t - 1) / 2) throw new Error("Invalid rank panel");
      position += t; tieCorrection += t ** 3 - t;
    }
  }
  const denominator = m * m * (n ** 3 - n) - m * tieCorrection;
  if (denominator <= 0) return null;
  const expected = m * (n + 1) / 2;
  const s = Array.from({ length: n }, (_, i) => (rankRows.reduce((sum, row) => sum + row[i], 0) - expected) ** 2).reduce((a, b) => a + b, 0);
  return Math.max(0, Math.min(1, 12 * s / denominator));
}

export function advancedQualityMeasures(pairs: ScorePair[], answers: ScoreAnswer[], codes: Map<string, string>, context?: SyntheticQualityContext): QualityMeasure[] {
  const pairById = new Map(pairs.map(p => [p.id, p]));
  const votes: Vote[] = answers.map(answer => ({ answer, pair: pairById.get(answer.pairId)! }));
  const output: QualityMeasure[] = [];
  const add = (id: QualityMeasure["id"], evaluatorCode: string, side: ScorePair["side"], criterionId: string | null,
      count: number, total: number, ratio: number | null, threshold: number, operator: ">" | "<", reason: string, evidence: string) => {
    output.push({ id, evaluatorCode, side, criterionId, count, total, ratio, threshold, operator,
      flagged: ratio !== null && (operator === ">" ? ratio > threshold + 1e-12 : ratio < threshold - 1e-12), reason, evidence });
  };
  const buckets = new Map<string, Vote[]>();
  for (const v of votes) {
    const k = JSON.stringify([v.pair.evaluatorId, v.pair.side]);
    buckets.set(k, [...(buckets.get(k) ?? []), v]);
  }
  for (const values of buckets.values()) {
    const p = values[0].pair;
    const timed = values.filter(v => (context?.synthetic || context?.timingEnabled) && Number.isSafeInteger(v.answer.activeDurationMs) &&
      Number(v.answer.activeDurationMs) >= 0 && Number(v.answer.activeDurationMs) <= 86400000);
    const all = timed.length === values.length;
    const seconds = timed.reduce((sum, v) => sum + v.answer.activeDurationMs! / 1000, 0);
    add("QS-05", codes.get(p.evaluatorId)!, p.side, null, timed.length, values.length,
      all ? seconds / timed.length : null, 3, "<", !context?.synthetic && !context?.timingEnabled ? "REAL_TELEMETRY_DISABLED" : all ? "COMPLETE_ACTIVE_DURATION" : "INCOMPLETE_ACTIVE_DURATION",
      `timed=${timed.length}; submitted=${values.length}; activeSeconds=${seconds}`);
  }
  const groups = new Map(context?.students.map(s => [s.id, s.groupId]) ?? []);
  const friends = new Map<string, Set<string>>();
  for (const f of context?.synthetic ? context.friendships : []) {
    if (f.evaluatorId !== f.friendId && groups.has(f.evaluatorId) && groups.get(f.evaluatorId) === groups.get(f.friendId)) {
      const set = friends.get(f.evaluatorId) ?? new Set<string>(); set.add(f.friendId); friends.set(f.evaluatorId, set);
    }
  }
  const criteria = new Map<string, Vote[]>();
  for (const v of votes) {
    const k = JSON.stringify([v.pair.side, v.pair.criterionId]);
    criteria.set(k, [...(criteria.get(k) ?? []), v]);
  }
  for (const values of criteria.values()) {
    const first = values[0].pair;
    const byRater = new Map<string, Vote[]>();
    for (const v of values) byRater.set(v.pair.evaluatorId, [...(byRater.get(v.pair.evaluatorId) ?? []), v]);
    if (first.side === "INDIVIDUAL") for (const [rater, rows] of byRater) {
      const fs = friends.get(rater) ?? new Set<string>();
      const matched = rows.filter(v => groups.get(rater) === groups.get(v.pair.aId) && groups.get(rater) === groups.get(v.pair.bId) &&
        fs.has(v.pair.aId) !== fs.has(v.pair.bId));
      const reference: number[] = [];
      for (const [other, otherVotes] of byRater) {
        if (other === rater || !groups.has(other) || groups.get(other) !== groups.get(rater)) continue;
        const referenceVotes = matched.map(v => otherVotes.find(o => key(o.pair) === key(v.pair)));
        if (referenceVotes.some(v => !v) || matched.some(v => friends.get(other)?.has(v.pair.aId) || friends.get(other)?.has(v.pair.bId))) continue;
        if (matched.length) reference.push(referenceVotes.reduce((sum, v, i) => sum + credit(v!, fs.has(matched[i].pair.aId) ? matched[i].pair.aId : matched[i].pair.bId), 0) / matched.length);
      }
      const mean = reference.reduce((a, b) => a + b, 0) / reference.length;
      const sd = Math.sqrt(reference.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (reference.length - 1));
      const target = matched.reduce((sum, v) => sum + credit(v, fs.has(v.pair.aId) ? v.pair.aId : v.pair.bId), 0) / matched.length;
      const zeroVariance = reference.length > 1 && Math.max(...reference) - Math.min(...reference) < 1e-12;
      const reason = !context?.synthetic ? "SYNTHETIC_FRIEND_SOURCE_REQUIRED" : !fs.size ? "NO_EXPLICIT_FRIENDS" : matched.length < 3 ? "MIN_3_MATCHED_COMPARISONS" : reference.length < 5 ? "MIN_5_REFERENCE_RATERS" : zeroVariance ? "ZERO_REFERENCE_VARIANCE" : "MATCHED_REFERENCE_COHORT";
      const z = reason === "MATCHED_REFERENCE_COHORT" ? (target - mean) / sd : null;
      add("QS-06", codes.get(rater)!, first.side, first.criterionId, matched.length, reference.length, z, 2, ">", reason,
        `matched=${matched.length}; referenceRaters=${reference.length}; model=descriptive-z-v1`);
    }
    // Complete common panels are separated; sparse raters are shown as unassessable, never imputed.
    const panels = new Map<string, { items: string[]; rows: Vote[][] }>();
    let sparse = 0;
    for (const rows of byRater.values()) {
      const items = [...new Set(rows.flatMap(v => [v.pair.aId, v.pair.bId]))].sort();
      if (items.length < 3 || rows.length !== items.length * (items.length - 1) / 2 || new Set(rows.map(v => key(v.pair))).size !== rows.length) { sparse++; continue; }
      const k = JSON.stringify(items); const panel = panels.get(k) ?? { items, rows: [] }; panel.rows.push(rows); panels.set(k, panel);
    }
    let ordinal = 0;
    for (const [, panel] of [...panels].sort(([a], [b]) => a.localeCompare(b))) {
      ordinal++;
      const ranks = panel.rows.map(rows => midranks(panel.items.map(id => rows.filter(v => v.pair.aId === id || v.pair.bId === id)
        .reduce((sum, v) => sum + Math.round(credit(v, id) * 5), 0))));
      const w = kendallW(ranks);
      add("QS-07", `Panel ${String(ordinal).padStart(3, "0")}`, first.side, first.criterionId, panel.rows.length, panel.items.length,
        w, .2, "<", panel.rows.length < 3 ? "MIN_3_COMPLETE_RATERS" : w === null ? "ALL_TIED_PANEL" : "COMPLETE_COMMON_PANEL",
        `raters=${panel.rows.length}; items=${panel.items.length}; incompleteRaters=${sparse}; model=complete-credit-midrank-W-v1`);
    }
    if (!panels.size || sparse) add("QS-07", "Incomplete panel", first.side, first.criterionId, sparse, 0, null, .2, "<",
      "INCOMPLETE_RANK_PANEL", `incompleteRaters=${sparse}; no missing votes invented`);
  }
  return output;
}
