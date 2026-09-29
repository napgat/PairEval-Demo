import { createHash } from "node:crypto";

export type PairStudent = { id: string; groupId: string };
export type PairCriterion = { id: string; side: "GROUP" | "INDIVIDUAL" };
export type PlannedComparison = { criterionId: string; side: "GROUP" | "INDIVIDUAL";
  aId: string; bId: string; evaluatorId: string; displayLeft: "A" | "B" };
export type PairPlanPart = { criterionId: string; side: "GROUP" | "INDIVIDUAL"; groupId?: string;
  pairCount: number; requested: number; coverage: number; assignmentCount: number;
  workload: Record<string, number>; reason: string | null; lowConfidence: boolean };
export type PairPlan = { feasible: boolean; parts: PairPlanPart[]; comparisons: PlannedComparison[] };

type Item = { a: string; b: string; eligible: string[] };
type Edge = { to: number; reverse: number; capacity: number; original: number };
class Flow {
  edges: Edge[][];
  constructor(size: number) { this.edges = Array.from({ length: size }, () => []); }
  add(from: number, to: number, capacity: number): Edge {
    const forward = { to, reverse: this.edges[to].length, capacity, original: capacity };
    const reverse = { to: from, reverse: this.edges[from].length, capacity: 0, original: 0 };
    this.edges[from].push(forward); this.edges[to].push(reverse);
    return forward;
  }
  max(source: number, sink: number): number {
    let total = 0;
    while (true) {
      const level = Array(this.edges.length).fill(-1) as number[];
      const queue = [source]; level[source] = 0;
      for (let q = 0; q < queue.length; q++) for (const edge of this.edges[queue[q]]) {
        if (edge.capacity > 0 && level[edge.to] < 0) { level[edge.to] = level[queue[q]] + 1; queue.push(edge.to); }
      }
      if (level[sink] < 0) return total;
      const next = Array(this.edges.length).fill(0) as number[];
      const dfs = (node: number, amount: number): number => {
        if (node === sink) return amount;
        for (; next[node] < this.edges[node].length; next[node]++) {
          const edge = this.edges[node][next[node]];
          if (edge.capacity < 1 || level[edge.to] !== level[node] + 1) continue;
          const sent = dfs(edge.to, Math.min(amount, edge.capacity));
          if (sent) { edge.capacity -= sent; this.edges[edge.to][edge.reverse].capacity += sent; return sent; }
        }
        return 0;
      };
      while (true) { const sent = dfs(source, Number.MAX_SAFE_INTEGER); if (!sent) break; total += sent; }
    }
  }
}

function hash(seed: string, ...keys: string[]): string {
  return createHash("sha256").update([seed, ...keys].join("\u0000")).digest("hex");
}
function pairs(ids: string[]): Array<[string, string]> {
  const sorted = [...ids].sort(); const result: Array<[string, string]> = [];
  for (let a = 0; a < sorted.length; a++) for (let b = a + 1; b < sorted.length; b++) result.push([sorted[a], sorted[b]]);
  return result;
}

/** Exact lower/upper bounded bipartite flow: each pair receives R distinct evaluators; loads differ by ≤1. */
function allocate(items: Item[], evaluators: string[], requested: number, cap: number, seed: string): {
  coverage: number; rows: Array<{ item: Item; evaluatorId: string }>; reason: string | null;
} {
  const people = [...evaluators].sort();
  if (!items.length) return { coverage: 0, rows: [], reason: "no eligible pairs" };
  const minEligible = Math.min(...items.map(item => item.eligible.length));
  for (let coverage = Math.min(requested, minEligible); coverage >= 1; coverage--) {
    const total = items.length * coverage;
    const base = Math.floor(total / people.length);
    const peak = Math.ceil(total / people.length);
    if (peak > cap) continue;
    const source = 0, pairStart = 1, evaluatorStart = pairStart + items.length;
    const sink = evaluatorStart + people.length, superSource = sink + 1, superSink = sink + 2;
    const flow = new Flow(superSink + 1);
    const balance = Array(superSink + 1).fill(0) as number[];
    const bounded = (from: number, to: number, lower: number, upper: number): Edge => {
      balance[from] -= lower; balance[to] += lower;
      return flow.add(from, to, upper - lower);
    };
    const selected: Array<{ edge: Edge; item: Item; evaluatorId: string }> = [];
    items.forEach((item, index) => {
      bounded(source, pairStart + index, coverage, coverage);
      const eligible = item.eligible.filter(id => people.includes(id)).sort((a, b) =>
        hash(seed, item.a, item.b, a).localeCompare(hash(seed, item.a, item.b, b)));
      for (const id of eligible) selected.push({ edge: bounded(pairStart + index,
        evaluatorStart + people.indexOf(id), 0, 1), item, evaluatorId: id });
    });
    people.forEach((_, index) => bounded(evaluatorStart + index, sink, base, peak));
    bounded(sink, source, 0, total);
    let demand = 0;
    balance.forEach((value, node) => {
      if (value > 0) { flow.add(superSource, node, value); demand += value; }
      if (value < 0) flow.add(node, superSink, -value);
    });
    if (flow.max(superSource, superSink) !== demand) continue;
    return { coverage, rows: selected.filter(row => row.edge.original - row.edge.capacity === 1)
      .map(({ item, evaluatorId }) => ({ item, evaluatorId })),
      reason: coverage < requested ? `requested=${requested}; actual=${coverage}; minEligible=${minEligible}; workloadCap=${cap}` : null };
  }
  return { coverage: 0, rows: [],
    reason: `requested=${requested}; actual=0; minEligible=${minEligible}; workloadCap=${cap}` };
}

export function planFullSystemPairs(input: { students: PairStudent[]; groups: string[];
  criteria: PairCriterion[]; targetCoverage: number; maxWorkload: number; seed: string;
  groupEnabled: boolean; individualEnabled: boolean }): PairPlan {
  if (!Number.isSafeInteger(input.targetCoverage) || input.targetCoverage < 1 ||
      !Number.isSafeInteger(input.maxWorkload) || input.maxWorkload < 1) throw new Error("Invalid pairing limits");
  const students = [...input.students].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(students.map(student => student.id)).size !== students.length) throw new Error("Duplicate students");
  const groups = [...new Set(input.groups)].sort();
  const parts: PairPlanPart[] = []; const comparisons: PlannedComparison[] = [];
  for (const criterion of [...input.criteria].sort((a, b) => a.id.localeCompare(b.id))) {
    if (criterion.side === "GROUP" && !input.groupEnabled || criterion.side === "INDIVIDUAL" && !input.individualEnabled) continue;
    const scopes = criterion.side === "GROUP" ? [undefined] : groups;
    for (const groupId of scopes) {
      const local = groupId ? students.filter(student => student.groupId === groupId) : students;
      const items: Item[] = criterion.side === "GROUP"
        ? pairs(groups).map(([a, b]) => ({ a, b, eligible: local.filter(student =>
          student.groupId !== a && student.groupId !== b).map(student => student.id) }))
        : pairs(local.map(student => student.id)).map(([a, b]) => ({ a, b,
          eligible: local.filter(student => student.id !== a && student.id !== b).map(student => student.id) }));
      if (criterion.side === "INDIVIDUAL" && local.length <= 2) {
        parts.push({ criterionId: criterion.id, side: criterion.side, groupId, pairCount: items.length,
          requested: input.targetCoverage, coverage: 0, assignmentCount: 0, workload: {},
          reason: `groupSize=${local.length}; individual evaluation disabled at size <=2`, lowConfidence: false });
        continue;
      }
      const plan = allocate(items, local.map(student => student.id), input.targetCoverage,
        input.maxWorkload, `${input.seed}:${criterion.id}:${groupId ?? "all"}`);
      const workload = Object.fromEntries(local.map(student => [student.id, 0]));
      for (const row of plan.rows) {
        workload[row.evaluatorId]++;
        comparisons.push({ criterionId: criterion.id, side: criterion.side, aId: row.item.a,
          bId: row.item.b, evaluatorId: row.evaluatorId,
          displayLeft: hash(input.seed, criterion.id, row.item.a, row.item.b, row.evaluatorId)[0] < "8" ? "A" : "B" });
      }
      parts.push({ criterionId: criterion.id, side: criterion.side, groupId,
        pairCount: items.length, requested: input.targetCoverage, coverage: plan.coverage,
        assignmentCount: plan.rows.length, workload, reason: plan.reason,
        lowConfidence: criterion.side === "INDIVIDUAL" && local.length === 3 });
    }
  }
  const groupFailure = parts.some(part => part.side === "GROUP" && part.coverage === 0);
  const individualFailure = parts.some(part => part.side === "INDIVIDUAL" && part.pairCount > 0 &&
    part.coverage === 0 && !part.reason?.includes("disabled at size <=2"));
  return { feasible: parts.length > 0 && !groupFailure && !individualFailure, parts, comparisons };
}
