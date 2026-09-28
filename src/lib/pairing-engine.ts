export type PairingGroup = { id: string; name: string };
export type PairingStudent = { id: string; groupId: string; name: string };
export type PairingCriterion = { id: string; kind: "group" | "individual"; name: string };
export type PairingInput = {
  assignmentId: string; groups: PairingGroup[]; students: PairingStudent[];
  criteria: PairingCriterion[]; target: number;
};
export type PlannedPair = {
  criterionId: string; criterionName: string; kind: "group" | "individual";
  itemAId: string; itemBId: string; itemAName: string; itemBName: string;
  eligibleCount: number; selectedEvaluatorIds: string[];
};
export type PlannedAssignment = {
  assignmentId: string; criterionId: string; evaluatorId: string;
  itemAId: string; itemBId: string;
};
export type PairingPlan = { target: number; pairs: PlannedPair[]; assignments: PlannedAssignment[]; issues: string[] };

function withoutEligibleIds(pair: PlannedPair & { eligibleIds: string[] }): PlannedPair {
  return { criterionId: pair.criterionId, criterionName: pair.criterionName, kind: pair.kind,
    itemAId: pair.itemAId, itemBId: pair.itemBId, itemAName: pair.itemAName, itemBName: pair.itemBName,
    eligibleCount: pair.eligibleCount, selectedEvaluatorIds: pair.selectedEvaluatorIds };
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function planPairAssignments(input: PairingInput): PairingPlan {
  const { assignmentId, target } = input;
  if (!Number.isInteger(target) || target < 1) throw new Error("Coverage target must be a positive integer.");
  const groups = [...input.groups].sort((a, b) => a.id.localeCompare(b.id));
  const students = [...input.students].sort((a, b) => a.id.localeCompare(b.id));
  const criteria = [...input.criteria].sort((a, b) => a.id.localeCompare(b.id));
  const issues: string[] = [];
  const candidates: (PlannedPair & { eligibleIds: string[] })[] = [];

  for (const criterion of criteria) {
    const combinations: { a: string; b: string; aName: string; bName: string; groupId?: string }[] = [];
    if (criterion.kind === "group") {
      for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
        combinations.push({ a: groups[a].id, b: groups[b].id, aName: groups[a].name, bName: groups[b].name });
      }
    } else {
      for (const group of groups) {
        const members = students.filter(student => student.groupId === group.id);
        for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++) {
          combinations.push({ a: members[a].id, b: members[b].id, aName: members[a].name, bName: members[b].name, groupId: group.id });
        }
      }
    }
    if (!combinations.length) issues.push(`${criterion.name}: ไม่มีคู่${criterion.kind === "group" ? "กลุ่ม" : "บุคคล"}ให้ประเมิน`);
    for (const pair of combinations) {
      const eligibleIds = students.filter(student => criterion.kind === "group"
        ? student.groupId !== pair.a && student.groupId !== pair.b
        : student.groupId === pair.groupId && student.id !== pair.a && student.id !== pair.b
      ).map(student => student.id);
      if (eligibleIds.length < target) issues.push(`${criterion.name}: ${pair.aName} ↔ ${pair.bName} มีผู้ประเมินที่มีสิทธิ์ ${eligibleIds.length} คน ต้องการ ${target} คน`);
      candidates.push({ criterionId: criterion.id, criterionName: criterion.name, kind: criterion.kind,
        itemAId: pair.a, itemBId: pair.b, itemAName: pair.aName, itemBName: pair.bName,
        eligibleCount: eligibleIds.length, eligibleIds, selectedEvaluatorIds: [] });
    }
  }
  if (!criteria.some(criterion => criterion.kind === "group")) issues.push("ไม่มีเกณฑ์ Group สำหรับงานนี้");
  if (!criteria.some(criterion => criterion.kind === "individual")) issues.push("ไม่มีเกณฑ์ Individual สำหรับงานนี้");
  if (issues.length) return { target, pairs: candidates.map(withoutEligibleIds), assignments: [], issues };

  const loadByCriterion = new Map<string, Map<string, number>>();
  const assignments: PlannedAssignment[] = [];
  candidates.sort((a, b) => a.eligibleCount - b.eligibleCount || hash(`${assignmentId}/${a.criterionId}/${a.itemAId}/${a.itemBId}`) - hash(`${assignmentId}/${b.criterionId}/${b.itemAId}/${b.itemBId}`));
  for (const pair of candidates) {
    let load = loadByCriterion.get(pair.criterionId);
    if (!load) { load = new Map(); loadByCriterion.set(pair.criterionId, load); }
    const pairKey = `${assignmentId}/${pair.criterionId}/${pair.itemAId}/${pair.itemBId}`;
    const selected = [...pair.eligibleIds].sort((a, b) => (load!.get(a) ?? 0) - (load!.get(b) ?? 0) || hash(`${pairKey}/${a}`) - hash(`${pairKey}/${b}`) || a.localeCompare(b)).slice(0, target);
    pair.selectedEvaluatorIds = selected;
    for (const evaluatorId of selected) {
      load.set(evaluatorId, (load.get(evaluatorId) ?? 0) + 1);
      assignments.push({ assignmentId, criterionId: pair.criterionId, evaluatorId, itemAId: pair.itemAId, itemBId: pair.itemBId });
    }
  }
  return { target, pairs: candidates.map(withoutEligibleIds), assignments, issues: [] };
}
