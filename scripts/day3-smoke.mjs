import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"), { readOnly: true });
let checks = 0;
function check(name, condition) { assert.ok(condition, name); checks++; console.log(`PASS ${name}`); }
async function login(role) {
  const response = await fetch(`${base}/api/demo/session`, { method: "POST", body: new URLSearchParams({ role }), redirect: "manual" });
  check(`${role} session`, response.status === 303);
  return response.headers.get("set-cookie").split(";")[0];
}
async function pairing(id, cookie, method = "GET") {
  return fetch(`${base}/api/assignments/${id}/pairings`, { method, headers: { Cookie: cookie } });
}

try {
  const instructor = await login("instructor");
  const student = await login("student");
  const feasibleId = "class-feasible-assignment";
  const infeasibleId = "class-infeasible-assignment";
  const feasibleResponse = await pairing(feasibleId, instructor);
  const feasible = await feasibleResponse.json();
  check("feasible preview has target, planned coverage and evaluator loads", feasibleResponse.status === 200 && feasible.status === "ready" && feasible.target === 5 && feasible.totalPairs === 69 && feasible.plannedAssignments === 345 && feasible.actualAssignments === 0 && feasible.workloads.length === 21 && feasible.workloads.reduce((sum, item) => sum + item.planned, 0) === 345 && feasible.pairs.every(pair => pair.target === 5 && pair.planned === 5 && pair.actual === 0 && pair.eligibleCount >= 5));
  const infeasibleResponse = await pairing(infeasibleId, instructor);
  const infeasible = await infeasibleResponse.json();
  check("infeasible preview explains insufficient evaluators", infeasibleResponse.status === 200 && infeasible.status === "infeasible" && infeasible.totalPairs === 4 && infeasible.plannedAssignments === 0 && infeasible.actualAssignments === 0 && infeasible.issues.length === 4 && infeasible.issues.every(issue => issue.includes("ต้องการ 5 คน")));
  check("student cannot read instructor pairing preview", (await pairing(feasibleId, student)).status === 403);
  check("student cannot generate pairs", (await pairing(feasibleId, student, "POST")).status === 403);
  const rejected = await pairing(infeasibleId, instructor, "POST");
  const rejectedBody = await rejected.json();
  check("infeasible assignment rejected atomically", rejected.status === 422 && rejectedBody.result === "infeasible" && db.prepare("SELECT COUNT(*) AS n FROM pair_assignments").get().n === 0);
  const generatedResponse = await pairing(feasibleId, instructor, "POST");
  const generated = await generatedResponse.json();
  check("feasible assignment saved in full", generatedResponse.status === 201 && generated.result === "created" && generated.preview.status === "generated" && generated.preview.actualAssignments === 345 && generated.preview.workloads.reduce((sum, item) => sum + item.actual, 0) === 345 && generated.preview.pairs.every(pair => pair.actual === 5));
  const rows = db.prepare("SELECT pair_assignments.*, criteria.kind FROM pair_assignments JOIN criteria ON criteria.id = pair_assignments.criterion_id WHERE pair_assignments.assignment_id = ?").all(feasibleId);
  const members = db.prepare("SELECT user_id AS id, group_id AS groupId FROM memberships WHERE classroom_id = 'class-feasible'").all();
  const memberById = new Map(members.map(member => [member.id, member]));
  check("database has exactly 345 unique assignments", rows.length === 345 && new Set(rows.map(row => `${row.criterion_id}/${row.item_a_id}/${row.item_b_id}/${row.evaluator_id}`)).size === 345);
  check("saved Group and Individual assignments exclude self", rows.every(row => {
    const evaluator = memberById.get(row.evaluator_id);
    return row.kind === "group" ? evaluator.groupId !== row.item_a_id && evaluator.groupId !== row.item_b_id
      : evaluator.id !== row.item_a_id && evaluator.id !== row.item_b_id && evaluator.groupId === memberById.get(row.item_a_id)?.groupId && evaluator.groupId === memberById.get(row.item_b_id)?.groupId;
  }));
  const again = await pairing(feasibleId, instructor, "POST");
  check("repeated generation blocked without extra rows", again.status === 409 && db.prepare("SELECT COUNT(*) AS n FROM pair_assignments").get().n === 345);
  const after = await (await pairing(feasibleId, instructor)).json();
  check("reopened preview shows persisted actual coverage", after.status === "generated" && after.actualAssignments === 345 && after.pairs.every(pair => pair.actual === 5 && pair.planned === 0));
  console.log(`Day 3 smoke: ${checks} passed, 0 failed.`);
} finally { db.close(); }
