import { describe, expect, it } from "vitest";
import { latestScoreDue, localScoreDue } from "./full-system-score-schedule";
const old = new Date("2020-01-01T00:00:00Z");
describe("daily classroom score scheduling", () => {
  it("observes local 02:00, UTC date boundaries, quarter-hour offsets and missed runs", () => {
    expect(localScoreDue("2026-10-01", "Asia/Bangkok").toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(localScoreDue("2026-10-01", "Asia/Kathmandu").toISOString()).toBe("2026-09-30T20:15:00.000Z");
    expect(latestScoreDue(new Date("2026-09-30T18:59:59Z"), "Asia/Bangkok", old)?.localDate).toBe("2026-09-30");
    expect(latestScoreDue(new Date("2026-09-30T19:00:00Z"), "Asia/Bangkok", old)?.localDate).toBe("2026-10-01");
    expect(latestScoreDue(new Date("2026-10-05T12:00:00Z"), "UTC", old)?.localDate).toBe("2026-10-05");
    expect(latestScoreDue(new Date("2026-10-05T12:00:00Z"), "UTC", new Date("2026-10-05T03:00:00Z"))).toBeNull();
  });
  it("runs once on fall-back and after the spring gap instead of inventing a wall time", () => {
    expect(localScoreDue("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T07:00:00.000Z");
    expect(localScoreDue("2026-10-25", "Europe/Berlin").toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(latestScoreDue(new Date("2026-10-25T01:30:00Z"), "Europe/Berlin", old)?.scheduledFor).toBe("2026-10-25T00:00:00.000Z");
    expect(() => localScoreDue("2026-10-01", "Invalid/Zone")).toThrow();
  });
});
