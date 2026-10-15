export type QueuedAnswers = { expiresAt: string; answers: Array<[string, number | null]> };
export function queueKey(viewerId: string, assignmentId: string, generation: number, side: string): string {
  return `paireval-draft:${viewerId}:${assignmentId}:${generation}:${side}`;
}
export function readQueuedAnswers(raw: string | null, allowedPairs: Set<string>, now = Date.now()): Map<string, number | null> {
  try {
    const value = JSON.parse(raw ?? "null") as QueuedAnswers | null;
    if (!value || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= now || !Array.isArray(value.answers)) return new Map();
    return new Map(value.answers.filter(row => Array.isArray(row) && allowedPairs.has(row[0]) &&
      (row[1] === null || Number.isInteger(row[1]) && row[1]! >= 1 && row[1]! <= 6)));
  } catch { return new Map(); }
}
