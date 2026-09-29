import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  commands: [] as string[],
  outcome: null as null | { id: string; request_id: string; classroom_id: string | null;
    actor_user_id: string; action: string; resource_type: string; resource_id: string;
    before_json: Record<string, unknown> | null; after_json: Record<string, unknown> | null; reason: string | null },
  delivered: false,
  failDelivery: false,
  failCommit: false,
  append: vi.fn(async (value: unknown) => { void value; }),
  intent: vi.fn(async (input: Record<string, unknown>) => ({ ...input, requestId: "00000000-0000-4000-8000-000000000001" })),
}));

vi.mock("./full-system-postgres", () => ({ databasePool: () => ({
  connect: async () => ({ query: async (sql: string, values?: unknown[]) => {
    fake.commands.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
    if (sql === "COMMIT" && fake.failCommit) throw new Error("connection lost during commit");
    if (sql.includes("INSERT INTO audit_outbox")) {
      fake.outcome = { id: values![0] as string, request_id: values![1] as string,
        classroom_id: values![2] as string | null, actor_user_id: values![3] as string,
        action: values![4] as string, resource_type: values![5] as string,
        resource_id: values![6] as string, before_json: values![7] as Record<string, unknown> | null,
        after_json: values![8] as Record<string, unknown> | null, reason: values![9] as string | null };
    }
    return { rows: [] };
  }, release: () => {} }),
  query: async (sql: string) => {
    fake.commands.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
    if (sql.includes("FROM audit_outbox WHERE request_id")) return { rows: fake.delivered ? [] : fake.outcome ? [fake.outcome] : [] };
    if (sql.includes("UPDATE audit_outbox SET delivered_at")) fake.delivered = true;
    return { rows: [] };
  },
}) }));
vi.mock("./full-system-audit", async importOriginal => ({
  ...await importOriginal<typeof import("./full-system-audit")>(),
  writeAuditIntent: fake.intent,
  appendAuditOutcome: async (value: unknown) => {
    if (fake.failDelivery) throw new Error("audit offline");
    await fake.append(value);
  },
}));

import { AuditOutcomePendingError } from "./full-system-audit";
import { outcomeAction, runAuditedMutation } from "./full-system-audit-outbox";

const mutation = (fail = false) => runAuditedMutation({
  prepare: async () => { fake.commands.push("preflight"); return { previous: 1 }; },
  intent: () => ({ actorUserId: "actor", action: "SYNTHETIC_CHANGE_REQUESTED",
    resourceType: "fixture", resourceId: "fixture-1" }),
  mutate: async () => {
    fake.commands.push("mutation");
    if (fail) throw new Error("synthetic rollback");
    return { version: 2 };
  },
  committedAfter: result => ({ version: result.version }),
});

describe("transactional audit outcomes", () => {
  beforeEach(() => {
    fake.commands.length = 0; fake.outcome = null; fake.delivered = false; fake.failDelivery = false;
    fake.failCommit = false;
    fake.append.mockClear(); fake.intent.mockClear();
  });

  it("queues COMMITTED in the domain transaction and delivers after COMMIT", async () => {
    expect(await mutation()).toEqual({ version: 2 });
    expect(fake.outcome?.action).toBe("SYNTHETIC_CHANGE_COMMITTED");
    expect(fake.delivered).toBe(true);
    expect(fake.commands.indexOf("INSERT INTO audit_outbox")).toBeLessThan(fake.commands.indexOf("COMMIT"));
    expect(fake.append).toHaveBeenCalledWith(expect.objectContaining({ action: "SYNTHETIC_CHANGE_COMMITTED" }));
  });

  it("records REJECTED after a rolled-back mutation", async () => {
    await expect(mutation(true)).rejects.toThrow("synthetic rollback");
    expect(fake.outcome?.action).toBe("SYNTHETIC_CHANGE_REJECTED");
    expect(fake.commands.indexOf("ROLLBACK")).toBeLessThan(fake.commands.indexOf("INSERT INTO audit_outbox"));
    expect(fake.delivered).toBe(true);
  });

  it("returns pending instead of reporting a committed change as failed when delivery stops", async () => {
    fake.failDelivery = true;
    await expect(mutation()).rejects.toBeInstanceOf(AuditOutcomePendingError);
    expect(fake.commands).toContain("COMMIT");
    expect(fake.outcome?.action).toBe("SYNTHETIC_CHANGE_COMMITTED");
    expect(fake.delivered).toBe(false);
  });

  it("marks a lost COMMIT response as unknown rather than asserting success", async () => {
    fake.failCommit = true;
    await expect(mutation()).rejects.toMatchObject({ commitState: "UNKNOWN" });
    expect(fake.outcome?.action).toBe("SYNTHETIC_CHANGE_COMMITTED");
  });

  it("does not mutate when the audit intent cannot be written", async () => {
    fake.intent.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(mutation()).rejects.toThrow("audit unavailable");
    expect(fake.commands).not.toContain("mutation");
  });

  it("rejects malformed intent actions", () => {
    expect(() => outcomeAction("SYNTHETIC_CHANGE", "COMMITTED")).toThrow();
  });
});
