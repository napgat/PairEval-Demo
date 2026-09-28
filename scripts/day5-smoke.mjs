import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const id = "class-feasible-assignment";
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"));
let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); }
async function login(role) {
  const response = await fetch(`${base}/api/demo/session`, { method: "POST", body: new URLSearchParams({ role }), redirect: "manual" });
  check(`${role} login`, response.status === 303);
  return response.headers.get("set-cookie").split(";")[0];
}
const scoresUrl = `${base}/api/assignments/${id}/scores`;
const exportUrl = `${base}/api/assignments/${id}/export`;
async function scores(cookie) { return fetch(scoresUrl, { headers: cookie ? { Cookie: cookie } : {} }); }
async function evaluate(kind, cookie, method, answers) { return fetch(`${base}/api/assignments/${id}/evaluation/${kind}`, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ answers }) }); }

try {
  const instructor = await login("instructor");
  const student = await login("student");
  check("anonymous cannot read scores", (await scores()).status === 401);
  check("student cannot export", (await fetch(exportUrl, { headers: { Cookie: student } })).status === 403);
  check("student cannot read another assignment", (await fetch(`${base}/api/assignments/class-infeasible-assignment/scores`, { headers: { Cookie: student } })).status === 403);
  const generated = await fetch(`${base}/api/assignments/${id}/pairings`, { method: "POST", headers: { Cookie: instructor } });
  check("pairing created", generated.status === 201 && (await generated.json()).preview.actualAssignments === 345);
  const empty = await (await scores(instructor)).json();
  check("no answers marks group baselines NO_DATA", empty.hasNoData && empty.groups.every(group => group.baseScore === null));
  const groupView = await (await fetch(`${base}/api/assignments/${id}/evaluation/group`, { headers: { Cookie: student } })).json();
  const individualView = await (await fetch(`${base}/api/assignments/${id}/evaluation/individual`, { headers: { Cookie: student } })).json();
  const groupAnswers = Object.fromEntries(groupView.pairs.map(pair => [pair.id, null]));
  const individualAnswers = Object.fromEntries(individualView.pairs.map(pair => [pair.id, null]));
  groupAnswers[groupView.pairs[0].id] = 1;
  individualAnswers[individualView.pairs[0].id] = 3;
  check("save Group draft", (await evaluate("group", student, "PUT", groupAnswers)).status === 200);
  const beforeSubmission = await (await scores(student)).json();
  check("draft ignored and both unsubmitted sections score zero", beforeSubmission.score.groupScore === 0 && beforeSubmission.score.individualScore === 0 && !beforeSubmission.score.groupSubmitted);
  execFileSync(process.execPath, ["scripts/seed-answers.mjs"], { cwd: process.cwd(), stdio: "pipe" });
  const seeded = await (await scores(instructor)).json();
  check("synthetic submitted revisions produce baselines", seeded.groups.every(group => group.baseScore !== null) && !seeded.hasNoData && seeded.pairCoverage.length === 69);
  const zero = await (await scores(student)).json();
  check("no submission earns zero despite peer ratings", zero.score.groupBase > 0 && zero.score.individualBase > 0 && zero.score.groupScore === 0 && zero.score.individualScore === 0);
  check("partial Group submit", (await evaluate("group", student, "POST", groupAnswers)).status === 200);
  check("partial Individual submit", (await evaluate("individual", student, "POST", individualAnswers)).status === 200);
  const partial = await (await scores(student)).json();
  check("partial completion scales own scores", partial.score.groupAnswered === 1 && partial.score.groupScore > 0 && Math.abs(partial.score.groupScore - partial.score.groupBase / partial.score.groupAssigned) < 1e-9 && Math.abs(partial.score.individualScore - partial.score.individualBase / partial.score.individualAssigned) < 1e-9);
  const groupAfterFirst = await (await scores(instructor)).json();
  const draftChanged = { ...groupAnswers, [groupView.pairs[0].id]: 6 };
  check("draft after submit saved", (await evaluate("group", student, "PUT", draftChanged)).status === 200);
  const groupAfterDraft = await (await scores(instructor)).json();
  check("draft does not change calculated result", JSON.stringify(groupAfterDraft.groups) === JSON.stringify(groupAfterFirst.groups));
  const resubmit = { ...draftChanged, [groupView.pairs[1].id]: 4 };
  check("Re-submit creates revision 2", (await (await evaluate("group", student, "POST", resubmit)).json()).revisionNumber === 2);
  const groupAfterResubmit = await (await scores(instructor)).json();
  const ownAfterResubmit = await (await scores(student)).json();
  check("latest submitted answer changes report", JSON.stringify(groupAfterResubmit.groups) !== JSON.stringify(groupAfterFirst.groups));
  check("Re-submit completion changes own score", ownAfterResubmit.score.groupAnswered === 2 && ownAfterResubmit.score.groupScore > partial.score.groupScore);
  check("old revision remains unchanged", db.prepare("SELECT choice FROM submission_answers WHERE revision_id = (SELECT id FROM submission_revisions WHERE evaluator_id = 'student-01' AND kind = 'group' AND revision_number = 1) AND pair_assignment_id = ?").get(groupView.pairs[0].id).choice === 1);
  const ownPayload = JSON.stringify(ownAfterResubmit);
  check("student score API contains no peer identities or peer scores", !ownPayload.includes("student-02") && !ownPayload.includes("evaluatorId") && !ownPayload.includes("pairCoverage") && !ownPayload.includes("items"));
  const csvResponse = await fetch(exportUrl, { headers: { Cookie: instructor } });
  const csv = await csvResponse.text();
  check("instructor downloads CSV with computed rows", csvResponse.status === 200 && csvResponse.headers.get("content-type").includes("text/csv") && csv.includes("student-01") && csv.split("\r\n").length === 23);
  check("student My Score page opens", (await fetch(`${base}/demo/student/score/${id}`, { headers: { Cookie: student } })).status === 200);
  check("instructor report page opens", (await fetch(`${base}/demo/instructor/report/${id}`, { headers: { Cookie: instructor } })).status === 200);
  console.log(`Day 5 smoke: ${passed} passed, 0 failed.`);
} finally { db.close(); }
