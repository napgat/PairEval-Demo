import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";
import { calculateItemScores, mappedScore, participation, type ScoreAnswer, type ScoreItem,
  type ScorePair, type ScoreSettings } from "./full-system-scoring";

const validId = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
type AssignmentRow = { id: string; classroom_id: string; generation: number; status: string;
  slug: string; classroom_slug: string;
  group_max_score: string; individual_max_score: string; score_floor: string; score_ceiling: string;
  min_comparisons: number; completion_threshold: string; scoring_formula_version: string;
  allowed_email_domains: string[]; group_deadline_utc: Date | null; individual_deadline_utc: Date | null };
type StudentRow = { id: string; group_id: string; display_name: string };
type CriterionRow = { id: string; side: "GROUP" | "INDIVIDUAL"; name: string; weight_pct: string };
type OverrideRow = { side: "GROUP" | "INDIVIDUAL"; item_id: string; override_value: string;
  reason: string; id: string };
export type ScoreRun = { assignmentId: string; generation: number; kind: "INTERIM" | "FINAL";
  formulaVersion: string; settings: ScoreSettings; maxScore: number;
  groups: Array<{ id: string; name: string; component: number | null;
    criteria: Array<ScoreItem["criteria"][number] & { name: string; weightedScore: number | null }>;
    flags: string[] }>;
  students: Array<{ id: string; groupId: string; displayName: string; groupComponent: number | null;
    individualComponent: number | null; total: number | null; answered: number; assigned: number;
    p: number; M: number; flags: string[];
    criteria: Array<ScoreItem["criteria"][number] & { name: string; weightedScore: number | null }> }>;
  pairCoverage: Array<{ pairId: string; side: string; criterionId: string; answered: boolean }>;
  overrides: Array<{ side: string; itemId: string; value: number; reason: string }> };

async function editorScope(client: PoolClient, actor: FullActor, assignmentId: string,
    lock = false): Promise<AssignmentRow> {
  if (!validId(assignmentId)) throw new AssignmentInputError("Invalid assignment ID");
  const result = await client.query<AssignmentRow>(`SELECT a.*,c.allowed_email_domains,
    c.slug AS classroom_slug
    FROM assignment a JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=c.id
    WHERE a.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.membership_status='ACTIVE'
      AND m.role IN ('OWNER','CO_TEACHER') ${lock ? "FOR UPDATE OF a" : ""}`,
  [assignmentId, actor.id]);
  const row = result.rows[0];
  if (!row || !domainAllowed(actor.hostedDomain, row.allowed_email_domains)) {
    throw new AssignmentNotFoundError("Assignment not found");
  }
  if (row.generation < 1 || row.status === "DRAFT" || row.status === "ARCHIVED") {
    throw new AssignmentConflictError("Assignment is not published");
  }
  return row;
}

const four = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;
export function assembleScoreRun(input: { assignmentId: string; generation: number;
  kind: "INTERIM" | "FINAL"; formulaVersion: string; settings: ScoreSettings;
  groups: Array<{ id: string; name: string }>; students: StudentRow[];
  criteria: CriterionRow[]; pairs: ScorePair[]; answers: ScoreAnswer[]; overrides: OverrideRow[] }): ScoreRun {
  const items = calculateItemScores({ criteria: input.criteria.map(c => ({ id: c.id, side: c.side,
    weightPct: Number(c.weight_pct) })), pairs: input.pairs, answers: input.answers,
    groupIds: input.groups.map(g => g.id), studentIds: input.students.map(s => s.id), settings: input.settings });
  const overrides = new Map<string, OverrideRow>();
  for (const row of input.overrides) {
    const key = `${row.side}:${row.item_id}`;
    if (!overrides.has(key)) overrides.set(key, row);
  }
  const item = (side: "GROUP" | "INDIVIDUAL", id: string) =>
    items.find(value => value.side === side && value.itemId === id);
  const details = (value: ScoreItem | undefined, side: "GROUP" | "INDIVIDUAL") =>
    value?.criteria.map(c => {
      const config = input.criteria.find(row => row.id === c.criterionId)!;
      return { ...c, name: config.name, weightedScore: c.q === null ? null :
        four(mappedScore(c.q, Number(config.weight_pct),
          side === "GROUP" ? input.settings.groupMax : input.settings.individualMax,
          input.settings.floor, input.settings.ceiling)) };
    }) ?? [];
  const component = (side: "GROUP" | "INDIVIDUAL", id: string) => {
    const override = overrides.get(`${side}:${id}`);
    return override ? Number(override.override_value) : item(side, id)?.component ?? null;
  };
  const groups = input.groups.map(group => {
    const value = item("GROUP", group.id);
    return { id: group.id, name: group.name, component: component("GROUP", group.id),
      criteria: details(value, "GROUP"), flags: [
        ...(value?.criteria.some(c => c.lowConfidence) ? ["LOW_CONFIDENCE"] : []),
        ...(overrides.has(`GROUP:${group.id}`) ? ["OVERRIDDEN"] : []),
        ...(value?.component === null ? ["NO_DATA"] : [])] };
  });
  const assigned = new Map<string, number>(); const answered = new Map<string, number>();
  for (const pair of input.pairs) assigned.set(pair.evaluatorId, (assigned.get(pair.evaluatorId) ?? 0) + 1);
  for (const answer of input.answers) answered.set(answer.evaluatorId, (answered.get(answer.evaluatorId) ?? 0) + 1);
  const students = input.students.map(student => {
    const individual = item("INDIVIDUAL", student.id);
    const groupComponent = component("GROUP", student.group_id);
    const individualComponent = input.settings.individualMax === 0 ? 0 : component("INDIVIDUAL", student.id);
    const counts = participation(answered.get(student.id) ?? 0, assigned.get(student.id) ?? 0,
      input.settings.completionThreshold);
    const total = groupComponent === null || individualComponent === null ? null :
      four((groupComponent + individualComponent) * counts.M);
    return { id: student.id, groupId: student.group_id, displayName: student.display_name,
      groupComponent, individualComponent, total, answered: answered.get(student.id) ?? 0,
      assigned: assigned.get(student.id) ?? 0, p: counts.p, M: counts.M,
      criteria: details(individual, "INDIVIDUAL"), flags: [
        ...(individual?.criteria.some(c => c.lowConfidence) ? ["LOW_CONFIDENCE"] : []),
        ...(individual && !individual.anonymous ? ["BELOW_K"] : []),
        ...(overrides.has(`INDIVIDUAL:${student.id}`) ? ["OVERRIDDEN"] : []),
        ...(total === null ? ["NO_DATA"] : [])] };
  });
  const answeredIds = new Set(input.answers.map(a => a.pairId));
  return { assignmentId: input.assignmentId, generation: input.generation, kind: input.kind,
    formulaVersion: input.formulaVersion, settings: input.settings,
    maxScore: input.settings.groupMax + input.settings.individualMax,
    groups, students,
    pairCoverage: input.pairs.map(p => ({ pairId: p.id, side: p.side, criterionId: p.criterionId,
      answered: answeredIds.has(p.id) })),
    overrides: [...overrides.values()].map(row => ({ side: row.side, itemId: row.item_id,
      value: Number(row.override_value), reason: row.reason })) };
}

async function scoreInputs(client: PoolClient, a: AssignmentRow, kind: "INTERIM" | "FINAL") {
  const groups = await client.query<{ id: string; name: string }>(
    "SELECT id,name FROM group_entity WHERE classroom_id=$1 ORDER BY id", [a.classroom_id]);
  const students = await client.query<StudentRow>(`SELECT m.user_id AS id,m.group_id,u.display_name
    FROM classroom_member m JOIN app_user u ON u.id=m.user_id
    WHERE m.classroom_id=$1 AND m.role='STUDENT' AND m.membership_status='ACTIVE' ORDER BY m.user_id`,
  [a.classroom_id]);
  const criteria = await client.query<CriterionRow>(`SELECT id,side,name,weight_pct FROM criterion
    WHERE assignment_id=$1 AND active ORDER BY id`, [a.id]);
  const pairRows = await client.query(`SELECT id,criterion_id,side,group_a_id,group_b_id,student_a_id,
    student_b_id,display_left,evaluator_user_id FROM pair_assignment
    WHERE assignment_id=$1 AND generation=$2 ORDER BY id`, [a.id, a.generation]);
  const answerRows = await client.query(`SELECT sa.pair_assignment_id,sa.choice,sr.evaluator_user_id
    FROM (SELECT DISTINCT ON (evaluator_user_id,side) id,evaluator_user_id,side
      FROM submission_revision WHERE assignment_id=$1 AND generation=$2
      ORDER BY evaluator_user_id,side,revision_number DESC) sr
    JOIN submission_answer sa ON sa.revision_id=sr.id
    JOIN pair_assignment p ON p.id=sa.pair_assignment_id
    WHERE p.assignment_id=$1 AND p.generation=$2 AND p.evaluator_user_id=sr.evaluator_user_id
      AND p.side=sr.side ORDER BY sa.pair_assignment_id`, [a.id, a.generation]);
  const overrideRows = await client.query<OverrideRow>(`SELECT id,side,item_id,override_value,reason
    FROM score_override WHERE assignment_id=$1 AND generation=$2
    ORDER BY created_at DESC,id DESC`, [a.id, a.generation]);
  const pairs: ScorePair[] = pairRows.rows.map(p => ({ id: p.id, criterionId: p.criterion_id,
    side: p.side, aId: p.side === "GROUP" ? p.group_a_id : p.student_a_id,
    bId: p.side === "GROUP" ? p.group_b_id : p.student_b_id,
    displayLeft: p.display_left, evaluatorId: p.evaluator_user_id }));
  const answers: ScoreAnswer[] = answerRows.rows.map(row => ({ pairId: row.pair_assignment_id,
    choice: row.choice, evaluatorId: row.evaluator_user_id, weight: 1 }));
  const settings: ScoreSettings = { groupMax: Number(a.group_max_score),
    individualMax: Number(a.individual_max_score), floor: Number(a.score_floor),
    ceiling: Number(a.score_ceiling), minComparisons: a.min_comparisons,
    kMin: 3, completionThreshold: Number(a.completion_threshold) };
  const source = { groups: groups.rows, students: students.rows, criteria: criteria.rows, pairs, answers,
    overrides: overrideRows.rows };
  const output = assembleScoreRun({ assignmentId: a.id, generation: a.generation, kind,
    formulaVersion: a.scoring_formula_version, settings, ...source });
  return { source, settings, output };
}

export async function createScoreRun(actor: FullActor, assignmentId: string, kind: "INTERIM" | "FINAL") {
  if (kind !== "INTERIM" && kind !== "FINAL") throw new AssignmentInputError("Invalid score run kind");
  return runAuditedMutation({
    prepare: async client => {
      const a = await editorScope(client, actor, assignmentId, true);
      if (a.status === "FINALIZED") throw new AssignmentConflictError("Reopen before recalculating scores");
      if (kind === "FINAL") {
        const time = await client.query<{ open: boolean }>(`SELECT
          ($1::timestamptz > clock_timestamp() OR $2::timestamptz > clock_timestamp()) AS open`,
        [a.group_deadline_utc, a.individual_deadline_utc]);
        if (time.rows[0].open) throw new AssignmentConflictError("Wait until both deadlines have passed");
      }
      return a;
    },
    intent: a => ({ actorUserId: actor.id, classroomId: a.classroom_id,
      action: kind === "FINAL" ? "SCORE_FINALIZE_REQUESTED" : "SCORE_RECOMPUTE_REQUESTED",
      resourceType: "assignment", resourceId: assignmentId,
      before: { status: a.status, generation: a.generation } }),
    mutate: async (client, a) => {
      const { source, settings, output } = await scoreInputs(client, a, kind);
      const input = { generation: a.generation, ...source };
      const inputHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const number = await client.query<{ next: number }>(`SELECT COALESCE(max(snapshot_no),0)::integer+1 AS next
        FROM score_snapshot WHERE assignment_id=$1`, [assignmentId]);
      const snapshotId = randomUUID();
      await client.query(`INSERT INTO score_snapshot
        (id,assignment_id,generation,snapshot_no,kind,formula_version,config_json,input_json,input_hash,
          output_json,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [snapshotId, assignmentId, a.generation, number.rows[0].next, kind, a.scoring_formula_version,
        settings, input, inputHash, output, actor.id]);
      for (const entry of [...output.groups.map(row => ({ ...row, side: "GROUP" as const })),
        ...output.students.map(row => ({ ...row, side: "INDIVIDUAL" as const }))]) {
        for (const criterion of entry.criteria) {
          await client.query(`INSERT INTO score_snapshot_item
            (id,score_snapshot_id,criterion_id,side,item_id,comparison_count,quality_index,
              weighted_score,flags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [randomUUID(), snapshotId, criterion.criterionId, entry.side, entry.id,
            criterion.comparisons, criterion.q, criterion.weightedScore,
            criterion.lowConfidence ? ["LOW_CONFIDENCE"] : []]);
        }
      }
      if (kind === "FINAL") await client.query(`UPDATE assignment SET status='FINALIZED',finalized_at=now()
        WHERE id=$1`, [assignmentId]);
      return { id: snapshotId, snapshotNo: number.rows[0].next, kind, inputHash, output };
    },
    committedAfter: result => ({ snapshotId: result.id, snapshotNo: result.snapshotNo,
      kind: result.kind, inputHash: result.inputHash }),
  });
}

export async function latestScoreRun(actor: FullActor, assignmentId: string) {
  const client = await databasePool().connect();
  try {
    const assignment = await editorScope(client, actor, assignmentId);
    const result = await client.query<{ id: string; snapshot_no: number; kind: string;
      input_hash: string; created_at: Date; output_json: ScoreRun }>(`SELECT id,snapshot_no,kind,
      input_hash,created_at,output_json FROM score_snapshot WHERE assignment_id=$1 AND generation=$2
      ORDER BY snapshot_no DESC LIMIT 1`, [assignmentId, assignment.generation]);
    return result.rows[0] ? { id: result.rows[0].id, assignmentStatus: assignment.status,
      classroomSlug: assignment.classroom_slug, assignmentSlug: assignment.slug,
      snapshotNo: result.rows[0].snapshot_no,
      kind: result.rows[0].kind, inputHash: result.rows[0].input_hash,
      createdAt: result.rows[0].created_at.toISOString(), output: result.rows[0].output_json } : null;
  } finally { client.release(); }
}

export async function reopenScore(actor: FullActor, assignmentId: string, reason: string) {
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.length > 2000) {
    throw new AssignmentInputError("Reopen reason must have 10–2000 characters");
  }
  return runAuditedMutation({
    prepare: async client => {
      const a = await editorScope(client, actor, assignmentId, true);
      if (a.status !== "FINALIZED") throw new AssignmentConflictError("Assignment is not finalized");
      return a;
    },
    intent: a => ({ actorUserId: actor.id, classroomId: a.classroom_id,
      action: "SCORE_REOPEN_REQUESTED", resourceType: "assignment", resourceId: assignmentId,
      before: { status: a.status, generation: a.generation }, reason: reason.trim() }),
    mutate: async client => {
      await client.query("UPDATE assignment SET status='CLOSED',finalized_at=NULL WHERE id=$1", [assignmentId]);
      return { status: "CLOSED" as const };
    },
    committedAfter: result => result,
  });
}

export async function overrideScore(actor: FullActor, assignmentId: string, side: string,
    itemId: string, value: number, reason: string) {
  if (!["GROUP", "INDIVIDUAL"].includes(side) || !validId(itemId) || !Number.isFinite(value) ||
      value < 0 || typeof reason !== "string" || reason.trim().length < 10 || reason.length > 2000) {
    throw new AssignmentInputError("Invalid score override");
  }
  return runAuditedMutation({
    prepare: async client => {
      const a = await editorScope(client, actor, assignmentId, true);
      if (a.status === "FINALIZED") throw new AssignmentConflictError("Reopen before overriding scores");
      const max = Number(side === "GROUP" ? a.group_max_score : a.individual_max_score);
      if (value > max) throw new AssignmentInputError("Override exceeds side maximum");
      const exists = side === "GROUP" ?
        await client.query("SELECT 1 FROM group_entity WHERE id=$1 AND classroom_id=$2", [itemId, a.classroom_id]) :
        await client.query(`SELECT 1 FROM classroom_member WHERE user_id=$1 AND classroom_id=$2
          AND role='STUDENT' AND membership_status='ACTIVE'`, [itemId, a.classroom_id]);
      if (!exists.rowCount) throw new AssignmentNotFoundError("Score item not found");
      return a;
    },
    intent: a => ({ actorUserId: actor.id, classroomId: a.classroom_id,
      action: "SCORE_OVERRIDE_REQUESTED", resourceType: side.toLowerCase(), resourceId: itemId,
      after: { assignmentId, value }, reason: reason.trim() }),
    mutate: async (client, a) => {
      const current = await scoreInputs(client, a, "INTERIM");
      const item = side === "GROUP" ? current.output.groups.find(g => g.id === itemId) :
        current.output.students.find(s => s.id === itemId);
      const original = side === "GROUP" ? (item as ScoreRun["groups"][number])?.component :
        (item as ScoreRun["students"][number])?.individualComponent;
      const id = randomUUID();
      await client.query(`INSERT INTO score_override
        (id,assignment_id,generation,side,item_id,original_value,override_value,reason,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, assignmentId, a.generation, side,
        itemId, original ?? null, value, reason.trim(), actor.id]);
      return { id, side, itemId, value };
    },
    committedAfter: result => result,
  });
}
