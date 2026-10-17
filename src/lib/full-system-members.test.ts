import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import type { FullActor } from "./full-system-auth";

const fake = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), intent: vi.fn(), outcome: vi.fn() }));
vi.mock("./full-system-postgres", () => ({ databasePool: () => ({ connect: async () => ({ query: fake.query, release: fake.release }) }) }));
vi.mock("./full-system-audit-outbox", () => ({ runAuditedMutation: async (operation: {
  prepare: (client: PoolClient) => Promise<unknown>;
  intent: (prepared: unknown) => unknown;
  mutate: (client: PoolClient, prepared: unknown) => Promise<unknown>;
  committedAfter?: (result: unknown) => unknown;
}) => {
  const client = { query: fake.query } as unknown as PoolClient;
  const prepared = await operation.prepare(client);
  fake.intent(operation.intent(prepared));
  const result = await operation.mutate(client, prepared);
  fake.outcome(operation.committedAfter?.(result));
  return result;
} }));
import { addStaffMember, addStaffMemberByEmail, listStaffMembers, removeStaffMember,
  MemberAccountUnavailableError, MemberConflictError, MemberNotFoundError } from "./full-system-members";
const classroom = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const membership = "00000000-0000-4000-8000-000000000003";
const actor: FullActor = { id: "owner", email: "owner@example.test", hostedDomain: null,
  platformRole: "USER", canCreateClassroom: true, privacyAccepted: true };
describe("classroom staff membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT m.role,c.allowed")) return { rows: [{ role: "OWNER", allowed_email_domains: [] }] };
      if (sql.includes("SELECT id FROM app_user")) return { rows: [{ id: user }] };
      return { rows: [] };
    });
  });
  it("normalizes an existing email and audits a new membership", async () => {
    await expect(addStaffMemberByEmail(actor, classroom, " Staff.Name+test@Example.test ", "CO_TEACHER"))
      .resolves.toMatchObject({ userId: user, role: "CO_TEACHER", restored: false });
    expect(fake.query).toHaveBeenCalledWith(expect.stringContaining("email_lookup=$1 AND status <> 'DISABLED'"), ["staffname@example.test"]);
    expect(fake.outcome).toHaveBeenCalledWith({ role: "CO_TEACHER", membershipStatus: "ACTIVE", restored: false });
  });
  it("keeps the existing userId API", async () => {
    await expect(addStaffMember(actor, classroom, user, "TA")).resolves.toMatchObject({ userId: user, role: "TA" });
    expect(fake.query).toHaveBeenCalledWith(expect.stringContaining("WHERE id=$1 AND status <> 'DISABLED'"), [user]);
  });
  it.each(["CO_TEACHER", "TA", "STUDENT", null])("denies %s before looking up accounts", async role => {
    fake.query.mockResolvedValue({ rows: role ? [{ role, allowed_email_domains: [] }] : [] });
    await expect(addStaffMemberByEmail(actor, classroom, "staff@example.test", "TA")).rejects.toBeInstanceOf(MemberNotFoundError);
    await expect(listStaffMembers(actor, classroom)).rejects.toBeInstanceOf(MemberNotFoundError);
    expect(fake.intent).not.toHaveBeenCalled();
    expect(fake.query.mock.calls.some(([sql]) => sql.includes("FROM app_user"))).toBe(false);
    expect(fake.release).toHaveBeenCalled();
  });
  it("rejects unavailable accounts before audit or membership writes", async () => {
    fake.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("SELECT m.role,c.allowed") ? [{ role: "OWNER", allowed_email_domains: [] }] : [] }));
    await expect(addStaffMemberByEmail(actor, classroom, "unknown@example.test", "TA")).rejects.toBeInstanceOf(MemberAccountUnavailableError);
    expect(fake.intent).not.toHaveBeenCalled();
  });
  it.each(["STUDENT", "OWNER", "CO_TEACHER"])("prevents converting an existing %s", async role => {
    fake.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT m.role,c.allowed")) return { rows: [{ role: "OWNER", allowed_email_domains: [] }] };
      if (sql.includes("SELECT id FROM app_user")) return { rows: [{ id: user }] };
      return { rows: [{ id: membership, role, membership_status: role === "CO_TEACHER" ? "ACTIVE" : "WITHDRAWN" }] };
    });
    await expect(addStaffMember(actor, classroom, user, "TA")).rejects.toBeInstanceOf(MemberConflictError);
    expect(fake.intent).not.toHaveBeenCalled();
  });
  it("restores the same withdrawn staff row and records the previous role", async () => {
    fake.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT m.role,c.allowed")) return { rows: [{ role: "OWNER", allowed_email_domains: [] }] };
      if (sql.includes("SELECT id FROM app_user")) return { rows: [{ id: user }] };
      if (sql.includes("SELECT id,role,membership_status")) return { rows: [{ id: membership, role: "CO_TEACHER", membership_status: "WITHDRAWN" }] };
      return { rows: [] };
    });
    await expect(addStaffMember(actor, classroom, user, "TA")).resolves.toEqual({ id: membership, userId: user, role: "TA", restored: true });
    expect(fake.query).toHaveBeenCalledWith(expect.stringContaining("withdrawn_at=NULL"), [membership, "TA"]);
    expect(fake.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO classroom_member"))).toBe(false);
    expect(fake.intent).toHaveBeenCalledWith(expect.objectContaining({ before: { role: "CO_TEACHER", membershipStatus: "WITHDRAWN" } }));
  });
  it("preserves the final Owner", async () => {
    fake.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT m.role,c.allowed")) return { rows: [{ role: "OWNER", allowed_email_domains: [] }] };
      if (sql.includes("SELECT count(*)")) return { rows: [{ count: "1" }] };
      return { rows: [{ role: "OWNER" }] };
    });
    await expect(removeStaffMember(actor, classroom, user)).rejects.toBeInstanceOf(MemberConflictError);
    expect(fake.intent).not.toHaveBeenCalled();
  });
});
