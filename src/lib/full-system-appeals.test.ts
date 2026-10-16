import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import type { FullActor } from "./full-system-auth";

const fake = vi.hoisted(() => ({
  assignmentStatus: "CLOSED", latestKind: "FINAL" as string | null,
  query: vi.fn(), intent: vi.fn(),
}));
vi.mock("./full-system-audit-outbox", () => ({
  runAuditedMutation: async (operation: {
    prepare: (client: PoolClient) => Promise<unknown>;
    intent: (prepared: unknown) => unknown;
    mutate: (client: PoolClient, prepared: unknown) => Promise<unknown>;
  }) => {
    const client = { query: fake.query } as unknown as PoolClient;
    const prepared = await operation.prepare(client);
    fake.intent(operation.intent(prepared));
    return operation.mutate(client, prepared);
  },
}));
import { resolveAppeal } from "./full-system-appeals";

const assignmentId = "00000000-0000-4000-8000-000000000001";
const appealId = "00000000-0000-4000-8000-000000000002";
const snapshotId = "00000000-0000-4000-8000-000000000003";
const actor: FullActor = { id: "owner", email: "owner@example.test", hostedDomain: null,
  platformRole: "USER", canCreateClassroom: true, privacyAccepted: true };
const reply = "Reviewed the synthetic score and published the confirmed result";

describe("appeal closure uses confirmed scores", () => {
  beforeEach(() => {
    fake.assignmentStatus = "CLOSED"; fake.latestKind = "FINAL";
    fake.intent.mockClear(); fake.query.mockReset();
    fake.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM assignment a")) return { rows: [{ classroom_id: "classroom", generation: 1,
        role: "OWNER", status: fake.assignmentStatus, allowed_email_domains: [], window_open: true }] };
      if (sql.includes("SELECT status FROM appeal")) return { rows: [{ status: "OPEN" }] };
      if (sql.includes("FROM score_snapshot")) return { rows: fake.latestKind ? [{ id: snapshotId, kind: fake.latestKind }] : [] };
      return { rows: [] };
    });
  });
  it.each(["RESOLVED", "REJECTED"])("keeps an appeal open during Reopen, including %s", async status => {
    await expect(resolveAppeal(actor, assignmentId, appealId, status, reply))
      .rejects.toThrow("Finalize the current scores");
    expect(fake.query.mock.calls.some(([sql]) => sql.includes("UPDATE appeal"))).toBe(false);
    expect(fake.intent).not.toHaveBeenCalled();
  });
  it.each(["INTERIM", null])("rejects a finalized flag without a current Final snapshot (%s)", async kind => {
    fake.assignmentStatus = "FINALIZED"; fake.latestKind = kind;
    await expect(resolveAppeal(actor, assignmentId, appealId, "RESOLVED", reply))
      .rejects.toThrow("Finalize the current scores");
    expect(fake.query.mock.calls.some(([sql]) => sql.includes("UPDATE appeal"))).toBe(false);
  });
  it.each(["RESOLVED", "REJECTED"])("allows %s on a confirmed Final and audits the snapshot", async status => {
    fake.assignmentStatus = "FINALIZED";
    await expect(resolveAppeal(actor, assignmentId, appealId, status, reply)).resolves.toEqual({ id: appealId, status });
    expect(fake.intent).toHaveBeenCalledWith(expect.objectContaining({ after: { status, finalSnapshotId: snapshotId } }));
    expect(fake.query.mock.calls.some(([sql]) => sql.includes("UPDATE appeal"))).toBe(true);
  });
});
