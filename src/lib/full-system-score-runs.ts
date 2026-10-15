import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { enqueueAssignmentNotifications } from "./full-system-notifications";
import { rawComparisonCsv, type RawScoreInput } from "./full-system-raw-export";
import { qualityReport, type QualityReport } from "./full-system-quality";
import type { SyntheticQualityContext } from "./full-system-quality-advanced";
import { syntheticQualityEnabled } from "./full-system-synthetic-quality";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError, AssignmentForbiddenError } from "./full-system-assignments";
import { calculateItemScores, choicePoints, mappedScore, participation, type ScoreAnswer, type ScoreItem,
  type ScorePair, type ScoreSettings } from "./full-system-scoring";

const validId = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
type AssignmentRow = { id: string; classroom_id: string; generation: number; status: string;
  slug: string; classroom_slug: string;
  group_max_score: string; individual_max_score: string; score_floor: string; score_ceiling: string;
  instructor_weight: string;
  min_comparisons: number; completion_threshold: string; scoring_formula_version: string;
  allowed_email_domains: string[]; group_deadline_utc: Date | null; individual_deadline_utc: Date | null };
type StudentRow = { id: string; group_id: string; display_name: string };
type CriterionRow = { id: string; side: "GROUP" | "INDIVIDUAL"; name: string; weight_pct: string };
type OverrideRow = { side: "GROUP" | "INDIVIDUAL"; item_id: string; override_value: string;
  reason: string; id: string };
export type ScoreRun = { assignmentId: string; generation: number; kind: "INTERIM" | "FINAL";
  formulaVersion: string; settings: ScoreSettings; maxScore: number;
  quality?: QualityReport;
  exclusions?: Array<{ pairId: string; side: string; criterionId: string; reason: string }>;
  groups: Array<{ id: string; name: string; component: number | null;
    criteria: Array<ScoreItem["criteria"][number] & { name: string; weightedScore: number | null }>;
    flags: string[] }>;
  students: Array<{ id: string; groupId: string; displayName: string; groupComponent: number | null;
    individualComponent: number | null; total: number | null; answered: number; assigned: number;
    p: number; M: number; flags: string[];
    criteria: Array<ScoreItem["criteria"][number] & { name: string; weightedScore: number | null }> }>;
  pairCoverage: Array<{ pairId: string; side: string; criterionId: string; answered: boolean; excluded?: boolean }>;
  pairSummary: Array<{ side: string; criterionId: string; aId: string; bId: string;
    assigned: number; answered: number; excluded?: number; meanForA: number | null }>;
  overrides: Array<{ side: string; itemId: string; value: number; reason: string }> };

export async function editorScope(client: PoolClient, actor: FullActor, assignmentId: string,
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
  criteria: CriterionRow[]; pairs: ScorePair[]; answers: ScoreAnswer[]; overrides: OverrideRow[];
  qualityContext?: SyntheticQualityContext }): ScoreRun {
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
  const answerByPair = new Map(input.answers.map(answer => [answer.pairId, answer]));
  const pairSummary = new Map<string, { side: string; criterionId: string; aId: string;
    bId: string; assigned: number; answered: number; excluded: number; weightedPoints: number; weight: number }>();
  for (const pair of input.pairs) {
    const key = [pair.side, pair.criterionId, pair.aId, pair.bId].join(":");
    const row = pairSummary.get(key) ?? { side: pair.side, criterionId: pair.criterionId,
      aId: pair.aId, bId: pair.bId, assigned: 0, answered: 0, excluded: 0, weightedPoints: 0, weight: 0 };
    row.assigned++;
    const answer = answerByPair.get(pair.id);
    if (answer) {
      const [left, right] = choicePoints(answer.choice);
      row.answered++;
      if (answer.excluded) row.excluded++;
      else {
        row.weightedPoints += (pair.displayLeft === "A" ? left : right) * answer.weight;
        row.weight += answer.weight;
      }
    }
    pairSummary.set(key, row);
  }
  return { assignmentId: input.assignmentId, generation: input.generation, kind: input.kind,
    quality: qualityReport(input.pairs, input.answers, input.qualityContext),
    exclusions: input.answers.filter(a => a.excluded).map(a => {
      const pair = input.pairs.find(p => p.id === a.pairId)!;
      return { pairId: pair.id, side: pair.side, criterionId: pair.criterionId, reason: a.exclusionReason ?? "" };
    }),
    formulaVersion: input.formulaVersion, settings: input.settings,
    maxScore: input.settings.groupMax + input.settings.individualMax,
    groups, students,
    pairCoverage: input.pairs.map(p => ({ pairId: p.id, side: p.side, criterionId: p.criterionId,
      answered: answeredIds.has(p.id), excluded: answerByPair.get(p.id)?.excluded === true })),
    pairSummary: [...pairSummary.values()].map(row => ({ side: row.side,
      criterionId: row.criterionId, aId: row.aId, bId: row.bId, assigned: row.assigned,
      answered: row.answered, excluded: row.excluded, meanForA: row.weight === 0 ? null : four(row.weightedPoints / row.weight) })),
    overrides: [...overrides.values()].map(row => ({ side: row.side, itemId: row.item_id,
      value: Number(row.override_value), reason: row.reason })) };
}

async function scoreInputs(client: PoolClient, a: AssignmentRow, kind: "INTERIM" | "FINAL") {
  const groups = await client.query<{ id: string; name: string }>(
    `SELECT g.id,g.name FROM group_entity g WHERE g.classroom_id=$1
      AND EXISTS (SELECT 1 FROM classroom_member m WHERE m.classroom_id=$1
        AND m.group_id=g.id AND m.role='STUDENT' AND m.membership_status='ACTIVE')
      ORDER BY g.id`, [a.classroom_id]);
  const students = await client.query<StudentRow>(`SELECT m.user_id AS id,m.group_id,u.display_name
    FROM classroom_member m JOIN app_user u ON u.id=m.user_id
    WHERE m.classroom_id=$1 AND m.role='STUDENT' AND m.membership_status='ACTIVE' ORDER BY m.user_id`,
  [a.classroom_id]);
  const criteria = await client.query<CriterionRow>(`SELECT id,side,name,weight_pct FROM criterion
    WHERE assignment_id=$1 AND active ORDER BY id`, [a.id]);
  const pairRows = await client.query(`SELECT id,criterion_id,side,group_a_id,group_b_id,student_a_id,
    student_b_id,display_left,evaluator_user_id,source FROM active_pair_assignment
    WHERE assignment_id=$1 AND generation=$2 ORDER BY id`, [a.id, a.generation]);
  const answerRows = await client.query(`SELECT sa.pair_assignment_id,sa.choice,sr.evaluator_user_id,p.source,
    review.excluded,review.reason AS exclusion_reason,sa.active_duration_ms
    FROM (SELECT DISTINCT ON (evaluator_user_id,side) id,evaluator_user_id,side
      FROM submission_revision WHERE assignment_id=$1 AND generation=$2
      ORDER BY evaluator_user_id,side,revision_number DESC) sr
    JOIN submission_answer sa ON sa.revision_id=sr.id
    JOIN active_pair_assignment p ON p.id=sa.pair_assignment_id
    LEFT JOIN latest_comparison_review review ON review.pair_assignment_id=p.id
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
    choice: row.choice, evaluatorId: row.evaluator_user_id,
    weight: row.source === "INSTRUCTOR_SELF" ? Number(a.instructor_weight) : 1,
    excluded: row.excluded === true, exclusionReason: row.excluded ? row.exclusion_reason : undefined,
    activeDurationMs: row.active_duration_ms }));
  const settings: ScoreSettings = { groupMax: Number(a.group_max_score),
    individualMax: Number(a.individual_max_score), floor: Number(a.score_floor),
    ceiling: Number(a.score_ceiling), minComparisons: a.min_comparisons,
    kMin: 3, completionThreshold: Number(a.completion_threshold) };
  const synthetic = await syntheticQualityEnabled(client, a.classroom_id);
  const friendshipRows = synthetic ? (await client.query<{ evaluatorId: string; friendId: string }>(
    `SELECT evaluator_user_id AS "evaluatorId",friend_user_id AS "friendId" FROM synthetic_close_friend
      WHERE classroom_id=$1 ORDER BY evaluator_user_id,friend_user_id`, [a.classroom_id])).rows : [];
  const qualityContext: SyntheticQualityContext = { synthetic, timingEnabled: true, students: students.rows.map(s => ({ id: s.id, groupId: s.group_id })), friendships: friendshipRows };
  const source = { groups: groups.rows, students: students.rows, criteria: criteria.rows, pairs, answers, qualityContext,
    overrides: overrideRows.rows };
  const output = assembleScoreRun({ assignmentId: a.id, generation: a.generation, kind,
    formulaVersion: a.scoring_formula_version, settings, ...source });
  return { source, settings, output };
}

async function persistScoreRun(client: PoolClient, actor: FullActor, a: AssignmentRow, kind: "INTERIM" | "FINAL") {
  const assignmentId = a.id;
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
  if (kind === "FINAL") {
    await client.query(`UPDATE assignment SET status='FINALIZED',finalized_at=now()
      WHERE id=$1`, [assignmentId]);
    await enqueueAssignmentNotifications(client, { assignmentId, classroomId: a.classroom_id,
      generation: a.generation, event: "SCORE_FINALIZED", keySuffix: snapshotId });
  }
  return { id: snapshotId, snapshotNo: number.rows[0].next, kind, inputHash, output };
}

export async function recomputeMutationScores(client: PoolClient, actor: FullActor, assignmentId: string) {
  const a = await editorScope(client, actor, assignmentId, true);
  if (a.status === "FINALIZED") throw new AssignmentConflictError("Reopen before recalculating scores");
  return persistScoreRun(client, actor, a, "INTERIM");
}

/** Only a secret-guarded scheduler calls this inside its audited transaction. */
export async function persistScheduledInterimScore(client: PoolClient, assignmentId: string, systemActorId: string,
    tryFinalize = false) {
  if (!["development", "staging", "production"].includes(process.env.PAIR_EVAL_ENV ?? "") ||
      systemActorId !== "00000000-0000-4000-8000-000000000026" || !validId(assignmentId)) {
    throw new AssignmentConflictError("Scheduled scoring is disabled");
  }
  const found = await client.query<AssignmentRow>(`SELECT a.*,c.allowed_email_domains,c.slug AS classroom_slug
    FROM assignment a JOIN classroom c ON c.id=a.classroom_id
    WHERE a.id=$1 AND c.status='ACTIVE' AND EXISTS (SELECT 1 FROM assignment_generation g
      WHERE g.assignment_id=a.id AND g.generation=a.generation AND g.status='ACTIVE') FOR UPDATE OF a`, [assignmentId]);
  const a = found.rows[0];
  if (!a || !["OPEN", "CLOSED"].includes(a.status)) throw new AssignmentConflictError("Assignment is not open for scheduled Interim");
  const service = await client.query(`SELECT 1 FROM app_user WHERE id=$1 AND status='DISABLED' AND email_lookup='score-scheduler@system.invalid'`, [systemActorId]);
  if (!service.rowCount) throw new AssignmentConflictError("Scheduled scoring requires the registered service identity");
  const actor: FullActor = { id: systemActorId, email: "score-scheduler@system.invalid", hostedDomain: null,
    platformRole: "USER", canCreateClassroom: false, privacyAccepted: false };
  let kind: "INTERIM" | "FINAL" = "INTERIM";
  if (tryFinalize) {
    const preview = await scoreInputs(client, a, "FINAL");
    const output = preview.output;
    const appeals = await client.query("SELECT 1 FROM appeal WHERE assignment_id=$1 AND status='OPEN' LIMIT 1", [a.id]);
    if (!appeals.rowCount && automaticFinalizationReady(output)) kind = "FINAL";
    else {
      await client.query(`INSERT INTO app_notification(id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
        SELECT $1,m.user_id,$2,$3,'FINALIZE_REVIEW_REQUIRED',$4,'งานนี้ต้องตรวจสอบก่อนยืนยันคะแนนอัตโนมัติ',$5
        FROM classroom_member m WHERE m.classroom_id=$6 AND m.role='OWNER' AND m.membership_status='ACTIVE'
        ON CONFLICT(dedupe_key) DO NOTHING`, [randomUUID(), a.id, a.generation,
        `${a.id}:${a.generation}:finalize-review`, `/full-system/assignments/${a.id}/reports`, a.classroom_id]);
    }
  }
  const result = await persistScoreRun(client, actor, a, kind);
  return { ...result, autoFinalized: kind === "FINAL" };
}

export function automaticFinalizationReady(output: ScoreRun): boolean {
  return output.groups.length > 0 && output.students.length > 0 &&
    output.groups.every(g => g.component !== null && !g.flags.includes("LOW_CONFIDENCE")) &&
    output.students.every(s => s.total !== null && !s.flags.includes("LOW_CONFIDENCE") && !s.flags.includes("BELOW_K"));
}

export async function scheduledFinalizationReady(client: PoolClient, id: string): Promise<boolean> {
  const result = await client.query<AssignmentRow>("SELECT a.*,c.allowed_email_domains,c.slug AS classroom_slug FROM assignment a JOIN classroom c ON c.id=a.classroom_id WHERE a.id=$1", [id]);
  const appeals = await client.query("SELECT 1 FROM appeal WHERE assignment_id=$1 AND status='OPEN' LIMIT 1", [id]);
  return !!result.rows[0] && !appeals.rowCount && automaticFinalizationReady((await scoreInputs(client,result.rows[0],"FINAL")).output);
}

export async function createScoreRun(actor: FullActor, assignmentId: string, kind: "INTERIM" | "FINAL") {
  if (kind !== "INTERIM" && kind !== "FINAL") throw new AssignmentInputError("Invalid score run kind");
  return runAuditedMutation({
    prepare: async client => {
      const a = await editorScope(client, actor, assignmentId, true);
      if (a.status === "FINALIZED") throw new AssignmentConflictError("Reopen before recalculating scores");
      if (kind === "FINAL") {
        const owner = await client.query("SELECT 1 FROM classroom_member WHERE classroom_id=$1 AND user_id=$2 AND role='OWNER' AND membership_status='ACTIVE'", [a.classroom_id, actor.id]);
        if (!owner.rowCount) throw new AssignmentForbiddenError("Only the Owner can finalize scores");
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
      return persistScoreRun(client, actor, a, kind);
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

/** Raw comparison export is pseudonymous and auditable; identity export is a separate policy gate. */
export async function pseudonymousRawExport(actor: FullActor, assignmentId: string) {
  const key = process.env.PAIR_EVAL_EXPORT_KEY;
  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    throw new AssignmentConflictError("Pseudonymous export key is not configured");
  }
  return runAuditedMutation({
    prepare: async client => {
      const assignment = await editorScope(client, actor, assignmentId);
      const snapshot = await client.query<{ input_json: RawScoreInput; snapshot_no: number }>(
        `SELECT input_json,snapshot_no FROM score_snapshot WHERE assignment_id=$1 AND generation=$2
          ORDER BY snapshot_no DESC LIMIT 1`, [assignmentId, assignment.generation]);
      if (!snapshot.rows[0]) throw new AssignmentConflictError("Recompute scores before exporting");
      if (snapshot.rows[0].input_json.answers.length > 10000) {
        throw new AssignmentConflictError("Raw export is too large for synchronous download");
      }
      return { assignment, snapshot: snapshot.rows[0] };
    },
    intent: ({ assignment, snapshot }) => ({ actorUserId: actor.id,
      classroomId: assignment.classroom_id, action: "RAW_EXPORT_REQUESTED",
      resourceType: "assignment", resourceId: assignmentId,
      before: { generation: assignment.generation, snapshotNo: snapshot.snapshot_no } }),
    mutate: async (_client, { assignment, snapshot }) => ({
      csv: rawComparisonCsv(snapshot.input_json, assignmentId, key),
      filename: `${assignment.classroom_slug}_${assignment.slug}_raw_${new Date()
        .toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-")}.csv`,
      count: snapshot.input_json.answers.length }),
    committedAfter: result => ({ rows: result.count, identity: false }),
  });
}

export async function reopenScore(actor: FullActor, assignmentId: string, reason: string) {
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.length > 2000) {
    throw new AssignmentInputError("Reopen reason must have 10–2000 characters");
  }
  return runAuditedMutation({
    prepare: async client => {
      const a = await editorScope(client, actor, assignmentId, true);
      if (a.status !== "FINALIZED") throw new AssignmentConflictError("Assignment is not finalized");
      const owner = await client.query("SELECT 1 FROM classroom_member WHERE classroom_id=$1 AND user_id=$2 AND role='OWNER' AND membership_status='ACTIVE'", [a.classroom_id, actor.id]);
      if (!owner.rowCount) throw new AssignmentForbiddenError("Only the Owner can reopen scores");
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
