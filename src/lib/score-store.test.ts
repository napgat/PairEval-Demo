import { describe, expect, it } from "vitest";
import { scoreStatus, type AssignmentScore } from "./score-store";

const score = { groupDeadline: "2026-01-01T00:00:00.000Z", individualDeadline: "2026-01-02T00:00:00.000Z", result: { hasNoData: false } } as AssignmentScore;

describe("score display status", () => {
  it("labels the offline showcase Interim", () => {
    expect(scoreStatus(score)).toBe("Interim");
  });
  it("never infers audited finalization from complete data or past deadlines", () => {
    expect(scoreStatus(score)).toBe("Interim");
    expect(scoreStatus({ ...score, result: { ...score.result, hasNoData: true } })).toBe("Interim");
  });
});
