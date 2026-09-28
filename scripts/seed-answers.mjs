import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"));
db.exec("PRAGMA foreign_keys = ON");
const assignmentId = process.argv[2] ?? "class-feasible-assignment";
const demoStudentId = process.argv[3] ?? "student-01";
const assignment = db.prepare("SELECT classroom_id AS classroomId FROM assignments WHERE id = ?").get(assignmentId);
if (!assignment || !db.prepare("SELECT 1 FROM memberships WHERE classroom_id = ? AND user_id = ?").get(assignment.classroomId, demoStudentId)) {
  db.close(); throw new Error("ไม่พบงานหรือบัญชีนักศึกษาที่จะเว้นไว้ให้ประเมินเอง");
}
const pairRows = db.prepare(`SELECT pair_assignments.id, pair_assignments.evaluator_id AS evaluatorId, criteria.kind,
  pair_assignments.item_a_id AS itemAId, pair_assignments.item_b_id AS itemBId
  FROM pair_assignments JOIN criteria ON criteria.id = pair_assignments.criterion_id
  WHERE pair_assignments.assignment_id = ? AND pair_assignments.evaluator_id <> ?
  ORDER BY pair_assignments.evaluator_id, criteria.kind, pair_assignments.id`).all(assignmentId, demoStudentId);
if (!pairRows.length) { db.close(); throw new Error("ยังไม่มีคู่สำหรับงานนี้: ให้ผู้สอนกดสร้างคู่ก่อนรัน npm run demo:answers"); }
const groups = new Map();
for (const pair of pairRows) {
  const key = `${pair.evaluatorId}/${pair.kind}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(pair);
}
const existing = db.prepare("SELECT 1 FROM submission_revisions WHERE assignment_id = ? AND evaluator_id = ? AND kind = ? LIMIT 1");
const insertRevision = db.prepare("INSERT INTO submission_revisions VALUES (?, ?, ?, ?, ?, ?)");
const insertAnswer = db.prepare("INSERT INTO submission_answers VALUES (?, ?, ?)");
let created = 0, answers = 0;
db.exec("BEGIN IMMEDIATE");
try {
  for (const [key, pairs] of groups) {
    const [evaluatorId, kind] = key.split("/");
    if (existing.get(assignmentId, evaluatorId, kind)) continue;
    const revisionId = randomUUID();
    insertRevision.run(revisionId, assignmentId, evaluatorId, kind, 1, new Date().toISOString());
    for (const pair of pairs) {
      const digits = `${pair.evaluatorId}/${pair.itemAId}/${pair.itemBId}`;
      const sum = [...digits].reduce((n, c) => n + c.charCodeAt(0), 0);
      insertAnswer.run(revisionId, pair.id, sum % 6 + 1);
      answers++;
    }
    created++;
  }
  db.exec("COMMIT");
} catch (error) { db.exec("ROLLBACK"); throw error; } finally { db.close(); }
console.log(`Created ${created} synthetic submitted revisions and ${answers} answers from other evaluators. Existing submissions were preserved.`);
