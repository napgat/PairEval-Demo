import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"), { readOnly: true });
const custom = db.prepare("SELECT assignments.id AS assignmentId, assignments.classroom_id AS classroomId FROM assignments JOIN classrooms ON classrooms.id = assignments.classroom_id WHERE classrooms.demo_case = 'custom' ORDER BY assignments.rowid DESC LIMIT 1").get();
const evaluator = custom && db.prepare("SELECT evaluator_id AS id FROM submission_revisions WHERE assignment_id = ? AND revision_number = 2 LIMIT 1").get(custom.assignmentId);
if (!custom || !evaluator) throw new Error("Run day6-main-flow.mjs after seed:reset before this audit.");
let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); }
const browser = await chromium.launch({ headless: true });
const screenshots = join(tmpdir(), "paireval-day6-mobile");
mkdirSync(screenshots, { recursive: true });
try {
  const instructorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const instructor = await instructorContext.newPage();
  await instructor.goto(base);
  check("home fits mobile width", await instructor.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await instructor.getByRole("button", { name: /เข้า Demo ผู้สอน/ }).click();
  await instructor.goto(`${base}/demo/instructor/report/${custom.assignmentId}`);
  const instructorLinks = await instructor.locator(".sidebar a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  for (const href of instructorLinks) {
    const response = await instructor.goto(`${base}${href}`);
    check(`instructor link ${href}`, response.status() === 200 && await instructor.locator("h1").count() > 0);
  }
  await instructor.goto(`${base}/demo/instructor/pairing/class-infeasible-assignment`);
  check("infeasible pairing explains error", await instructor.getByText("จัดคู่ไม่ได้", { exact: true }).isVisible() && await instructor.locator(".error-box").isVisible());
  await instructor.goto(`${base}/demo/instructor/report/class-feasible-assignment`);
  check("empty report shows NO_DATA", await instructor.getByText(/NO_DATA\/คะแนนชั่วคราว/).count() > 0);
  await instructor.goto(`${base}/demo/instructor/extras`);
  check("P1 placeholders state they are unavailable", await instructor.getByText(/ยังไม่เปิดใช้งานใน Demo/).count() >= 1);
  for (const route of [`classrooms/new`, `assignments/new/${custom.classroomId}`, `pairing/${custom.assignmentId}`, `report/${custom.assignmentId}`]) {
    await instructor.goto(`${base}/demo/instructor/${route}`);
    check(`instructor mobile ${route}`, await instructor.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (route.startsWith("report/")) {
      await instructor.screenshot({ path: join(screenshots, "report.png"), fullPage: true });
      const table = instructor.locator(".table-wrap").first();
      check("mobile report table scrolls inside card", await table.evaluate(element => element.scrollWidth > element.clientWidth));
      await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
      check("mobile report horizontal scroll works", await table.evaluate(element => element.scrollLeft > 0));
    }
  }

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const student = await studentContext.newPage();
  await student.goto(base);
  await student.locator('select[name="userId"]').selectOption(evaluator.id);
  await student.getByRole("button", { name: /เข้า Demo นักศึกษา/ }).click();
  await student.goto(`${base}/demo/student/score/${custom.assignmentId}`);
  const studentLinks = await student.locator(".sidebar a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  for (const href of studentLinks) {
    const response = await student.goto(`${base}${href}`);
    check(`student link ${href}`, response.status() === 200 && await student.locator("h1").count() > 0);
  }
  for (const route of [`classroom/${custom.classroomId}`, `assignment/${custom.assignmentId}`, `evaluation/group/${custom.assignmentId}`, `evaluation/individual/${custom.assignmentId}`, `score/${custom.assignmentId}`]) {
    await student.goto(`${base}/demo/student/${route}`);
    check(`student mobile ${route}`, await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (route.startsWith("evaluation/individual/")) {
      await student.screenshot({ path: join(screenshots, "evaluation.png"), fullPage: false });
      await student.locator('.evaluation-pair').first().locator('input[value="2"]').check();
      check("mobile rating control responds to touch-sized viewport", await student.locator('.evaluation-pair').first().locator('input[value="2"]').isChecked());
      await student.locator('.sidebar a').last().click();
      await student.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
      check("mobile sidebar opens My Score", await student.getByRole("heading", { name: "คะแนนของฉัน" }).isVisible());
    }
    if (route.startsWith("score/")) await student.screenshot({ path: join(screenshots, "score.png"), fullPage: true });
  }
  const deniedPage = await student.goto(`${base}/demo/instructor/report/${custom.assignmentId}`);
  check("student cannot open instructor report page", deniedPage.status() === 200 && new URL(student.url()).pathname === "/");
  const deniedAssignment = await studentContext.request.get(`${base}/api/assignments/class-infeasible-assignment/scores`);
  check("student cannot read another classroom score API", deniedAssignment.status() === 403);
  const invalidLogin = await studentContext.request.post(`${base}/api/demo/session`, { form: { role: "student", userId: "instructor-01" }, maxRedirects: 0 });
  check("session rejects instructor identity as student", invalidLogin.status() === 400);
  console.log(`Day 6 UI audit: ${passed} passed, 0 failed. Mobile screenshots: ${screenshots}`);
  await instructorContext.close();
  await studentContext.close();
} finally { await browser.close(); db.close(); }
