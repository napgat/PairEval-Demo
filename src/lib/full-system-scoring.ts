export type ScoreSide = "GROUP" | "INDIVIDUAL";
export type ScoreCriterion = { id: string; side: ScoreSide; weightPct: number };
export type ScorePair = { id: string; criterionId: string; side: ScoreSide; aId: string; bId: string;
  displayLeft: "A" | "B"; evaluatorId: string };
export type ScoreAnswer = { pairId: string; choice: number; evaluatorId: string; weight: number;
  excluded?: boolean; exclusionReason?: string; activeDurationMs?: number | null };
export type ScoreItem = { itemId: string; side: ScoreSide; component: number | null;
  criteria: Array<{ criterionId: string; q: number | null; comparisons: number; lowConfidence: boolean }>;
  evaluatorCount: number; anonymous: boolean };
export type ScoreSettings = { groupMax: number; individualMax: number; floor: number; ceiling: number;
  minComparisons: number; kMin: number; completionThreshold: number };

export function choicePoints(choice: number): [number, number] {
  if (!Number.isInteger(choice) || choice < 1 || choice > 6) throw new Error("Invalid forced choice");
  return [(6 - choice) / 5, (choice - 1) / 5];
}
export function mappedScore(q: number, weightPct: number, maxScore: number,
    floor: number, ceiling: number): number {
  if (![q, weightPct, maxScore, floor, ceiling].every(Number.isFinite) || q < 0 || q > 1 ||
      weightPct < 0 || weightPct > 100 || maxScore < 0 || floor < 0 || ceiling > 1 || floor >= ceiling) {
    throw new Error("Invalid score setting");
  }
  return (floor + (ceiling - floor) * q) * (weightPct / 100) * maxScore;
}
export function participation(answered: number, assigned: number, threshold: number): { p: number; M: number } {
  if (!Number.isInteger(answered) || !Number.isInteger(assigned) || answered < 0 || answered > assigned ||
      !Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new Error("Invalid participation");
  const p = assigned === 0 ? 1 : answered / assigned;
  return { p, M: Math.min(1, p / threshold) };
}

/** Reads only answers from each evaluator/side's latest submitted revision, supplied by the DB query. */
export function calculateItemScores(input: { criteria: ScoreCriterion[]; pairs: ScorePair[];
  answers: ScoreAnswer[]; groupIds: string[]; studentIds: string[]; settings: ScoreSettings }): ScoreItem[] {
  const { criteria, pairs, answers, settings } = input;
  const pairById = new Map(pairs.map(pair => [pair.id, pair]));
  const byCriterionItem = new Map<string, Array<{ points: number; weight: number; evaluatorId: string }>>();
  for (const answer of [...answers].sort((a, b) => a.pairId.localeCompare(b.pairId))) {
    const pair = pairById.get(answer.pairId);
    if (!pair || pair.evaluatorId !== answer.evaluatorId || answer.weight < 0) throw new Error("Invalid score answer scope");
    const [left, right] = choicePoints(answer.choice);
    if (answer.excluded) continue;
    const aPoints = pair.displayLeft === "A" ? left : right;
    for (const [itemId, points] of [[pair.aId, aPoints], [pair.bId, 1 - aPoints]] as const) {
      const key = `${pair.criterionId}:${itemId}`;
      byCriterionItem.set(key, [...(byCriterionItem.get(key) ?? []),
        { points, weight: answer.weight, evaluatorId: answer.evaluatorId }]);
    }
  }
  const output: ScoreItem[] = [];
  for (const side of ["GROUP", "INDIVIDUAL"] as const) {
    const sideCriteria = criteria.filter(criterion => criterion.side === side).sort((a, b) => a.id.localeCompare(b.id));
    const maxScore = side === "GROUP" ? settings.groupMax : settings.individualMax;
    if (maxScore === 0) continue;
    for (const itemId of [...(side === "GROUP" ? input.groupIds : input.studentIds)].sort()) {
      let component = 0;
      const raters = new Set<string>();
      const details = sideCriteria.map(criterion => {
        const values = byCriterionItem.get(`${criterion.id}:${itemId}`) ?? [];
        for (const value of values) raters.add(value.evaluatorId);
        const weight = values.reduce((sum, value) => sum + value.weight, 0);
        const q = weight === 0 ? null : values.reduce((sum, value) => sum + value.points * value.weight, 0) / weight;
        if (q === null) component = Number.NaN;
        else if (!Number.isNaN(component)) component += mappedScore(q, criterion.weightPct, maxScore,
          settings.floor, settings.ceiling);
        return { criterionId: criterion.id, q, comparisons: values.length,
          lowConfidence: values.length < settings.minComparisons };
      });
      output.push({ itemId, side, component: !details.length || Number.isNaN(component) ? null : component,
        criteria: details, evaluatorCount: raters.size, anonymous: side === "GROUP" || raters.size >= settings.kMin });
    }
  }
  return output;
}
