import type { ScoreAnswer, ScorePair, ScoreSide } from "./full-system-scoring";
import { advancedQualityMeasures, type SyntheticQualityContext } from "./full-system-quality-advanced";

export type QualityMeasure = {
  id: "QS-02" | "QS-03" | "QS-04" | "QS-05" | "QS-06" | "QS-07";
  evaluatorCode: string;
  side: ScoreSide;
  criterionId: string | null;
  count: number;
  total: number;
  ratio: number | null;
  threshold: number;
  flagged: boolean;
  operator?: ">" | "<";
  reason?: string;
  evidence?: string;
};
export type QualityReport = { version: string; measures: QualityMeasure[] };

/** Advisory only. Uses the same submitted revision inputs as scoring, without changing them. */
export function qualityReport(pairs: ScorePair[], answers: ScoreAnswer[], context?: SyntheticQualityContext): QualityReport {
  const pairById = new Map(pairs.map(pair => [pair.id, pair]));
  // Codes are local to this snapshot; no evaluator UUID or name is exposed in this report.
  const codes = new Map([...new Set(pairs.map(pair => pair.evaluatorId))].sort()
    .map((id, index) => [id, `Evaluator ${String(index + 1).padStart(3, "0")}`]));
  const buckets = new Map<string, { evaluatorId: string; side: ScoreSide;
    values: Array<{ pair: ScorePair; choice: number }> }>();
  for (const answer of answers) {
    const pair = pairById.get(answer.pairId);
    if (!pair || pair.evaluatorId !== answer.evaluatorId || !Number.isInteger(answer.choice) ||
        answer.choice < 1 || answer.choice > 6) throw new Error("Invalid quality answer scope");
    const key = `${pair.evaluatorId}:${pair.side}`;
    const bucket = buckets.get(key) ?? { evaluatorId: pair.evaluatorId, side: pair.side, values: [] };
    bucket.values.push({ pair, choice: answer.choice });
    buckets.set(key, bucket);
  }
  const measures: QualityMeasure[] = [];
  for (const [, bucket] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
    const evaluatorCode = codes.get(bucket.evaluatorId)!;
    const add = (id: QualityMeasure["id"], count: number, total: number,
        threshold: number, criterionId: string | null = null) => {
      const ratio = total ? count / total : null;
      measures.push({ id, evaluatorCode, side: bucket.side, criterionId, count, total, ratio,
        threshold, flagged: ratio !== null && ratio > threshold });
    };
    const choices = [1, 2, 3, 4, 5, 6].map(choice =>
      bucket.values.filter(value => value.choice === choice).length);
    add("QS-02", Math.max(...choices), bucket.values.length, .8);
    const left = bucket.values.filter(value => value.choice <= 3).length;
    add("QS-03", Math.max(left, bucket.values.length - left), bucket.values.length, .8);
    const criteria = [...new Set(bucket.values.map(value => value.pair.criterionId))].sort();
    for (const criterionId of criteria) {
      const neighbors = new Map<string, Set<string>>();
      const wins = new Map<string, Set<string>>();
      for (const { pair, choice } of bucket.values.filter(value => value.pair.criterionId === criterionId)) {
        const aWins = (choice <= 3) === (pair.displayLeft === "A");
        const winner = aWins ? pair.aId : pair.bId;
        const loser = aWins ? pair.bId : pair.aId;
        if (neighbors.get(pair.aId)?.has(pair.bId)) throw new Error("Duplicate quality comparison");
        for (const [a, b] of [[pair.aId, pair.bId], [pair.bId, pair.aId]]) {
          if (!neighbors.has(a)) neighbors.set(a, new Set());
          neighbors.get(a)!.add(b);
        }
        if (!wins.has(winner)) wins.set(winner, new Set());
        wins.get(winner)!.add(loser);
      }
      let total = 0; let cycles = 0;
      // Count each complete triangle once; incomplete triples are not evidence of consistency.
      for (const a of [...neighbors.keys()].sort()) {
        for (const b of neighbors.get(a)!) {
          if (b <= a) continue;
          for (const c of neighbors.get(b)!) {
            if (c <= b || !neighbors.get(a)!.has(c)) continue;
            total++;
            if ((wins.get(a)?.has(b) && wins.get(b)?.has(c) && wins.get(c)?.has(a)) ||
                (wins.get(b)?.has(a) && wins.get(c)?.has(b) && wins.get(a)?.has(c))) cycles++;
          }
        }
      }
      add("QS-04", cycles, total, .2, criterionId);
    }
  }
  measures.push(...advancedQualityMeasures(pairs, answers, codes, context));
  return { version: "qs-02-07-synthetic-v2", measures };
}
