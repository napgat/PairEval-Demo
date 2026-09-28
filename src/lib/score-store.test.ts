import { describe, expect, it } from "vitest";
import { scoreStatus, type AssignmentScore } from "./score-store";

const score = { groupDeadline: "2026-01-01T00:00:00.000Z", individualDeadline: "2026-01-02T00:00:00.000Z", result: { hasNoData: false } } as AssignmentScore;

describe("score display status", () => {
  it("stays Interim until both deadlines pass", () => {
    expect(scoreStatus(score, new Date("2026-01-01T12:00:00.000Z"))).toBe("Interim");
  });
  it("becomes Final only when complete data remains after deadlines", () => {
    expect(scoreStatus(score, new Date("2026-01-03T00:00:00.000Z"))).toBe("Final");
    expect(scoreStatus({ ...score, result: { ...score.result, hasNoData: true } }, new Date("2026-01-03T00:00:00.000Z"))).toBe("Interim");
  });
});
