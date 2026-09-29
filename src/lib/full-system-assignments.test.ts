import { describe, expect, it } from "vitest";
import { validateAssignmentInput } from "./full-system-assignments";

const input = () => ({ name: "Synthetic assignment", groupMaxScore: 10,
  individualMaxScore: 0, groupDeadline: "2030-01-01T00:00:00Z", individualDeadline: null,
  targetCoverage: 1, maxWorkload: 5,
  criteria: [{ side: "GROUP", name: "Quality", weightPct: 100 }] });

describe("instructor weight assignment setting", () => {
  it("defaults to one and accepts a fractional weighted-mean value", () => {
    expect(validateAssignmentInput(input()).instructorWeight).toBe(1);
    expect(validateAssignmentInput({ ...input(), instructorWeight: 0.5 }).instructorWeight).toBe(0.5);
  });
  it("rejects negative, nonfinite and over-precision values", () => {
    for (const weight of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0.001, 100]) {
      expect(() => validateAssignmentInput({ ...input(), instructorWeight: weight })).toThrow();
    }
  });
});
