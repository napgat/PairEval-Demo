import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"));
const browser = await chromium.launch({ headless: true });
let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); }
async function mobileFits(page, name) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  check(name, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1280, height: 900 });
}
async function login(page, role, userId) {
  await page.goto(base);
  if (role === "student" && userId) await page.locator('select[name="userId"]').selectOption(userId);
  await page.getByRole("button", { name: role === "student" ? /เข้า Demo นักศึกษา/ : /เข้า Demo ผู้สอน/ }).click();
  await page.getByRole("heading", { name: "ห้องเรียน" }).waitFor();
}
const count = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

try {
  check("fresh seed has no pairing or submissions", count("pair_assignments") === 0 && count("submission_revisions") === 0 && count("submission_answers") === 0);
  const instructorContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const instructor = await instructorContext.newPage();
  await login(instructor, "instructor");
  await instructor.getByRole("link", { name: /สร้างห้อง \+ CSV/ }).click();
  const classroomName = "ห้อง Main Flow วันที่ 6";
  await instructor.getByLabel("ชื่อห้องเรียน").fill(classroomName);
  await instructor.getByLabel("หรือวาง CSV ที่นี่").fill("email,groupname\nwrong@demo.invalid,Orion\nwrong@demo.invalid,Nova");
  await instructor.getByRole("button", { name: "ตรวจตัวอย่าง CSV" }).click();
  await instructor.locator(".error-box[role=alert]").getByText(/ซ้ำ/).waitFor();
  check("invalid CSV shows actionable error", await instructor.locator(".error-box[role=alert]").isVisible());
  const csv = ["email,groupname", ...Array.from({ length: 21 }, (_, n) => `${n === 0 ? "student-01" : `day6-${String(n + 1).padStart(2, "0")}`}@demo.invalid,${["Orion", "Nova", "Atlas"][Math.floor(n / 7)]}`)].join("\n");
  await instructor.getByLabel("หรือวาง CSV ที่นี่").fill(csv);
  await instructor.getByRole("button", { name: "ตรวจตัวอย่าง CSV" }).click();
  await instructor.getByText(/ตัวอย่างผ่าน: 21 คน \/ 3 กลุ่ม/).waitFor();
  await instructor.getByRole("button", { name: "สร้างห้องและนำเข้ารายชื่อ" }).click();
  await instructor.waitForURL(/\/demo\/instructor\/classroom\//);
  const classroomId = instructor.url().split("/").at(-1);
  check("instructor creates 21-student classroom", !!classroomId && db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE classroom_id = ?").get(classroomId).n === 21);
  await instructor.getByRole("link", { name: "+ สร้างงาน" }).click();
  await instructor.getByLabel("ชื่องาน").fill("งาน Main Flow วันที่ 6");
  await instructor.locator(".criteria-list").first().getByRole("button", { name: "เพิ่มเกณฑ์" }).click();
  const groupCriteria = instructor.locator(".criteria-list").first().locator(".criteria-row");
  await groupCriteria.nth(0).locator('input[type="number"]').fill("60");
  await groupCriteria.nth(1).locator("input").first().fill("การนำเสนอ");
  await groupCriteria.nth(1).locator('input[type="number"]').fill("30");
  await instructor.getByRole("button", { name: "สร้างงานประเมิน" }).click();
  await instructor.locator(".error-box[role=alert]").getByText(/100%/).waitFor();
  check("invalid criterion weight shows error", await instructor.locator(".error-box[role=alert]").isVisible());
  await groupCriteria.nth(1).locator('input[type="number"]').fill("40");
  await instructor.getByRole("button", { name: "สร้างงานประเมิน" }).click();
  await instructor.waitForURL(/\/demo\/instructor\/assignment\//);
  const assignmentId = instructor.url().split("/").at(-1);
  check("instructor creates weighted assignment", !!assignmentId && db.prepare("SELECT COUNT(*) AS n FROM criteria WHERE assignment_id = ?").get(assignmentId).n === 3);

  const emptyContext = await browser.newContext();
  const emptyStudent = await emptyContext.newPage();
  await login(emptyStudent, "student", "student-01");
  await emptyStudent.goto(`${base}/demo/student/evaluation/group/${assignmentId}`);
  await emptyStudent.getByRole("heading", { name: "ยังไม่มีคู่ที่ได้รับมอบหมาย" }).waitFor();
  check("empty evaluation tells student to wait for pairing", await emptyStudent.getByText(/ผู้สอนต้องสร้างคู่/).isVisible());
  await emptyContext.close();

  await instructor.getByRole("link", { name: "ตรวจและสร้างคู่" }).click();
  await instructor.getByText("พร้อมสร้างคู่", { exact: true }).waitFor();
  await instructor.getByRole("button", { name: "บันทึกคู่ทั้งหมดของงาน" }).click();
  await instructor.getByText("สร้างคู่ครบแล้ว", { exact: true }).waitFor();
  check("pairing saves all 345 assignments atomically", db.prepare("SELECT COUNT(*) AS n FROM pair_assignments WHERE assignment_id = ?").get(assignmentId).n === 345);
  const evaluator = db.prepare(`SELECT p.evaluator_id AS id, SUM(CASE WHEN c.kind='group' THEN 1 ELSE 0 END) AS groupCount,
    SUM(CASE WHEN c.kind='individual' THEN 1 ELSE 0 END) AS individualCount
    FROM pair_assignments p JOIN criteria c ON c.id=p.criterion_id WHERE p.assignment_id=?
    GROUP BY p.evaluator_id HAVING groupCount >= 2 AND individualCount >= 2 ORDER BY p.evaluator_id LIMIT 1`).get(assignmentId);
  check("selected student has Group and Individual work", !!evaluator);
  const seeded = execFileSync(process.execPath, ["scripts/seed-answers.mjs", assignmentId, evaluator.id], { cwd: process.cwd(), encoding: "utf8" });
  check("other evaluators submit synthetic revisions", seeded.includes("Created") && db.prepare("SELECT COUNT(*) AS n FROM submission_revisions WHERE assignment_id = ?").get(assignmentId).n > 0);
  const instructorBefore = await (await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("peer submissions create calculable baselines", !instructorBefore.hasNoData && instructorBefore.groups.every(group => group.baseScore !== null));

  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const student = await studentContext.newPage();
  await login(student, "student", evaluator.id);
  await student.getByRole("link", { name: new RegExp(classroomName) }).click();
  await student.getByRole("link", { name: /งาน Main Flow วันที่ 6/ }).click();
  await student.getByRole("heading", { name: "งาน Main Flow วันที่ 6" }).waitFor();
  check("student opens assignment in newly created classroom", student.url().endsWith(assignmentId));
  const ownBefore = await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("unsubmitted student scores are zero", ownBefore.score.groupScore === 0 && ownBefore.score.individualScore === 0);
  await student.goto(`${base}/demo/student/evaluation/group/${assignmentId}`);
  const groupPairs = student.locator(".evaluation-pair");
  await groupPairs.first().locator('input[value="1"]').check();
  await student.getByRole("button", { name: "Save draft" }).click();
  await student.getByRole("status").getByText(/บันทึกร่างแล้ว/).waitFor();
  await student.reload();
  check("Group draft survives refresh", await groupPairs.first().locator('input[value="1"]').isChecked());
  const afterDraft = await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("draft has no scoring effect", afterDraft.score.groupScore === 0);
  await student.getByRole("button", { name: "Submit", exact: true }).click();
  await student.getByText(/ส่งล่าสุด revision 1/).waitFor();
  const afterGroupSubmit = await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("Group Submit changes own score", afterGroupSubmit.score.groupScore > 0 && afterGroupSubmit.score.groupAnswered === 1);
  const reportAfterGroupSubmit = await (await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  await groupPairs.first().locator('input[value="6"]').check();
  await groupPairs.nth(1).locator('input[value="4"]').check();
  await student.getByRole("button", { name: "Re-submit" }).click();
  await student.getByText(/ส่งล่าสุด revision 2/).waitFor();
  const afterGroupResubmit = await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("Group Re-submit raises own completion score", afterGroupResubmit.score.groupAnswered === 2 && afterGroupResubmit.score.groupScore > afterGroupSubmit.score.groupScore);
  const reportAfterGroupResubmit = await (await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("Group Re-submit choice changes instructor report", JSON.stringify(reportAfterGroupResubmit.groups) !== JSON.stringify(reportAfterGroupSubmit.groups));
  await student.goto(`${base}/demo/student/evaluation/individual/${assignmentId}`);
  const individualPairs = student.locator(".evaluation-pair");
  await individualPairs.first().locator('input[value="3"]').check();
  await student.getByRole("button", { name: "Submit", exact: true }).click();
  await student.getByText(/ส่งล่าสุด revision 1/).waitFor();
  const afterIndividualSubmit = await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("Individual Submit changes total", afterIndividualSubmit.score.individualScore > 0 && afterIndividualSubmit.score.total > afterGroupResubmit.score.total);
  const reportAfterIndividualSubmit = await (await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  await individualPairs.first().locator('input[value="6"]').check();
  await individualPairs.nth(1).locator('input[value="4"]').check();
  await student.getByRole("button", { name: "Re-submit" }).click();
  await student.getByText(/ส่งล่าสุด revision 2/).waitFor();
  const afterIndividualResubmit = await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("Individual Re-submit changes own total", afterIndividualResubmit.score.individualAnswered === 2 && afterIndividualResubmit.score.total > afterIndividualSubmit.score.total);
  const reportAfterIndividualResubmit = await (await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("Individual Re-submit choice changes instructor report", JSON.stringify(reportAfterIndividualResubmit.items.filter(item => item.kind === "individual")) !== JSON.stringify(reportAfterIndividualSubmit.items.filter(item => item.kind === "individual")));
  check("old revisions remain stored", db.prepare("SELECT COUNT(*) AS n FROM submission_revisions WHERE assignment_id = ? AND evaluator_id = ?").get(assignmentId, evaluator.id).n === 4);
  await mobileFits(student, "Individual evaluation fits 390px viewport");

  await instructor.goto(`${base}/demo/instructor/report/${assignmentId}`);
  await instructor.getByRole("heading", { name: "รายงานผู้สอน" }).waitFor();
  const instructorAfter = await (await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("submitted answer choices change report scores", JSON.stringify(instructorAfter.groups) !== JSON.stringify(instructorBefore.groups));
  check("report shows per-pair coverage", await instructor.getByText("จำนวนคำตอบต่อคู่").isVisible());
  await mobileFits(instructor, "instructor report fits 390px viewport");
  await instructor.goto(`${base}/demo/instructor/export/${assignmentId}`);
  const downloadPromise = instructor.waitForEvent("download");
  await instructor.getByRole("link", { name: "ดาวน์โหลด CSV" }).click();
  const download = await downloadPromise;
  check("instructor downloads CSV", download.suggestedFilename().endsWith("-scores.csv"));
  const csvResponse = await instructorContext.request.get(`${base}/api/assignments/${assignmentId}/export`);
  const csvBody = await csvResponse.text();
  check("CSV has 21 student score rows", csvResponse.status() === 200 && csvBody.split("\r\n").length === 23 && csvBody.includes(evaluator.id));

  await student.goto(`${base}/demo/student/score/${assignmentId}`);
  await student.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
  check("My Score shows own computed total", (await student.locator(".score-cards").innerText()).includes(afterIndividualResubmit.score.total.toFixed(2)));
  const ownJson = JSON.stringify(await (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json());
  check("student API sends only own score", ownJson.includes(evaluator.id) && !ownJson.includes('"students"') && !ownJson.includes('"items"') && !ownJson.includes("evaluatorId"));
  check("student cannot export CSV", (await studentContext.request.get(`${base}/api/assignments/${assignmentId}/export`)).status() === 403);
  await mobileFits(student, "My Score fits 390px viewport");
  const peer = db.prepare("SELECT user_id AS id FROM memberships WHERE classroom_id = ? AND user_id <> ? LIMIT 1").get(classroomId, evaluator.id);
  const peerContext = await browser.newContext();
  const peerPage = await peerContext.newPage();
  await login(peerPage, "student", peer.id);
  const peerScore = await (await peerContext.request.get(`${base}/api/assignments/${assignmentId}/scores`)).json();
  check("another student sees only their own score", peerScore.score.id === peer.id && peerScore.score.id !== evaluator.id && !JSON.stringify(peerScore).includes(evaluator.id));
  await peerContext.close();
  console.log(`Observed scores: Group 0 -> ${afterGroupSubmit.score.groupScore.toFixed(4)} -> ${afterGroupResubmit.score.groupScore.toFixed(4)}; total after Individual Submit ${afterIndividualSubmit.score.total.toFixed(4)} -> Re-submit ${afterIndividualResubmit.score.total.toFixed(4)}.`);
  console.log(`Day 6 Main Flow: ${passed} passed, 0 failed. classroom=${classroomId} assignment=${assignmentId} evaluator=${evaluator.id}`);
  await instructorContext.close();
  await studentContext.close();
} finally { db.close(); await browser.close(); }
