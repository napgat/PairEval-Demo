import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"), { readOnly: true });
const count = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
let checks = 0;
async function check(name, condition) { assert.ok(condition, name); checks++; console.log(`PASS ${name}`); }
async function login(role) {
  const response = await fetch(`${base}/api/demo/session`, { method: "POST", body: new URLSearchParams({ role }), redirect: "manual" });
  await check(`${role} session created`, response.status === 303 && !!response.headers.get("set-cookie"));
  return response.headers.get("set-cookie").split(";")[0];
}
async function post(path, payload, cookie) {
  return fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(payload) });
}

try {
  const studentCookie = await login("student");
  const instructorCookie = await login("instructor");
  const csv = "email,groupname\nsmoke-a@demo.invalid,Orion\nsmoke-b@demo.invalid,Nova";
  const classroomPayload = { name: "ห้องทดสอบวันที่ 2", csv };
  const assignmentPayload = {
    classroomId: "", name: "งานทดสอบวันที่ 2", totalScore: 20, groupMax: 15, individualMax: 5,
    groupDeadline: "2030-01-01T00:00:00.000Z", individualDeadline: "2030-01-01T00:00:00.000Z",
    groupCriteria: [{ name: "คุณภาพ", weightPercent: 100 }], individualCriteria: [{ name: "ร่วมมือ", weightPercent: 100 }],
  };
  for (const path of ["/api/classrooms/preview", "/api/classrooms", "/api/assignments"]) {
    const response = await post(path, path.endsWith("preview") ? { csv } : path.endsWith("classrooms") ? classroomPayload : assignmentPayload, studentCookie);
    await check(`student denied ${path}`, response.status === 403);
  }
  await check("anonymous classroom create denied", (await post("/api/classrooms", classroomPayload)).status === 403);
  const instructorPage = await fetch(`${base}/demo/instructor/classrooms/new`, { headers: { Cookie: studentCookie }, redirect: "manual" });
  await check("student denied instructor page", instructorPage.status === 307 || instructorPage.status === 308);

  const preview = await post("/api/classrooms/preview", { csv }, instructorCookie);
  const previewBody = await preview.json();
  await check("valid CSV preview", preview.status === 200 && previewBody.rows.length === 2 && previewBody.groups.length === 2);
  const before = { classrooms: count("classrooms"), groups: count("groups"), users: count("users") };
  const invalidCsv = await post("/api/classrooms", { name: "Bad CSV", csv: `${csv}\nsmoke-a@demo.invalid,Atlas` }, instructorCookie);
  await check("duplicate CSV rejected without writes", invalidCsv.status === 422 && count("classrooms") === before.classrooms && count("groups") === before.groups && count("users") === before.users);
  const rollback = await post("/api/classrooms", { name: "Rollback CSV", csv: "email,groupname\nnew@demo.invalid,Orion\ninstructor@demo.invalid,Nova" }, instructorCookie);
  await check("transaction rolls back instructor-email conflict", rollback.status === 422 && count("classrooms") === before.classrooms && count("users") === before.users);
  const created = await post("/api/classrooms", classroomPayload, instructorCookie);
  const createdBody = await created.json();
  await check("classroom and groups saved", created.status === 201 && count("classrooms") === before.classrooms + 1 && count("groups") === before.groups + 2 && count("memberships") === 27);
  const rosterPage = await fetch(`${base}/demo/instructor/roster/${createdBody.id}`, { headers: { Cookie: instructorCookie } });
  await check("created roster reopens", rosterPage.status === 200 && (await rosterPage.text()).includes("smoke-a@demo.invalid"));

  assignmentPayload.classroomId = createdBody.id;
  const assignmentBefore = count("assignments");
  const badWeight = await post("/api/assignments", { ...assignmentPayload, groupCriteria: [{ name: "คุณภาพ", weightPercent: 90 }] }, instructorCookie);
  const badWeightBody = await badWeight.json();
  await check("90% criterion weight rejected without write", badWeight.status === 422 && badWeightBody.errors.join(" ").includes("100%") && count("assignments") === assignmentBefore);
  const badTotal = await post("/api/assignments", { ...assignmentPayload, totalScore: 25 }, instructorCookie);
  await check("score split mismatch rejected", badTotal.status === 422 && count("assignments") === assignmentBefore);
  const assignment = await post("/api/assignments", assignmentPayload, instructorCookie);
  const assignmentBody = await assignment.json();
  await check("assignment and criteria saved", assignment.status === 201 && count("assignments") === assignmentBefore + 1 && !!db.prepare("SELECT 1 FROM criteria WHERE assignment_id = ?").get(assignmentBody.id));
  const assignmentPage = await fetch(`${base}/demo/instructor/assignment/${assignmentBody.id}`, { headers: { Cookie: instructorCookie } });
  await check("created assignment reopens", assignmentPage.status === 200 && (await assignmentPage.text()).includes("งานทดสอบวันที่ 2"));
  console.log(`Day 2 smoke: ${checks} passed, 0 failed.`);
} finally { db.close(); }
