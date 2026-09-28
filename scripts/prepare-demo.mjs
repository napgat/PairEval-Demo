import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const assignmentId = process.argv[2];
if (!assignmentId) throw new Error("ระบุ assignment ID จากท้าย URL ของหน้างาน: npm run demo:prepare -- <assignment-id>");
const db = new DatabaseSync(join(process.cwd(), "data", "demo.sqlite"), { readOnly: true });
const assignment = db.prepare("SELECT id, name FROM assignments WHERE id = ?").get(assignmentId);
if (!assignment) { db.close(); throw new Error("ไม่พบงานตาม assignment ID"); }
const evaluator = db.prepare(`SELECT users.id, users.email, users.display_name AS name,
  SUM(CASE WHEN criteria.kind = 'group' THEN 1 ELSE 0 END) AS groupCount,
  SUM(CASE WHEN criteria.kind = 'individual' THEN 1 ELSE 0 END) AS individualCount
  FROM pair_assignments JOIN criteria ON criteria.id = pair_assignments.criterion_id
  JOIN users ON users.id = pair_assignments.evaluator_id
  WHERE pair_assignments.assignment_id = ?
    AND NOT EXISTS (
      SELECT 1 FROM submission_revisions
      WHERE submission_revisions.assignment_id = pair_assignments.assignment_id
        AND submission_revisions.evaluator_id = pair_assignments.evaluator_id
    )
  GROUP BY users.id HAVING groupCount >= 2 AND individualCount >= 2
  ORDER BY users.email LIMIT 1`).get(assignmentId);
db.close();
if (!evaluator) throw new Error("ยังไม่มีคู่ครบ หรือไม่มีนักศึกษาที่ยังไม่ส่งและได้รับ Group/Individual อย่างน้อยอย่างละ 2 คู่");
const output = execFileSync(process.execPath, ["scripts/seed-answers.mjs", assignmentId, evaluator.id], { cwd: process.cwd(), encoding: "utf8" });
console.log(output.trim());
console.log(`Demo student: ${evaluator.email} (${evaluator.name})`);
console.log(`Assigned: Group ${evaluator.groupCount}, Individual ${evaluator.individualCount}`);
console.log(`Open: /demo/student/assignment/${assignmentId}`);
