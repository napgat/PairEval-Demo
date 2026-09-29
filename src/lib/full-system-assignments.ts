import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import { domainAllowed, type FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { planFullSystemPairs, type PairCriterion, type PairPlan, type PairStudent } from "./full-system-pairing";

export class AssignmentInputError extends Error {}
export class AssignmentNotFoundError extends Error {}
export class AssignmentConflictError extends Error {}

type CriterionInput = { side: "GROUP" | "INDIVIDUAL"; name: string; description?: string;
  weightPct: number };
type ArtifactInput = { side: "GROUP" | "INDIVIDUAL"; itemId: string; url: string; label?: string };
export type AssignmentInput = { name: string; description?: string; artifactOverviewUrl?: string;
  groupMaxScore: number; individualMaxScore: number; groupDeadline: string | null;
  individualDeadline: string | null; targetCoverage: number; maxWorkload: number;
  criteria: CriterionInput[]; artifacts?: ArtifactInput[] };

function uuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function score(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 9999.99 && Math.abs(Math.round(value * 100) - value * 100) < 0.000001; }
function safeUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function deadline(value: unknown): value is string | null {
  return value === null || typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value));
}
export function validateAssignmentInput(raw: unknown): AssignmentInput {
  if (!raw || typeof raw !== "object") throw new AssignmentInputError("Assignment body is required");
  const x = raw as Record<string, unknown>;
  const name = typeof x.name === "string" ? x.name.trim() : "";
  if (name.length < 2 || name.length > 120 || !score(x.groupMaxScore) || !score(x.individualMaxScore) ||
      x.groupMaxScore + x.individualMaxScore === 0 || !deadline(x.groupDeadline) || !deadline(x.individualDeadline) ||
      !Number.isSafeInteger(x.targetCoverage) || Number(x.targetCoverage) < 1 || Number(x.targetCoverage) > 20 ||
      !Number.isSafeInteger(x.maxWorkload) || Number(x.maxWorkload) < 1 || Number(x.maxWorkload) > 30) {
    throw new AssignmentInputError("Invalid assignment name, score, deadline or pairing limits");
  }
  if (x.groupMaxScore > 0 && x.groupDeadline === null || x.individualMaxScore > 0 && x.individualDeadline === null) {
    throw new AssignmentInputError("Each enabled side needs a deadline");
  }
  if (x.artifactOverviewUrl !== undefined && x.artifactOverviewUrl !== "" && !safeUrl(x.artifactOverviewUrl)) {
    throw new AssignmentInputError("Artifact overview URL must use HTTPS");
  }
  if (!Array.isArray(x.criteria) || x.criteria.length > 40 || !Array.isArray(x.artifacts ?? []) ||
      ((x.artifacts as unknown[] | undefined)?.length ?? 0) > 400) throw new AssignmentInputError("Invalid criteria or artifacts");
  const criteria = x.criteria.map((entry: unknown) => {
    const row = entry as Record<string, unknown>;
    if (!row || !["GROUP", "INDIVIDUAL"].includes(String(row.side)) ||
        typeof row.name !== "string" || !row.name.trim() || row.name.length > 120 ||
        typeof row.weightPct !== "number" || !Number.isFinite(row.weightPct) ||
        row.weightPct < 0 || row.weightPct > 100 || Math.abs(Math.round(row.weightPct * 100) - row.weightPct * 100) > 0.000001) {
      throw new AssignmentInputError("Invalid criterion");
    }
    return { side: row.side as CriterionInput["side"], name: row.name.trim(),
      description: typeof row.description === "string" ? row.description.trim() : undefined,
      weightPct: row.weightPct };
  });
  const artifacts = (x.artifacts as unknown[] | undefined ?? []).map(entry => {
    const row = entry as Record<string, unknown>;
    if (!row || !["GROUP", "INDIVIDUAL"].includes(String(row.side)) || !uuid(row.itemId) || !safeUrl(row.url)) {
      throw new AssignmentInputError("Invalid item artifact");
    }
    return { side: row.side as ArtifactInput["side"], itemId: row.itemId as string,
      url: row.url as string, label: typeof row.label === "string" ? row.label.trim() : undefined };
  });
  if (new Set(artifacts.map(row => `${row.side}:${row.itemId}`)).size !== artifacts.length) {
    throw new AssignmentInputError("Duplicate item artifact");
  }
  return { name, description: typeof x.description === "string" ? x.description.trim() : undefined,
    artifactOverviewUrl: typeof x.artifactOverviewUrl === "string" ? x.artifactOverviewUrl : undefined,
    groupMaxScore: x.groupMaxScore as number, individualMaxScore: x.individualMaxScore as number,
    groupDeadline: x.groupDeadline as string | null, individualDeadline: x.individualDeadline as string | null,
    targetCoverage: x.targetCoverage as number, maxWorkload: x.maxWorkload as number,
    criteria, artifacts };
}

function validateWeights(input: AssignmentInput): void {
  for (const side of ["GROUP", "INDIVIDUAL"] as const) {
    const enabled = side === "GROUP" ? input.groupMaxScore > 0 : input.individualMaxScore > 0;
    const values = input.criteria.filter(row => row.side === side);
    const hundredths = values.reduce((sum, row) => sum + Math.round(row.weightPct * 100), 0);
    if (enabled && (!values.length || Math.abs(hundredths - 10000) > 1) || !enabled && values.length) {
      throw new AssignmentInputError(`${side} criterion weights must total 100% for an enabled side`);
    }
  }
}
function validatePublishDates(input: AssignmentInput): void {
  if (input.groupMaxScore > 0 && Date.parse(input.groupDeadline!) <= Date.now() ||
      input.individualMaxScore > 0 && Date.parse(input.individualDeadline!) <= Date.now()) {
    throw new AssignmentInputError("Enabled deadlines must be in the future");
  }
}
async function requireEditor(client: PoolClient, actor: FullActor, classroomId: string): Promise<void> {
  const result = await client.query<{ role: string; allowed_email_domains: string[] }>(`SELECT m.role,c.allowed_email_domains
    FROM classroom c JOIN classroom_member m ON m.classroom_id=c.id
    WHERE c.id=$1 AND c.status='ACTIVE' AND m.user_id=$2 AND m.membership_status='ACTIVE' FOR UPDATE OF c`,
  [classroomId, actor.id]);
  if (!result.rows[0] || !["OWNER", "CO_TEACHER"].includes(result.rows[0].role) ||
      !domainAllowed(actor.hostedDomain, result.rows[0].allowed_email_domains)) {
    throw new AssignmentNotFoundError("Classroom not found");
  }
}
async function saveDetails(client: PoolClient, assignmentId: string, classroomId: string,
    input: AssignmentInput): Promise<void> {
  await client.query("UPDATE criterion SET active=false WHERE assignment_id=$1 AND active", [assignmentId]);
  await client.query("DELETE FROM group_artifact WHERE assignment_id=$1", [assignmentId]);
  await client.query("DELETE FROM individual_artifact WHERE assignment_id=$1", [assignmentId]);
  for (let index = 0; index < input.criteria.length; index++) {
    const row = input.criteria[index];
    await client.query(`INSERT INTO criterion (id,assignment_id,side,name,description,weight_pct,display_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), assignmentId, row.side,
      row.name, row.description ?? null, row.weightPct, index]);
  }
  for (const artifact of input.artifacts ?? []) {
    const found = artifact.side === "GROUP"
      ? await client.query("SELECT 1 FROM group_entity WHERE id=$1 AND classroom_id=$2", [artifact.itemId, classroomId])
      : await client.query(`SELECT 1 FROM classroom_member WHERE user_id=$1 AND classroom_id=$2
          AND role='STUDENT' AND membership_status='ACTIVE'`, [artifact.itemId, classroomId]);
    if (found.rowCount !== 1) throw new AssignmentInputError("Artifact item is outside this classroom");
    if (artifact.side === "GROUP") await client.query(`INSERT INTO group_artifact
      (id,assignment_id,group_id,artifact_url,display_label) VALUES ($1,$2,$3,$4,$5)`,
    [randomUUID(), assignmentId, artifact.itemId, artifact.url, artifact.label ?? null]);
    else await client.query(`INSERT INTO individual_artifact
      (id,assignment_id,student_user_id,artifact_url,display_label) VALUES ($1,$2,$3,$4,$5)`,
    [randomUUID(), assignmentId, artifact.itemId, artifact.url, artifact.label ?? null]);
  }
}

export async function createAssignment(actor: FullActor, classroomId: string, raw: unknown) {
  const input = validateAssignmentInput(raw); const id = randomUUID();
  return runAuditedMutation({
    prepare: async client => { await requireEditor(client, actor, classroomId); },
    intent: () => ({ actorUserId: actor.id, classroomId, action: "ASSIGNMENT_CREATE_REQUESTED",
      resourceType: "assignment", resourceId: id }),
    mutate: async client => {
      await client.query(`INSERT INTO assignment
        (id,classroom_id,name,slug,description,artifact_overview_url,group_max_score,individual_max_score,
         group_deadline_utc,individual_deadline_utc,target_coverage,max_workload,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, classroomId, input.name, `assignment-${id.slice(0, 8)}`, input.description ?? null,
        input.artifactOverviewUrl ?? null, input.groupMaxScore, input.individualMaxScore,
        input.groupDeadline, input.individualDeadline, input.targetCoverage, input.maxWorkload, actor.id]);
      await saveDetails(client, id, classroomId, input);
      return { id, status: "DRAFT" as const };
    },
  });
}

export async function replaceDraftAssignment(actor: FullActor, id: string, raw: unknown) {
  const input = validateAssignmentInput(raw);
  return runAuditedMutation({
    prepare: async client => {
      const row = await lockedAssignment(client, actor, id);
      if (row.status !== "DRAFT") throw new AssignmentConflictError("Unpublish before editing assignment criteria or config");
      return row;
    },
    intent: row => ({ classroomId: row.classroom_id, actorUserId: actor.id,
      action: "ASSIGNMENT_DRAFT_REPLACE_REQUESTED", resourceType: "assignment", resourceId: id,
      before: { status: row.status, generation: row.generation } }),
    mutate: async (client, row) => {
      await client.query(`UPDATE assignment SET name=$2,description=$3,artifact_overview_url=$4,
        group_max_score=$5,individual_max_score=$6,group_deadline_utc=$7,individual_deadline_utc=$8,
        target_coverage=$9,max_workload=$10 WHERE id=$1`,
      [id, input.name, input.description ?? null, input.artifactOverviewUrl ?? null,
        input.groupMaxScore, input.individualMaxScore, input.groupDeadline, input.individualDeadline,
        input.targetCoverage, input.maxWorkload]);
      await saveDetails(client, id, row.classroom_id, input);
      return { id, status: "DRAFT" as const, generation: row.generation };
    },
  });
}

export async function cloneAssignment(actor: FullActor, id: string, name: string) {
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 120) {
    throw new AssignmentInputError("Clone name must have 2–120 characters");
  }
  const source = await getAssignment(actor, id);
  return createAssignment(actor, source.classroomId, { ...source, name: name.trim() });
}

export async function listAssignments(actor: FullActor, classroomId: string) {
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN"); await requireEditor(client, actor, classroomId);
    const rows = await client.query(`SELECT id,name,status,generation,group_deadline_utc,individual_deadline_utc
      FROM assignment WHERE classroom_id=$1 ORDER BY created_at DESC`, [classroomId]);
    await client.query("COMMIT"); return rows.rows;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function lockedAssignment(client: PoolClient, actor: FullActor, id: string) {
  const row = await client.query<{ id: string; classroom_id: string; status: string; generation: number;
    pairing_seed: string | null }>("SELECT id,classroom_id,status,generation,pairing_seed FROM assignment WHERE id=$1 FOR UPDATE", [id]);
  if (!row.rows[0]) throw new AssignmentNotFoundError("Assignment not found");
  await requireEditor(client, actor, row.rows[0].classroom_id);
  return row.rows[0];
}
async function loadInput(client: PoolClient, id: string): Promise<AssignmentInput> {
  const assignment = await client.query(`SELECT name,description,artifact_overview_url,group_max_score,
    individual_max_score,group_deadline_utc,individual_deadline_utc,target_coverage,max_workload
    FROM assignment WHERE id=$1`, [id]);
  if (!assignment.rows[0]) throw new AssignmentNotFoundError("Assignment not found");
  const x = assignment.rows[0];
  const criteria = await client.query(`SELECT side,name,description,weight_pct FROM criterion
    WHERE assignment_id=$1 AND active ORDER BY display_order`, [id]);
  const groupArtifacts = await client.query(`SELECT group_id AS item_id,artifact_url,display_label
    FROM group_artifact WHERE assignment_id=$1`, [id]);
  const individualArtifacts = await client.query(`SELECT student_user_id AS item_id,artifact_url,display_label
    FROM individual_artifact WHERE assignment_id=$1`, [id]);
  return { name: x.name, description: x.description ?? undefined,
    artifactOverviewUrl: x.artifact_overview_url ?? undefined,
    groupMaxScore: Number(x.group_max_score), individualMaxScore: Number(x.individual_max_score),
    groupDeadline: x.group_deadline_utc?.toISOString() ?? null,
    individualDeadline: x.individual_deadline_utc?.toISOString() ?? null,
    targetCoverage: x.target_coverage, maxWorkload: x.max_workload,
    criteria: criteria.rows.map(row => ({ side: row.side, name: row.name,
      description: row.description ?? undefined, weightPct: Number(row.weight_pct) })),
    artifacts: [...groupArtifacts.rows.map(row => ({ side: "GROUP" as const, itemId: row.item_id,
      url: row.artifact_url, label: row.display_label ?? undefined })),
      ...individualArtifacts.rows.map(row => ({ side: "INDIVIDUAL" as const, itemId: row.item_id,
        url: row.artifact_url, label: row.display_label ?? undefined }))] };
}
async function planWithClient(client: PoolClient, id: string, classroomId: string, seed: string): Promise<PairPlan> {
  const input = await loadInput(client, id); validateWeights(input); validatePublishDates(input);
  const groups = await client.query<{ id: string }>("SELECT id FROM group_entity WHERE classroom_id=$1 ORDER BY id", [classroomId]);
  const students = await client.query<PairStudent>(`SELECT m.user_id AS id,m.group_id AS "groupId"
    FROM classroom_member m WHERE m.classroom_id=$1 AND m.role='STUDENT' AND m.membership_status='ACTIVE'
    ORDER BY m.user_id`, [classroomId]);
  const criteria = await client.query<PairCriterion>("SELECT id,side FROM criterion WHERE assignment_id=$1 AND active ORDER BY id", [id]);
  return planFullSystemPairs({ students: students.rows, groups: groups.rows.map(row => row.id),
    criteria: criteria.rows, targetCoverage: input.targetCoverage, maxWorkload: input.maxWorkload,
    seed, groupEnabled: input.groupMaxScore > 0, individualEnabled: input.individualMaxScore > 0 });
}

export async function getAssignment(actor: FullActor, id: string) {
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN"); const row = await lockedAssignment(client, actor, id);
    const input = await loadInput(client, id);
    const generations = await client.query(`SELECT generation,status,seed,created_at,invalidated_at,invalidated_reason
      FROM assignment_generation WHERE assignment_id=$1 ORDER BY generation`, [id]);
    const coverage = await client.query(`SELECT generation,side,criterion_id,count(*)::integer AS n
      FROM pair_assignment WHERE assignment_id=$1 GROUP BY generation,side,criterion_id ORDER BY generation,side`, [id]);
    await client.query("COMMIT");
    return { id, classroomId: row.classroom_id, status: row.status, generation: row.generation,
      ...input, generations: generations.rows, persistedAssignments: coverage.rows };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function feasibility(actor: FullActor, id: string, seed: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(seed)) throw new AssignmentInputError("Invalid seed");
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN"); const row = await lockedAssignment(client, actor, id);
    if (row.status !== "DRAFT") throw new AssignmentConflictError("Feasibility is for DRAFT only");
    const result = await planWithClient(client, id, row.classroom_id, seed);
    await client.query("COMMIT"); return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function publishAssignment(actor: FullActor, id: string, seed: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(seed)) throw new AssignmentInputError("Invalid seed");
  return runAuditedMutation({
    prepare: async client => {
      const row = await lockedAssignment(client, actor, id);
      if (row.status !== "DRAFT") throw new AssignmentConflictError("Assignment is not DRAFT");
      const plan = await planWithClient(client, id, row.classroom_id, seed);
      if (!plan.feasible) throw new AssignmentConflictError("Pairing infeasible; no generation was saved");
      return { row, plan };
    },
    intent: ({ row }) => ({ classroomId: row.classroom_id, actorUserId: actor.id,
      action: "ASSIGNMENT_PUBLISH_REQUESTED", resourceType: "assignment", resourceId: id,
      before: { status: row.status, generation: row.generation }, reason: "publish" }),
    mutate: async (client, { row, plan }) => {
      const generation = row.generation + 1;
      await client.query(`INSERT INTO assignment_generation (id,assignment_id,generation,seed,status)
        VALUES ($1,$2,$3,$4,'ACTIVE')`, [randomUUID(), id, generation, seed]);
      const links = await client.query<{ side: string; item_id: string; artifact_url: string }>(
        `SELECT 'GROUP' AS side,group_id AS item_id,artifact_url FROM group_artifact WHERE assignment_id=$1
         UNION ALL SELECT 'INDIVIDUAL',student_user_id,artifact_url FROM individual_artifact WHERE assignment_id=$1`, [id]);
      const artifact = new Map(links.rows.map(link => [`${link.side}:${link.item_id}`, link.artifact_url]));
      for (const pair of plan.comparisons) await client.query(`INSERT INTO pair_assignment
        (id,assignment_id,criterion_id,side,group_a_id,group_b_id,student_a_id,student_b_id,
         evaluator_user_id,display_left,generation,left_artifact_url,right_artifact_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [randomUUID(), id, pair.criterionId, pair.side,
        pair.side === "GROUP" ? pair.aId : null, pair.side === "GROUP" ? pair.bId : null,
        pair.side === "INDIVIDUAL" ? pair.aId : null, pair.side === "INDIVIDUAL" ? pair.bId : null,
        pair.evaluatorId, pair.displayLeft, generation,
        artifact.get(`${pair.side}:${pair.displayLeft === "A" ? pair.aId : pair.bId}`) ?? null,
        artifact.get(`${pair.side}:${pair.displayLeft === "A" ? pair.bId : pair.aId}`) ?? null]);
      await client.query(`UPDATE assignment SET generation=$2,pairing_seed=$3,status='OPEN',published_at=now()
        WHERE id=$1`, [id, generation, /^\d{1,18}$/.test(seed) ? seed : null]);
      return { id, status: "OPEN" as const, generation, parts: plan.parts,
        assignmentCount: plan.comparisons.length };
    },
    committedAfter: result => ({ status: result.status, generation: result.generation,
      assignmentCount: result.assignmentCount }),
  });
}

export async function unpublishAssignment(actor: FullActor, id: string, reason: string) {
  if (typeof reason !== "string" || reason.trim().length < 5 || reason.length > 500) {
    throw new AssignmentInputError("Unpublish reason must have 5–500 characters");
  }
  return runAuditedMutation({
    prepare: async client => {
      const row = await lockedAssignment(client, actor, id);
      if (!["OPEN", "PUBLISHED"].includes(row.status)) throw new AssignmentConflictError("Assignment cannot be unpublished");
      return row;
    },
    intent: row => ({ classroomId: row.classroom_id, actorUserId: actor.id,
      action: "ASSIGNMENT_UNPUBLISH_REQUESTED", resourceType: "assignment", resourceId: id,
      before: { status: row.status, generation: row.generation }, reason: reason.trim() }),
    mutate: async (client, row) => {
      await client.query(`UPDATE assignment_generation SET status='INVALIDATED',invalidated_at=now(),
        invalidated_reason=$3 WHERE assignment_id=$1 AND generation=$2 AND status='ACTIVE'`,
      [id, row.generation, reason.trim()]);
      await client.query("UPDATE assignment SET status='DRAFT' WHERE id=$1", [id]);
      return { id, status: "DRAFT" as const, invalidatedGeneration: row.generation,
        warning: "Previous pairs and any future submissions stay in history; edits invalidate their use for current scoring" };
    },
    committedAfter: result => ({ status: result.status, invalidatedGeneration: result.invalidatedGeneration }),
  });
}
