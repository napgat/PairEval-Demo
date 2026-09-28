import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data");
const databasePath = join(dataDir, "demo.sqlite");
mkdirSync(dataDir, { recursive: true });
if (existsSync(databasePath)) unlinkSync(databasePath);

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('instructor', 'student'))
  );
  CREATE TABLE classrooms (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, demo_case TEXT NOT NULL
  );
  CREATE TABLE classroom_instructors (
    classroom_id TEXT NOT NULL REFERENCES classrooms(id),
    user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY (classroom_id, user_id)
  );
  CREATE TABLE demo_sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE groups (
    id TEXT PRIMARY KEY, classroom_id TEXT NOT NULL REFERENCES classrooms(id), name TEXT NOT NULL,
    UNIQUE (classroom_id, name)
  );
  CREATE TABLE memberships (
    classroom_id TEXT NOT NULL REFERENCES classrooms(id),
    group_id TEXT NOT NULL REFERENCES groups(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (classroom_id, user_id)
  );
  CREATE TABLE assignments (
    id TEXT PRIMARY KEY, classroom_id TEXT NOT NULL REFERENCES classrooms(id),
    name TEXT NOT NULL, group_max REAL NOT NULL, individual_max REAL NOT NULL,
    group_deadline TEXT NOT NULL, individual_deadline TEXT NOT NULL
  );
  CREATE TABLE criteria (
    id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
    kind TEXT NOT NULL CHECK (kind IN ('group', 'individual')),
    name TEXT NOT NULL, weight_percent REAL NOT NULL
  );
  CREATE TABLE pair_assignments (
    id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
    criterion_id TEXT NOT NULL REFERENCES criteria(id),
    evaluator_id TEXT NOT NULL REFERENCES users(id),
    item_a_id TEXT NOT NULL, item_b_id TEXT NOT NULL
  );
  CREATE UNIQUE INDEX pair_assignment_unique_evaluator
    ON pair_assignments (assignment_id, criterion_id, evaluator_id, item_a_id, item_b_id);
  CREATE TABLE evaluation_drafts (
    pair_assignment_id TEXT PRIMARY KEY REFERENCES pair_assignments(id),
    evaluator_id TEXT NOT NULL REFERENCES users(id), choice INTEGER CHECK (choice BETWEEN 1 AND 6),
    saved_at TEXT NOT NULL
  );
  CREATE TABLE submission_revisions (
    id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
    evaluator_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
    revision_number INTEGER NOT NULL, submitted_at TEXT NOT NULL,
    UNIQUE (assignment_id, evaluator_id, kind, revision_number)
  );
  CREATE TABLE submission_answers (
    revision_id TEXT NOT NULL REFERENCES submission_revisions(id),
    pair_assignment_id TEXT NOT NULL REFERENCES pair_assignments(id),
    choice INTEGER NOT NULL CHECK (choice BETWEEN 1 AND 6),
    PRIMARY KEY (revision_id, pair_assignment_id)
  );
`);

const insertUser = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)");
const insertClassroom = db.prepare("INSERT INTO classrooms VALUES (?, ?, ?)");
const insertInstructor = db.prepare("INSERT INTO classroom_instructors VALUES (?, ?)");
const insertGroup = db.prepare("INSERT INTO groups VALUES (?, ?, ?)");
const insertMembership = db.prepare("INSERT INTO memberships VALUES (?, ?, ?)");
const insertAssignment = db.prepare("INSERT INTO assignments VALUES (?, ?, ?, ?, ?, ?, ?)");
const insertCriterion = db.prepare("INSERT INTO criteria VALUES (?, ?, ?, ?, ?)");
let studentNumber = 0;

// Every identity and address below is synthetic. The .invalid TLD cannot deliver mail.
db.exec("BEGIN");
try {
  insertUser.run("instructor-01", "instructor@demo.invalid", "อาจารย์ตัวอย่าง", "instructor");
  const classrooms = [
    { id: "class-feasible", name: "PairEval Demo · ห้องที่จัดคู่ได้", kind: "feasible", groups: ["Orion", "Nova", "Atlas"], size: 7 },
    { id: "class-infeasible", name: "PairEval Demo · ห้องที่จัดคู่ไม่ได้", kind: "infeasible", groups: ["Alpha", "Beta"], size: 2 },
  ];
  for (const classroom of classrooms) {
    insertClassroom.run(classroom.id, classroom.name, classroom.kind);
    insertInstructor.run(classroom.id, "instructor-01");
    for (const [groupIndex, groupName] of classroom.groups.entries()) {
      const groupId = `${classroom.id}-group-${groupIndex + 1}`;
      insertGroup.run(groupId, classroom.id, groupName);
      for (let member = 0; member < classroom.size; member++) {
        studentNumber++;
        const userId = `student-${String(studentNumber).padStart(2, "0")}`;
        insertUser.run(userId, `${userId}@demo.invalid`, `นักศึกษาตัวอย่าง ${String(studentNumber).padStart(2, "0")}`, "student");
        insertMembership.run(classroom.id, groupId, userId);
      }
    }
    const assignmentId = `${classroom.id}-assignment`;
    insertAssignment.run(assignmentId, classroom.id, "ประเมินโครงงานตัวอย่าง", 15, 5, "2030-01-01T16:59:00.000Z", "2030-01-01T16:59:00.000Z");
    insertCriterion.run(`${assignmentId}-g1`, assignmentId, "group", "คุณภาพงาน", 60);
    insertCriterion.run(`${assignmentId}-g2`, assignmentId, "group", "การนำเสนอ", 40);
    insertCriterion.run(`${assignmentId}-i1`, assignmentId, "individual", "การทำงานร่วมกัน", 100);
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
console.log(`Seeded ${databasePath}: 2 classrooms, 5 groups, ${studentNumber} synthetic students, 2 assignments.`);
