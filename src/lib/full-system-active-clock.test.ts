import { describe, expect, it } from "vitest";
import { ActiveComparisonClock } from "./full-system-active-clock";
import { timingEvent } from "./full-system-active-timing";
describe("bounded active comparison time", () => {
  it("excludes background/focus/throttled gaps and caps idle time at 30 seconds", () => {
    const clock = new ActiveComparisonClock(0);
    expect(clock.advance(500, true)).toBe(500);
    expect(clock.advance(1000, false)).toBe(0);
    expect(clock.advance(1500, true)).toBe(500);
    expect(clock.advance(10000, true)).toBe(0);
    clock.last = 29900;
    expect(clock.advance(30400, true)).toBe(100);
    expect(clock.advance(30900, true)).toBe(0);
    clock.touch(31000); expect(clock.advance(31500, true)).toBe(600);
    expect(new ActiveComparisonClock(4000).advance(1000, true)).toBe(0);
  });
  it("validates bounded integer packets and requires a real lease and sequence", () => {
    const base = { leaseId: "00000000-0000-4000-8000-000000000001", sequence: 1, deltaMs: 5000, close: false };
    expect(timingEvent(base)).toEqual(base);
    for (const bad of [null, { ...base, deltaMs: -1 }, { ...base, deltaMs: 5001 }, { ...base, sequence: 0 }, { ...base, deltaMs: 1.5 }, { ...base, leaseId: "other" }]) {
      expect(() => timingEvent(bad)).toThrow();
    }
  });
});
