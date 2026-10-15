import { createHmac } from "node:crypto";
import type { ScoreAnswer, ScorePair } from "./full-system-scoring";

export type RawScoreInput = { generation: number; pairs: ScorePair[]; answers: ScoreAnswer[] };
const dangerous = /^[\s\uFEFF]*[=+\-@]/u;
const cell = (value: string | number) => {
  const text = String(typeof value === "string" && dangerous.test(value) ? `'${value}` : value);
  return `"${text.replaceAll('"', '""')}"`;
};

/** Stable within one assignment generation, opaque without the server-only key. */
export function evaluatorAlias(key: string, assignmentId: string, generation: number, evaluatorId: string) {
  if (Buffer.byteLength(key, "utf8") < 32) throw new Error("Raw export key is not configured");
  return `ev_${createHmac("sha256", key).update(`${assignmentId}:${generation}:${evaluatorId}`)
    .digest("hex").slice(0, 24)}`;
}

export function rawComparisonCsv(input: RawScoreInput, assignmentId: string, key: string,
    identities?: Map<string, { name: string; email: string }>) {
  const pairs = new Map(input.pairs.map(pair => [pair.id, pair]));
  const rows: Array<Array<string | number>> = [["Pair ID", "Side", "Criterion ID", "Item A ID",
    "Item B ID", "Evaluator alias", "Choice", "Weight", "Review status", "Exclusion reason",
    ...(identities ? ["Evaluator name", "Evaluator email"] : [])]];
  for (const answer of input.answers) {
    const pair = pairs.get(answer.pairId);
    if (!pair || pair.evaluatorId !== answer.evaluatorId) throw new Error("Raw answer scope mismatch");
    rows.push([pair.id, pair.side, pair.criterionId, pair.aId, pair.bId,
      evaluatorAlias(key, assignmentId, input.generation, answer.evaluatorId),
      answer.choice, answer.weight, answer.excluded ? "EXCLUDED" : "INCLUDED", answer.exclusionReason ?? "",
      ...(identities ? [identities.get(answer.evaluatorId)?.name ?? "", identities.get(answer.evaluatorId)?.email ?? ""] : [])]);
  }
  return `\uFEFF${rows.map(row => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
