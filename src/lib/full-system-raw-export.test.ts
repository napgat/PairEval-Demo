import { describe, expect, it } from "vitest";
import { evaluatorAlias, rawComparisonCsv } from "./full-system-raw-export";

const key = "synthetic-test-only-export-key-32-bytes-long";
const assignment = "00000000-0000-4000-8000-000000000001";

describe("pseudonymous raw comparison export", () => {
  it("keeps aliases stable within a generation and separates generations", () => {
    const alias = evaluatorAlias(key, assignment, 1, "evaluator-id");
    expect(alias).toMatch(/^ev_[0-9a-f]{24}$/);
    expect(evaluatorAlias(key, assignment, 1, "evaluator-id")).toBe(alias);
    expect(evaluatorAlias(key, assignment, 2, "evaluator-id")).not.toBe(alias);
    expect(alias).not.toContain("evaluator-id");
    expect(() => evaluatorAlias("short", assignment, 1, "evaluator-id")).toThrow();
  });
  it("exports only latest supplied answers with no evaluator identity", () => {
    const csv = rawComparisonCsv({ generation: 1,
      pairs: [{ id: "pair-1", criterionId: "criterion-1", side: "GROUP",
        aId: "group-a", bId: "group-b", displayLeft: "A", evaluatorId: "evaluator-id" }],
      answers: [{ pairId: "pair-1", choice: 2, evaluatorId: "evaluator-id", weight: 1 }] },
    assignment, key);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(evaluatorAlias(key, assignment, 1, "evaluator-id"));
    expect(csv).not.toContain("evaluator-id");
    expect(csv).toContain('"pair-1"');
  });
  it("rejects answers outside the snapshot pair scope", () => {
    expect(() => rawComparisonCsv({ generation: 1, pairs: [],
      answers: [{ pairId: "missing", choice: 1, evaluatorId: "e1", weight: 1 }] },
    assignment, key)).toThrow("scope mismatch");
  });
});
