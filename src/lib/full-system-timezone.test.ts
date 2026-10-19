import { describe, expect, it } from "vitest";
import { classroomInputToUtc, utcToClassroomInput, formatClassroomDateTime } from "./full-system-timezone";

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

describe("classroom event time", () => {
  it("uses the classroom timezone and rolls the date over at midnight", () => {
    const timestamp = "2026-10-18T17:30:45.000Z";
    expect(formatClassroomDateTime(timestamp, "Asia/Bangkok")).toBe("19/10/2569 00:30:45");
    expect(formatClassroomDateTime(timestamp, "UTC")).toBe("18/10/2569 17:30:45");
  });
  it("uses daylight-saving offsets of the classroom, not a fixed seven-hour adjustment", () => {
    expect(formatClassroomDateTime("2026-07-01T12:00:00.000Z", "America/New_York")).toBe("1/7/2569 08:00:00");
    expect(formatClassroomDateTime("2026-12-01T12:00:00.000Z", "America/New_York")).toBe("1/12/2569 07:00:00");
    expect(formatClassroomDateTime("invalid", "UTC")).toBe("—");
  });
});
