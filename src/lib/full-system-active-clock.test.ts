import { describe, expect, it, vi } from "vitest";
import { ActiveComparisonClock, installSyntheticTiming } from "./full-system-active-clock";
import { timingEvent } from "./full-system-active-timing";
describe("bounded active comparison time", () => {
  it("keeps timing leases closed while submission is in flight, then permits editing again", async () => {
    const element = { dataset: { pairId: "pair-1" } };
    let observe!: (entries: unknown[]) => void;
    const listeners = new Map<string, () => void>();
    vi.stubGlobal("document", {
      visibilityState: "visible", hasFocus: () => true,
      querySelectorAll: () => [element], addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", {
      addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: typeof observe) { observe = callback; }
      observe() {} disconnect() {}
    });
    const request = vi.fn(async (_url: string, options: RequestInit) => ({
      ok: true, json: async () => ({ data: { leaseId: "lease-1" } }), method: options.method,
    }));
    vi.stubGlobal("fetch", request);
    const recorder = installSyntheticTiming("/synthetic/evaluation");
    try {
      const visible = [{ target: element, isIntersecting: true, intersectionRatio: 1 }];
      observe(visible);
      const finishing = recorder.finish();
      recorder.select("pair-1"); observe(visible); listeners.get("focus")?.();
      await finishing;
      expect(request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
      expect(request.mock.calls.filter(([, options]) => options.method === "PUT").map(([, options]) => JSON.parse(String(options.body)).close)).toEqual([true]);
      recorder.resumeRecording(); recorder.select("pair-1");
      expect(request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(2);
      await recorder.finish();
    } finally { recorder.destroy(); vi.unstubAllGlobals(); }
  });
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
