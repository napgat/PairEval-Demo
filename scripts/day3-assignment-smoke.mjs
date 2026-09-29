import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

const environment = process.argv[2] ?? "development";
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational environment guard failed");
}
const origin = environment === "development" ? "http://localhost:3101" : "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const suffix = randomUUID().slice(0, 8);
const ownerId = randomUUID(), outsiderId = randomUUID();
const studentIds = Array.from({ length: 12 }, () => randomUUID());
const userIds = [ownerId, outsiderId, ...studentIds];
const roomId = randomUUID(), smallRoomId = randomUUID();
const roomIds = [roomId, smallRoomId];
const groups = Array.from({ length: 3 }, () => randomUUID());
const smallGroups = [randomUUID(), randomUUID()];
const token = randomBytes(32).toString("hex"), outsiderToken = randomBytes(32).toString("hex");
const assignmentIds = [];

async function api(path, method = "GET", body, auth = token) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    Cookie: `paireval_full_session=${auth}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = (response.headers.get("content-type") ?? "").includes("application/json")
    ? await response.json() : null;
  return { status: response.status, payload };
}
function check(result, status, label) {
  if (result.status !== status) throw new Error(`${label}: expected ${status}, got ${result.status}, code=${result.payload?.error?.code ?? "none"}`);
  return result.payload?.data;
}
const input = (name, overrides = {}) => ({ name, description: "Synthetic assignment only",
  groupMaxScore: 10, individualMaxScore: 0,
  groupDeadline: "2030-12-01T16:59:00+07:00", individualDeadline: null,
  targetCoverage: 5, maxWorkload: 8,
  criteria: [{ side: "GROUP", name: "Clarity", weightPct: 50 },
    { side: "GROUP", name: "Evidence", weightPct: 50 }],
  artifacts: [{ side: "GROUP", itemId: groups[0], url: "https://example.test/group-a" },
    { side: "GROUP", itemId: groups[1], url: "https://example.test/group-b" }], ...overrides });

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < userIds.length; index++) {
      const email = `day3-${index}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [userIds[index], email, `Synthetic Day 3 ${index}`, index === 0]);
      if (index < 2) {
        await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
          VALUES ($1,'synthetic-staging-v1')`, [userIds[index]]);
        const value = index === 0 ? token : outsiderToken;
        await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
          VALUES ($1,$2,$3,now()+interval '15 minutes')`,
        [randomUUID(), userIds[index], createHash("sha256").update(value).digest("hex")]);
      }
    }
    for (const [index, id] of roomIds.entries()) {
      await client.query("INSERT INTO classroom (id,name,slug,created_by) VALUES ($1,$2,$3,$4)",
        [id, `Synthetic Day 3 ${index} ${suffix}`, `day3-${index}-${suffix}`, ownerId]);
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
        VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), id, ownerId]);
    }
    for (let index = 0; index < groups.length; index++) {
      await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,$3)",
        [groups[index], roomId, `G${index}`]);
    }
    for (let index = 0; index < smallGroups.length; index++) {
      await client.query("INSERT INTO group_entity (id,classroom_id,name) VALUES ($1,$2,$3)",
        [smallGroups[index], smallRoomId, `S${index}`]);
    }
    for (let index = 0; index < studentIds.length; index++) {
      await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
        VALUES ($1,$2,$3,'STUDENT',$4)`, [randomUUID(), roomId, studentIds[index], groups[Math.floor(index / 4)]]);
      if (index < 8) await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role,group_id)
        VALUES ($1,$2,$3,'STUDENT',$4)`,
      [randomUUID(), smallRoomId, studentIds[index], smallGroups[Math.floor(index / 4)]]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }

  check(await api(`/api/full-system/classrooms/${roomId}/assignments`, "GET", undefined, outsiderToken), 404, "outsider list");
  const invalid = await api(`/api/full-system/classrooms/${roomId}/assignments`, "POST",
    input("Invalid weights", { criteria: [{ side: "GROUP", name: "Only", weightPct: 90 }] }));
  const draftId = check(invalid, 201, "draft accepts incomplete weights")?.id;
  assignmentIds.push(draftId);
  check(await api(`/api/full-system/assignments/${draftId}/feasibility?seed=7`), 422, "weights rejected before publish");
  check(await api(`/api/full-system/assignments/${draftId}`, "PUT", input("Feasible assignment")), 200, "replace draft");
  const preview = check(await api(`/api/full-system/assignments/${draftId}/feasibility?seed=7`), 200, "feasibility");
  if (!preview.feasible || preview.parts.length !== 2 || preview.parts.some(part => part.coverage !== 4)) {
    throw new Error("Unexpected feasibility/coverage for 3 x 4 fixture");
  }
  const published = check(await api(`/api/full-system/assignments/${draftId}/publish`, "POST", { seed: "7" }), 200, "publish");
  if (published.assignmentCount !== 24 || published.generation !== 1) throw new Error("Incorrect persisted pairing count");
  const first = await pool.query(`SELECT side,count(*)::integer AS n,
    count(*) FILTER (WHERE student_a_id IS NOT NULL)::integer AS individuals,
    count(*) FILTER (WHERE left_artifact_url IS NOT NULL OR right_artifact_url IS NOT NULL)::integer AS artifacts
    FROM pair_assignment WHERE assignment_id=$1 AND generation=1 GROUP BY side`, [draftId]);
  if (first.rows.length !== 1 || first.rows[0].n !== 24 || first.rows[0].individuals !== 0 || first.rows[0].artifacts < 1) {
    throw new Error("Database pairing/artifact count mismatch");
  }
  check(await api(`/api/full-system/assignments/${draftId}/publish`, "POST", { seed: "7" }), 409, "duplicate publish");
  check(await api(`/api/full-system/assignments/${draftId}`, "PUT", input("Cannot edit open")), 409, "open edit denied");
  check(await api(`/api/full-system/assignments/${draftId}/unpublish`, "POST",
    { reason: "synthetic republish check" }), 200, "unpublish");
  check(await api(`/api/full-system/assignments/${draftId}`, "PUT", input("Republished assignment", {
    criteria: [{ side: "GROUP", name: "Combined", weightPct: 100 }] })), 200, "edit after unpublish");
  const republished = check(await api(`/api/full-system/assignments/${draftId}/publish`, "POST", { seed: "7" }), 200, "republish");
  if (republished.assignmentCount !== 12 || republished.generation !== 2) throw new Error("Incorrect generation 2 count");
  const history = await pool.query(`SELECT generation,count(*)::integer AS n FROM pair_assignment
    WHERE assignment_id=$1 GROUP BY generation ORDER BY generation`, [draftId]);
  if (history.rows.length !== 2 || history.rows[0].n !== 24 || history.rows[1].n !== 12) {
    throw new Error("Pairing history was not preserved");
  }
  const clone = check(await api(`/api/full-system/assignments/${draftId}/clone`, "POST",
    { name: "Synthetic clone" }), 201, "clone");
  assignmentIds.push(clone.id);
  const cloned = check(await api(`/api/full-system/assignments/${clone.id}`), 200, "clone detail");
  if (cloned.status !== "DRAFT" || cloned.criteria.length !== 1 || cloned.artifacts.length !== 2) {
    throw new Error("Clone configuration mismatch");
  }
  const impossible = check(await api(`/api/full-system/classrooms/${smallRoomId}/assignments`, "POST",
    input("Two-group infeasible", { artifacts: [] })), 201, "infeasible draft");
  assignmentIds.push(impossible.id);
  const noPlan = check(await api(`/api/full-system/assignments/${impossible.id}/feasibility?seed=7`), 200, "infeasible preview");
  if (noPlan.feasible || noPlan.parts.some(part => part.coverage !== 0)) throw new Error("Two-group plan should be infeasible");
  check(await api(`/api/full-system/assignments/${impossible.id}/publish`, "POST", { seed: "7" }), 409, "infeasible publish");
  const unchanged = await pool.query(`SELECT status,generation,(SELECT count(*)::integer FROM pair_assignment
    WHERE assignment_id=$1) AS pairs FROM assignment WHERE id=$1`, [impossible.id]);
  if (unchanged.rows[0]?.status !== "DRAFT" || unchanged.rows[0].generation !== 0 || unchanged.rows[0].pairs !== 0) {
    throw new Error("Infeasible publish wrote partial state");
  }
  console.log(`${environment} Day 3 assignment smoke passed: draft/weights, feasible publish 24, no Individual,
    artifacts, unpublish/re-publish generations 24+12, clone, infeasible rollback`);
} finally {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM pair_assignment WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM assignment_generation WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM group_artifact WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM individual_artifact WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM criterion WHERE assignment_id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM assignment WHERE id=ANY($1::uuid[])", [assignmentIds]);
    await client.query("DELETE FROM classroom_member WHERE classroom_id=ANY($1::uuid[])", [roomIds]);
    await client.query("DELETE FROM group_entity WHERE classroom_id=ANY($1::uuid[])", [roomIds]);
    await client.query("DELETE FROM classroom WHERE id=ANY($1::uuid[])", [roomIds]);
    await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [userIds]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
