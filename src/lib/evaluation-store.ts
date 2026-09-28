import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type EvaluationKind = "group" | "individual";
export type EvaluationPair = {
  id: string; criterionId: string; criterionName: string;
  itemAId: string; itemBId: string; itemAName: string; itemBName: string;
};
export type EvaluationView = {
  assignmentId: string; assignmentName: string; kind: EvaluationKind;
  deadline: string; serverNow: string; pairs: EvaluationPair[];
  isClosed: boolean;
  answers: Record<string, number | null>;
  draftSavedAt: string | null; latestSubmittedAt: string | null;
  revisionNumber: number; answeredCount: number; totalCount: number;
};
export type EvaluationWriteResult = { status: number; error?: string; view?: EvaluationView };

type Context = {
  assignmentId: string; assignmentName: string; classroomId: string;
  deadline: string; pairs: EvaluationPair[];
};

function loadContext(db: DatabaseSync, assignmentId: string, kind: EvaluationKind, evaluatorId: string): Context | null {
  const assignment = db.prepare(`
    SELECT assignments.id, assignments.name, assignments.classroom_id AS classroomId,
      assignments.group_deadline AS groupDeadline, assignments.individual_deadline AS individualDeadline
    FROM assignments JOIN memberships ON memberships.classroom_id = assignments.classroom_id
    WHERE assignments.id = ? AND memberships.user_id = ?
  `).get(assignmentId, evaluatorId) as { id: string; name: string; classroomId: string; groupDeadline: string; individualDeadline: string } | undefined;
  if (!assignment) return null;
  const rows = db.prepare(`
    SELECT pair_assignments.id, pair_assignments.criterion_id AS criterionId,
      criteria.name AS criterionName, pair_assignments.item_a_id AS itemAId,
      pair_assignments.item_b_id AS itemBId
    FROM pair_assignments JOIN criteria ON criteria.id = pair_assignments.criterion_id
    WHERE pair_assignments.assignment_id = ? AND pair_assignments.evaluator_id = ? AND criteria.kind = ?
    ORDER BY criteria.id, pair_assignments.id
  `).all(assignmentId, evaluatorId, kind) as Omit<EvaluationPair, "itemAName" | "itemBName">[];
  const nameQuery = kind === "group"
    ? db.prepare("SELECT name FROM groups WHERE id = ? AND classroom_id = ?")
    : db.prepare("SELECT display_name AS name FROM users WHERE id = ?");
  const pairs = rows.map(row => ({ ...row,
    itemAName: (nameQuery.get(row.itemAId, ...(kind === "group" ? [assignment.classroomId] : [])) as { name: string } | undefined)?.name ?? "ไม่พบชื่อ",
    itemBName: (nameQuery.get(row.itemBId, ...(kind === "group" ? [assignment.classroomId] : [])) as { name: string } | undefined)?.name ?? "ไม่พบชื่อ",
  }));
  return { assignmentId, assignmentName: assignment.name, classroomId: assignment.classroomId,
    deadline: kind === "group" ? assignment.groupDeadline : assignment.individualDeadline, pairs };
}

export function getEvaluationView(db: DatabaseSync, assignmentId: string, kind: EvaluationKind, evaluatorId: string): EvaluationView | null {
  const context = loadContext(db, assignmentId, kind, evaluatorId);
  if (!context) return null;
  const latest = db.prepare(`
    SELECT id, revision_number AS revisionNumber, submitted_at AS submittedAt
    FROM submission_revisions WHERE assignment_id = ? AND evaluator_id = ? AND kind = ?
    ORDER BY revision_number DESC LIMIT 1
  `).get(assignmentId, evaluatorId, kind) as { id: string; revisionNumber: number; submittedAt: string } | undefined;
  const latestAnswers = latest ? db.prepare("SELECT pair_assignment_id AS pairId, choice FROM submission_answers WHERE revision_id = ?").all(latest.id) as { pairId: string; choice: number }[] : [];
  const drafts = db.prepare(`
    SELECT evaluation_drafts.pair_assignment_id AS pairId, evaluation_drafts.choice,
      evaluation_drafts.saved_at AS savedAt
    FROM evaluation_drafts JOIN pair_assignments ON pair_assignments.id = evaluation_drafts.pair_assignment_id
    JOIN criteria ON criteria.id = pair_assignments.criterion_id
    WHERE pair_assignments.assignment_id = ? AND evaluation_drafts.evaluator_id = ? AND criteria.kind = ?
  `).all(assignmentId, evaluatorId, kind) as { pairId: string; choice: number | null; savedAt: string }[];
  const answers: Record<string, number | null> = Object.fromEntries(context.pairs.map(pair => [pair.id, null]));
  for (const answer of drafts.length ? drafts : latestAnswers) {
    if (Object.hasOwn(answers, answer.pairId)) answers[answer.pairId] = answer.choice;
  }
  const serverNow = new Date().toISOString();
  return { assignmentId, assignmentName: context.assignmentName, kind, deadline: context.deadline,
    serverNow, isClosed: Date.parse(serverNow) >= Date.parse(context.deadline), pairs: context.pairs, answers,
    draftSavedAt: drafts.length ? drafts[0].savedAt : null,
    latestSubmittedAt: latest?.submittedAt ?? null, revisionNumber: latest?.revisionNumber ?? 0,
    answeredCount: Object.values(answers).filter(choice => choice !== null).length, totalCount: context.pairs.length };
}

function validatedAnswers(raw: unknown, pairs: EvaluationPair[]): { answers?: Record<string, number | null>; status: number; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { status: 422, error: "รูปแบบคำตอบไม่ถูกต้อง" };
  const answers = raw as Record<string, unknown>;
  const allowed = new Set(pairs.map(pair => pair.id));
  const keys = Object.keys(answers);
  if (keys.some(key => !allowed.has(key))) return { status: 403, error: "มีคู่ที่ไม่ได้รับมอบหมายหรือเป็นของผู้อื่น" };
  if (keys.length !== pairs.length) return { status: 422, error: "ต้องส่งสถานะคำตอบของทุกคู่ที่ได้รับมอบหมาย" };
  for (const [pairId, choice] of Object.entries(answers)) {
    if (choice !== null && (!Number.isInteger(choice) || Number(choice) < 1 || Number(choice) > 6)) {
      return { status: 422, error: `คำตอบของคู่ ${pairId} ต้องเป็น 1–6 หรือเว้นว่าง` };
    }
  }
  return { status: 200, answers: answers as Record<string, number | null> };
}

export function writeEvaluation(db: DatabaseSync, assignmentId: string, kind: EvaluationKind, evaluatorId: string, rawAnswers: unknown, action: "draft" | "submit"): EvaluationWriteResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const context = loadContext(db, assignmentId, kind, evaluatorId);
    if (!context) { db.exec("ROLLBACK"); return { status: 403, error: "ไม่มีสิทธิ์เข้าถึงงานนี้" }; }
    if (Date.now() >= Date.parse(context.deadline)) { db.exec("ROLLBACK"); return { status: 409, error: "เลยกำหนดส่งแล้ว บันทึกหรือส่งคำตอบไม่ได้" }; }
    if (!context.pairs.length) { db.exec("ROLLBACK"); return { status: 409, error: "ยังไม่มีคู่ที่ได้รับมอบหมาย" }; }
    const validated = validatedAnswers(rawAnswers, context.pairs);
    if (!validated.answers) { db.exec("ROLLBACK"); return { status: validated.status, error: validated.error }; }
    const answers = validated.answers;
    if (action === "submit" && !Object.values(answers).some(choice => choice !== null)) {
      db.exec("ROLLBACK"); return { status: 422, error: "ต้องตอบอย่างน้อย 1 คู่ก่อน Submit" };
    }
    const now = new Date().toISOString();
    const deleteDrafts = db.prepare(`
      DELETE FROM evaluation_drafts WHERE evaluator_id = ? AND pair_assignment_id IN (
        SELECT pair_assignments.id FROM pair_assignments JOIN criteria ON criteria.id = pair_assignments.criterion_id
        WHERE pair_assignments.assignment_id = ? AND pair_assignments.evaluator_id = ? AND criteria.kind = ?
      )
    `);
    if (action === "draft") {
      deleteDrafts.run(evaluatorId, assignmentId, evaluatorId, kind);
      const insertDraft = db.prepare("INSERT INTO evaluation_drafts VALUES (?, ?, ?, ?)");
      for (const pair of context.pairs) insertDraft.run(pair.id, evaluatorId, answers[pair.id], now);
    } else {
      const last = db.prepare("SELECT COALESCE(MAX(revision_number), 0) AS number FROM submission_revisions WHERE assignment_id = ? AND evaluator_id = ? AND kind = ?").get(assignmentId, evaluatorId, kind) as { number: number };
      const revisionId = randomUUID();
      db.prepare("INSERT INTO submission_revisions VALUES (?, ?, ?, ?, ?, ?)").run(revisionId, assignmentId, evaluatorId, kind, last.number + 1, now);
      const insertAnswer = db.prepare("INSERT INTO submission_answers VALUES (?, ?, ?)");
      for (const pair of context.pairs) if (answers[pair.id] !== null) insertAnswer.run(revisionId, pair.id, answers[pair.id]);
      deleteDrafts.run(evaluatorId, assignmentId, evaluatorId, kind);
    }
    db.exec("COMMIT");
    return { status: 200, view: getEvaluationView(db, assignmentId, kind, evaluatorId)! };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
