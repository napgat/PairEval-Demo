import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

const environment = process.argv[2] ?? "development";
if (!["development", "staging"].includes(environment)) throw new Error("Use development or staging");
process.loadEnvFile(environment === "development" ? ".env.local" : ".env.staging.local");
if (process.env.PAIR_EVAL_ENV !== environment || !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname !== process.env.PAIR_EVAL_EXPECTED_DB_HOST) {
  throw new Error("PairEval operational database guard failed");
}
const origin = environment === "development" ? "http://localhost:3101" : "https://paireval-full-staging.vercel.app";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const suffix = randomUUID().slice(0, 8);
const owner = randomUUID(), outsider = randomUUID(), students = Array.from({ length: 9 }, () => randomUUID());
const users = [owner, outsider, ...students], room = randomUUID();
const groups = Array.from({ length: 3 }, () => randomUUID());
const tokens = new Map(users.map(id => [id, randomBytes(32).toString("hex")]));
let assignment;
async function api(path, user, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: {
    Cookie: `paireval_full_session=${tokens.get(user)}`,
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, payload: await response.json() };
}
function check(result, status, name) {
  if (result.status !== status) throw new Error(`${name}: expected ${status}, got ${result.status} (${result.payload?.error?.code ?? "none"})`);
  return result.payload.data;
}
try {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    for (const [index, id] of users.entries()) {
      const email = `day4-${index}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user (id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES ($1,$2,$2,$3,'ACTIVE',$4)`, [id, email, `Synthetic Day 4 ${index}`, index === 0]);
      await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version)
        VALUES ($1,'synthetic-staging-v1')`, [id]);
      await client.query(`INSERT INTO app_session (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '20 minutes')`, [randomUUID(), id,
        createHash("sha256").update(tokens.get(id)).digest("hex")]);
    }
    await client.query("INSERT INTO classroom (id,name,slug,created_by) VALUES ($1,$2,$3,$4)",
      [room, `Synthetic Day 4 ${suffix}`, `day4-${suffix}`, owner]);
    await client.query(`INSERT INTO classroom_member (id,classroom_id,user_id,role)
      VALUES ($1,$2,$3,'OWNER')`, [randomUUID(), room, owner]);
    for (const [index, id] of groups.entries()) await client.query(`INSERT INTO group_entity
      (id,classroom_id,name) VALUES ($1,$2,$3)`, [id, room, `G${index}`]);
    for (const [index, id] of students.entries()) await client.query(`INSERT INTO classroom_member
      (id,classroom_id,user_id,role,group_id) VALUES ($1,$2,$3,'STUDENT',$4)`,
    [randomUUID(), room, id, groups[Math.floor(index / 3)]]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }

  const body = { name: "Synthetic evaluation", description: "Synthetic only", groupMaxScore: 10,
    individualMaxScore: 0, groupDeadline: "2030-12-01T16:59:00+07:00", individualDeadline: null,
    targetCoverage: 1, maxWorkload: 8,
    criteria: [{ side: "GROUP", name: "Quality", weightPct: 100 }], artifacts: [] };
  check(await api(`/api/full-system/classrooms/${room}/student-assignments`, outsider), 404, "outsider classroom");
  assignment = check(await api(`/api/full-system/classrooms/${room}/assignments`, owner, "POST", body), 201, "create").id;
  check(await api(`/api/full-system/assignments/${assignment}/publish`, owner, "POST", { seed: "day4" }), 200, "publish");
  const path = `/api/full-system/assignments/${assignment}/evaluation/group`;
  const pairRow = await pool.query(`SELECT id,evaluator_user_id,display_left FROM pair_assignment
    WHERE assignment_id=$1 AND side='GROUP' AND (group_a_id=$2 OR group_b_id=$2) ORDER BY id LIMIT 1`,
  [assignment, groups[0]]);
  if (!pairRow.rows[0]) throw new Error("Fixture lacks group pair");
  const pair = pairRow.rows[0], evaluator = pair.evaluator_user_id, targetStudent = students[0];
  const own = check(await api(path, evaluator), 200, "assigned pairs");
  if (!own.pairs.some(row => row.id === pair.id) || own.pairs.some(row => "evaluatorId" in row)) {
    throw new Error("Pair retrieval scope or anonymity failed");
  }
  check(await api(path, outsider), 404, "outsider evaluation");
  check(await api(path, students.find(id => id !== evaluator), "PUT", { pairId: pair.id, choice: 1 }), 404, "other student's pair");
  const scorePath = `/api/full-system/assignments/${assignment}/my-score`;
  const before = check(await api(scorePath, targetStudent), 200, "initial score");
  if (before.groupStatus !== "NO_DATA" || before.total !== null) throw new Error("No-data score leak");
  check(await api(path, evaluator, "PUT", { pairId: pair.id, choice: 1 }), 200, "save draft");
  if (check(await api(path, evaluator), 200, "draft refresh").pairs.find(row => row.id === pair.id)?.choice !== 1) {
    throw new Error("Draft not restored");
  }
  if (check(await api(scorePath, targetStudent), 200, "score excludes draft").groupStatus !== "NO_DATA") {
    throw new Error("Unsubmitted draft affected score");
  }
  const first = check(await api(path, evaluator, "POST"), 200, "partial submit");
  if (first.revision !== 1 || first.answered !== 1) throw new Error("First revision mismatch");
  const score1 = check(await api(scorePath, targetStudent), 200, "score after submit");
  if (score1.groupStatus !== "AVAILABLE" || score1.groupComponent === null ||
      JSON.stringify(score1).includes("evaluatorId")) throw new Error("Published own score missing or identity leak");
  check(await api(path, evaluator, "PUT", { pairId: pair.id, choice: 6 }), 200, "save changed draft");
  const second = check(await api(path, evaluator, "POST"), 200, "re-submit");
  if (second.revision !== 2) throw new Error("Second revision missing");
  const score2 = check(await api(scorePath, targetStudent), 200, "score from latest revision");
  if (score1.groupComponent === score2.groupComponent) throw new Error("Latest submission did not change score");
  const revisions = await pool.query(`SELECT r.revision_number,a.choice FROM submission_revision r
    JOIN submission_answer a ON a.revision_id=r.id WHERE r.assignment_id=$1 ORDER BY r.revision_number`, [assignment]);
  if (revisions.rows.length !== 2 || revisions.rows[0].choice !== 1 || revisions.rows[1].choice !== 6) {
    throw new Error("Immutable revision history mismatch");
  }
  await pool.query("UPDATE assignment SET group_deadline_utc=now()-interval '5 minutes' WHERE id=$1", [assignment]);
  check(await api(path, evaluator, "PUT", { pairId: pair.id, choice: 2 }), 409, "deadline save");
  check(await api(path, evaluator, "POST"), 409, "deadline submit");
  if (!check(await api(path, evaluator), 200, "deadline read-only").readOnly) throw new Error("Read-only deadline missing");
  const deadlinePath = `/api/full-system/assignments/${assignment}/deadlines`;
  check(await api(deadlinePath, outsider, "PATCH", { groupDeadline: "2030-12-02T16:59:00+07:00" }), 404, "outsider deadline");
  check(await api(deadlinePath, owner, "PATCH", { groupDeadline: "2030-12-02T16:59:00+07:00" }), 200, "extend after deadline");
  if (check(await api(path, evaluator), 200, "extended deadline").readOnly) throw new Error("Extension did not reopen evaluation");
  console.log(`${environment} Day 4 evaluation smoke passed: scope, draft refresh/exclusion, partial submit,
    immutable re-submit, score change from latest revision, deadline denial/extension, no identity leak`);
} finally {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    if (assignment) {
      await client.query(`DELETE FROM submission_answer WHERE revision_id IN
        (SELECT id FROM submission_revision WHERE assignment_id=$1)`, [assignment]);
      await client.query("DELETE FROM submission_revision WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM evaluation_draft_answer WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM evaluation_draft WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM pair_assignment WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM assignment_generation WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM criterion WHERE assignment_id=$1", [assignment]);
      await client.query("DELETE FROM assignment WHERE id=$1", [assignment]);
    }
    await client.query("DELETE FROM classroom_member WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM group_entity WHERE classroom_id=$1", [room]);
    await client.query("DELETE FROM classroom WHERE id=$1", [room]);
    await client.query("DELETE FROM app_session WHERE user_id=ANY($1::uuid[])", [users]);
    await client.query("DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])", [users]);
    await client.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [users]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
