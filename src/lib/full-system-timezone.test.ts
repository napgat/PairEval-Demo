import { describe, expect, it } from "vitest";
import { classroomInputToUtc, utcToClassroomInput } from "./full-system-timezone";

describe("classroom timezone deadline", () => {
  it("round trips Bangkok and New York times", () => {
    expect(classroomInputToUtc("2030-12-01T16:59", "Asia/Bangkok")).toBe("2030-12-01T09:59:00.000Z");
    const utc = classroomInputToUtc("2030-12-01T16:59", "America/New_York");
    expect(utc).toBe("2030-12-01T21:59:00.000Z");
    expect(utcToClassroomInput(utc, "America/New_York")).toBe("2030-12-01T16:59");
  });
  it("rejects a skipped local time at daylight-saving transition", () => {
    expect(() => classroomInputToUtc("2030-03-10T02:30", "America/New_York")).toThrow();
  });
});
