import { describe, expect, it } from "vitest";
import { validCronAuthorization } from "./full-system-reminder-job";

describe("scheduled reminder authorization", () => {
  const secret = "synthetic-cron-secret-32-bytes-long";
  it("accepts only an exact bearer token", () => {
    expect(validCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(validCronAuthorization(`Bearer ${secret}x`, secret)).toBe(false);
    expect(validCronAuthorization(`Basic ${secret}`, secret)).toBe(false);
    expect(validCronAuthorization(null, secret)).toBe(false);
    expect(validCronAuthorization(`Bearer ${secret}`, "short")).toBe(false);
  });
});
