import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const assignmentId = "class-feasible-assignment";
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"));
let checks = 0;
function check(name, condition) { assert.ok(condition, name); checks++; console.log(`PASS ${name}`); }
async function login(role) {
  const response = await fetch(`${base}/api/demo/session`, { method: "POST", body: new URLSearchParams({ role }), redirect: "manual" });
  check(`${role} session`, response.status === 303);
  return response.headers.get("set-cookie").split(";")[0];
}
function url(kind, id = assignmentId) { return `${base}/api/assignments/${id}/evaluation/${kind}`; }
async function read(kind, cookie, id) { return fetch(url(kind, id), { headers: cookie ? { Cookie: cookie } : {} }); }
async function write(kind, cookie, answers, method = "PUT") { return fetch(url(kind), { method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ answers }) }); }
function blank(view) { return Object.fromEntries(view.pairs.map(pair => [pair.id, null])); }

try {
  const instructor = await login("instructor");
  const student = await login("student");
  const generated = await fetch(`${base}/api/assignments/${assignmentId}/pairings`, { method: "POST", headers: { Cookie: instructor } });
  check("pair assignments generated for evaluation", generated.status === 201 && (await generated.json()).preview.actualAssignments === 345);
  const groupResponse = await read("group", student);
  const group = await groupResponse.json();
  const individualResponse = await read("individual", student);
  const individual = await individualResponse.json();
  check("student reads only assigned Group pairs", groupResponse.status === 200 && group.kind === "group" && group.pairs.length > 0 && group.pairs.every(pair => db.prepare("SELECT 1 FROM pair_assignments WHERE id = ? AND evaluator_id = 'student-01'").get(pair.id)));
  check("student reads only assigned Individual pairs", individualResponse.status === 200 && individual.kind === "individual" && individual.pairs.length === 15 && individual.pairs.every(pair => db.prepare("SELECT 1 FROM pair_assignments WHERE id = ? AND evaluator_id = 'student-01'").get(pair.id)));
  check("anonymous and instructor cannot read student evaluation", (await read("group")).status === 403 && (await read("group", instructor)).status === 403);
  check("student cannot read another classroom", (await read("group", student, "class-infeasible-assignment")).status === 403);
  const otherPair = db.prepare("SELECT id FROM pair_assignments WHERE assignment_id = ? AND evaluator_id != 'student-01' AND id NOT IN (SELECT id FROM pair_assignments WHERE evaluator_id = 'student-01') LIMIT 1").get(assignmentId).id;
  check("another student's pair ID is absent from both responses", !JSON.stringify(group).includes(otherPair) && !JSON.stringify(individual).includes(otherPair));

  const groupAnswers = blank(group);
  const individualAnswers = blank(individual);
  const groupPair = group.pairs[0].id;
  const secondGroupPair = group.pairs[1].id;
  const individualPair = individual.pairs[0].id;
  groupAnswers[groupPair] = 2;
  individualAnswers[individualPair] = 5;
  check("anonymous cannot Save a draft", (await write("group", "", groupAnswers)).status === 403);
  check("instructor cannot Submit student answers", (await write("group", instructor, groupAnswers, "POST")).status === 403);
  const draftGroupResponse = await write("group", student, groupAnswers);
  const draftGroup = await draftGroupResponse.json();
  check("Group draft saved with one partial answer", draftGroupResponse.status === 200 && draftGroup.draftSavedAt && draftGroup.revisionNumber === 0 && draftGroup.answeredCount === 1);
  const reopenedGroup = await (await read("group", student)).json();
  check("Group draft survives a new GET", reopenedGroup.answers[groupPair] === 2 && reopenedGroup.draftSavedAt && reopenedGroup.latestSubmittedAt === null);
  const draftIndividualResponse = await write("individual", student, individualAnswers);
  const draftIndividual = await draftIndividualResponse.json();
  check("Individual draft is separate from Group", draftIndividualResponse.status === 200 && draftIndividual.answers[individualPair] === 5 && (await (await read("group", student)).json()).answers[groupPair] === 2);
  const foreign = await write("group", student, { ...groupAnswers, [otherPair]: 1 });
  check("student cannot Save a foreign pair", foreign.status === 403 && (await (await read("group", student)).json()).answers[groupPair] === 2);
  const foreignSubmit = await write("group", student, { ...groupAnswers, [otherPair]: 1 }, "POST");
  check("student cannot Submit a foreign pair", foreignSubmit.status === 403 && db.prepare("SELECT COUNT(*) AS n FROM submission_revisions").get().n === 0);
  const wrongKind = await write("individual", student, { ...individualAnswers, [groupPair]: 1 });
  check("Group pair cannot be sent as Individual", wrongKind.status === 403);
  const invalid = await write("group", student, { ...groupAnswers, [groupPair]: 7 });
  check("choice outside 1–6 rejected without changing draft", invalid.status === 422 && (await (await read("group", student)).json()).answers[groupPair] === 2);

  const firstGroupResponse = await write("group", student, groupAnswers, "POST");
  const firstGroup = await firstGroupResponse.json();
  check("Group Submit creates revision 1 and clears draft", firstGroupResponse.status === 200 && firstGroup.revisionNumber === 1 && firstGroup.latestSubmittedAt && firstGroup.draftSavedAt === null && firstGroup.answers[groupPair] === 2);
  check("Individual status unchanged by Group Submit", (await (await read("individual", student)).json()).revisionNumber === 0);
  const firstIndividualResponse = await write("individual", student, individualAnswers, "POST");
  const firstIndividual = await firstIndividualResponse.json();
  check("Individual Submit creates its own revision 1", firstIndividualResponse.status === 200 && firstIndividual.revisionNumber === 1 && (await (await read("group", student)).json()).revisionNumber === 1);

  groupAnswers[groupPair] = 6;
  groupAnswers[secondGroupPair] = 4;
  const secondGroupResponse = await write("group", student, groupAnswers, "POST");
  const secondGroup = await secondGroupResponse.json();
  const revisions = db.prepare("SELECT id, revision_number AS number FROM submission_revisions WHERE evaluator_id = 'student-01' AND assignment_id = ? AND kind = 'group' ORDER BY revision_number").all(assignmentId);
  const originalAnswer = db.prepare("SELECT choice FROM submission_answers WHERE revision_id = ? AND pair_assignment_id = ?").get(revisions[0].id, groupPair)?.choice;
  const latestAnswer = db.prepare("SELECT choice FROM submission_answers WHERE revision_id = ? AND pair_assignment_id = ?").get(revisions[1].id, groupPair)?.choice;
  check("Re-submit creates revision 2 without editing revision 1", secondGroupResponse.status === 200 && secondGroup.revisionNumber === 2 && revisions.length === 2 && originalAnswer === 2 && latestAnswer === 6 && secondGroup.answers[secondGroupPair] === 4);
  check("latest Group and Individual statuses remain independent", (await (await read("group", student)).json()).revisionNumber === 2 && (await (await read("individual", student)).json()).revisionNumber === 1);

  db.prepare("UPDATE assignments SET group_deadline = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(assignmentId);
  const groupCountBefore = db.prepare("SELECT COUNT(*) AS n FROM submission_revisions WHERE kind = 'group'").get().n;
  check("Group deadline blocks Save", (await write("group", student, groupAnswers)).status === 409);
  check("Group deadline blocks Submit without a new revision", (await write("group", student, groupAnswers, "POST")).status === 409 && db.prepare("SELECT COUNT(*) AS n FROM submission_revisions WHERE kind = 'group'").get().n === groupCountBefore);
  check("closed Group page still shows latest submitted answers", (await (await read("group", student)).json()).isClosed === true && (await (await read("group", student)).json()).answers[groupPair] === 6);
  check("Individual remains open after Group deadline", (await write("individual", student, individualAnswers)).status === 200);
  db.prepare("UPDATE assignments SET individual_deadline = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(assignmentId);
  check("Individual deadline blocks Submit", (await write("individual", student, individualAnswers, "POST")).status === 409);
  console.log(`Day 4 smoke: ${checks} passed, 0 failed.`);
} finally { db.close(); }
