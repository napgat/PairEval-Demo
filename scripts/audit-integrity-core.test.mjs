import { describe, expect, it } from "vitest";
import { canonicalAuditEvent, checkpointPrefix, computeAuditCheckpoint } from "./audit-integrity-core.mjs";

const event = (id, action = "CLASSROOM_CREATE_REQUESTED") => ({
  id, classroom_id: null, assignment_id: null, actor_user_id: null, action,
  resource_type: "classroom", resource_id: "synthetic", before_json: { z: 1, a: 2 },
  after_json: null, reason: null, ip_address: null, request_id: "synthetic-request",
  occurred_at: new Date("2026-09-29T00:00:00.000Z"),
});

describe("audit checkpoint integrity", () => {
  it("is deterministic for JSON key order and detects changed or missing historical events", () => {
    const original = [event("00000000-0000-0000-0000-000000000001"), event("00000000-0000-0000-0000-000000000002")];
    const checkpoint = computeAuditCheckpoint(original);
    expect(canonicalAuditEvent({ ...original[0], before_json: { a: 2, z: 1 } })).toBe(canonicalAuditEvent(original[0]));
    expect(computeAuditCheckpoint(original.slice(0, 1)).chainSha256).not.toBe(checkpoint.chainSha256);
    expect(computeAuditCheckpoint([original[0], event(original[1].id, "ROSTER_IMPORT_REQUESTED")]).chainSha256)
      .not.toBe(checkpoint.chainSha256);
    const appended = [...original, { ...event("00000000-0000-0000-0000-000000000003"),
      occurred_at: new Date("2026-09-30T00:00:00.000Z") }];
    expect(computeAuditCheckpoint(checkpointPrefix(appended, checkpoint.highWatermark)).chainSha256)
      .toBe(checkpoint.chainSha256);
  });

  it("rejects reordered events", () => {
    expect(() => computeAuditCheckpoint([event("00000000-0000-0000-0000-000000000002"),
      event("00000000-0000-0000-0000-000000000001")])).toThrow("strictly ordered");
  });
});
