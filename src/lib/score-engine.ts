export type ScoreKind = "group" | "individual";
export type ScoreInput = {
  assignment: { id: string; groupMax: number; individualMax: number; groupDeadline: string; individualDeadline: string };
  groups: { id: string; name: string }[];
  students: { id: string; name: string; groupId: string }[];
  criteria: { id: string; name: string; kind: ScoreKind; weightPercent: number }[];
  pairs: { id: string; criterionId: string; evaluatorId: string; itemAId: string; itemBId: string }[];
  revisions: { id: string; evaluatorId: string; kind: ScoreKind; number: number; submitted: boolean; answers: { pairId: string; choice: number }[] }[];
};

export type ItemScore = { criterionId: string; criterionName: string; kind: ScoreKind; itemId: string; itemName: string; groupId: string | null; average: number | null; answerCount: number; assignedCount: number; points: number | null };
export type StudentScore = { id: string; name: string; groupId: string; groupBase: number | null; individualBase: number | null; groupScore: number | null; individualScore: number | null; total: number | null; groupAnswered: number; groupAssigned: number; individualAnswered: number; individualAssigned: number; groupSubmitted: boolean; individualSubmitted: boolean };
export type ScoreResult = { items: ItemScore[]; groups: { id: string; name: string; baseScore: number | null }[]; students: StudentScore[]; hasNoData: boolean };

export function choicePoints(choice: number): [number, number] {
  if (!Number.isInteger(choice) || choice < 1 || choice > 6) throw new Error("Choice must be 1–6");
  return [[1, 0], [0.8, 0.2], [0.6, 0.4], [0.4, 0.6], [0.2, 0.8], [0, 1]][choice - 1] as [number, number];
}

export function applyCompletion(baseScore: number | null, assigned: number, answered: number, submitted: boolean): number | null {
  if (!submitted && assigned > 0) return 0;
  if (baseScore === null) return null;
  return baseScore * (assigned === 0 ? 1 : answered / assigned);
}

export function calculateScores(input: ScoreInput): ScoreResult {
  const criteria = new Map(input.criteria.map(c => [c.id, c]));
  const latest = new Map<string, ScoreInput["revisions"][number]>();
  for (const revision of input.revisions) {
    if (!revision.submitted) continue;
    const key = `${revision.evaluatorId}/${revision.kind}`;
    if (!latest.has(key) || latest.get(key)!.number < revision.number) latest.set(key, revision);
  }
  const pairsById = new Map(input.pairs.map(pair => [pair.id, pair]));
  const answers = new Map<string, number>();
  for (const revision of latest.values()) for (const answer of revision.answers) {
    const pair = pairsById.get(answer.pairId);
    if (pair?.evaluatorId === revision.evaluatorId && criteria.get(pair.criterionId)?.kind === revision.kind && Number.isInteger(answer.choice) && answer.choice >= 1 && answer.choice <= 6) answers.set(pair.id, answer.choice);
  }
  const nameById = new Map([...input.groups, ...input.students].map(item => [item.id, item.name]));
  const items: ItemScore[] = [];
  for (const criterion of input.criteria) {
    const cohorts = criterion.kind === "group"
      ? [{ groupId: null, ids: input.groups.map(g => g.id) }]
      : input.groups.map(g => ({ groupId: g.id, ids: input.students.filter(s => s.groupId === g.id).map(s => s.id) }));
    for (const cohort of cohorts) {
      if (!cohort.ids.length) continue;
      const cohortSet = new Set(cohort.ids);
      const raw = cohort.ids.map(itemId => {
        let sum = 0, answerCount = 0, assignedCount = 0;
        for (const pair of input.pairs) {
          if (pair.criterionId !== criterion.id || !cohortSet.has(pair.itemAId) || !cohortSet.has(pair.itemBId)) continue;
          const side = pair.itemAId === itemId ? 0 : pair.itemBId === itemId ? 1 : -1;
          if (side < 0) continue;
          assignedCount++;
          const choice = answers.get(pair.id);
          if (choice !== undefined && (side === 0 || side === 1)) { sum += choicePoints(choice)[side]; answerCount++; }
        }
        return { itemId, answerCount, assignedCount, average: answerCount ? sum / answerCount : null };
      });
      const denominator = raw.reduce((sum, row) => sum + (row.average ?? 0), 0);
      const complete = raw.every(row => row.average !== null) && denominator > 0;
      for (const row of raw) items.push({ criterionId: criterion.id, criterionName: criterion.name, kind: criterion.kind,
        itemId: row.itemId, itemName: nameById.get(row.itemId) ?? row.itemId, groupId: cohort.groupId,
        average: row.average, answerCount: row.answerCount, assignedCount: row.assignedCount,
        points: complete ? row.average! / denominator * criterion.weightPercent / 100 * (criterion.kind === "group" ? input.assignment.groupMax : input.assignment.individualMax) : null });
    }
  }
  function base(kind: ScoreKind, itemId: string): number | null {
    const expected = input.criteria.filter(c => c.kind === kind).length;
    const rows = items.filter(row => row.kind === kind && row.itemId === itemId);
    return rows.length === expected && rows.every(row => row.points !== null) ? rows.reduce((sum, row) => sum + row.points!, 0) : null;
  }
  const groups = input.groups.map(group => ({ id: group.id, name: group.name, baseScore: base("group", group.id) }));
  const students = input.students.map(student => {
    const groupBase = groups.find(g => g.id === student.groupId)?.baseScore ?? null;
    const individualBase = base("individual", student.id);
    const counts = (kind: ScoreKind) => {
      const assigned = input.pairs.filter(pair => pair.evaluatorId === student.id && criteria.get(pair.criterionId)?.kind === kind);
      return { assigned: assigned.length, answered: assigned.filter(pair => answers.has(pair.id)).length, submitted: latest.has(`${student.id}/${kind}`) };
    };
    const group = counts("group"), individual = counts("individual");
    const groupScore = applyCompletion(groupBase, group.assigned, group.answered, group.submitted);
    const individualScore = applyCompletion(individualBase, individual.assigned, individual.answered, individual.submitted);
    return { id: student.id, name: student.name, groupId: student.groupId, groupBase, individualBase, groupScore, individualScore,
      total: groupScore === null || individualScore === null ? null : groupScore + individualScore,
      groupAnswered: group.answered, groupAssigned: group.assigned, individualAnswered: individual.answered, individualAssigned: individual.assigned,
      groupSubmitted: group.submitted, individualSubmitted: individual.submitted };
  });
  return { items, groups, students, hasNoData: items.some(item => item.points === null) };
}
