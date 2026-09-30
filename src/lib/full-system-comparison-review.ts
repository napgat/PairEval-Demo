import { randomUUID } from "node:crypto";
import type { FullActor } from "./full-system-auth";
import { databasePool } from "./full-system-postgres";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { AssignmentConflictError, AssignmentInputError, AssignmentNotFoundError } from "./full-system-assignments";
import { editorScope, recomputeMutationScores } from "./full-system-score-runs";

const validId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export type ComparisonReview = { pairId: string; side: string; criterion: string;
  itemA: string; itemB: string; displayLeft: "A" | "B"; choice: number;
  reviewId: string | null; excluded: boolean; reason: string | null };

const latestAnswers = `SELECT DISTINCT ON (evaluator_user_id,side) id,evaluator_user_id,side
  FROM submission_revision WHERE assignment_id=$1 AND generation=$2
  ORDER BY evaluator_user_id,side,revision_number DESC`;

/** Explicit projection: the review UI receives no evaluator or reviewer identity. */
export async function listComparisonReviews(actor: FullActor, assignmentId: string, cursor: string | null) {
  if (cursor !== null && !validId(cursor)) throw new AssignmentInputError("Invalid review cursor");
  const client = await databasePool().connect();
  try {
    const a = await editorScope(client, actor, assignmentId);
    const result = await client.query<ComparisonReview>(`SELECT p.id AS "pairId",p.side,c.name AS criterion,
      COALESCE(ga.name,ua.display_name) AS "itemA",COALESCE(gb.name,ub.display_name) AS "itemB",
      p.display_left AS "displayLeft",sa.choice,review.id AS "reviewId",
      COALESCE(review.excluded,false) AS excluded,review.reason
      FROM active_pair_assignment p JOIN criterion c ON c.id=p.criterion_id
      JOIN (${latestAnswers}) sr ON sr.evaluator_user_id=p.evaluator_user_id AND sr.side=p.side
      JOIN submission_answer sa ON sa.revision_id=sr.id AND sa.pair_assignment_id=p.id
      LEFT JOIN latest_comparison_review review ON review.pair_assignment_id=p.id
      LEFT JOIN group_entity ga ON ga.id=p.group_a_id LEFT JOIN group_entity gb ON gb.id=p.group_b_id
      LEFT JOIN app_user ua ON ua.id=p.student_a_id LEFT JOIN app_user ub ON ub.id=p.student_b_id
      WHERE p.assignment_id=$1 AND p.generation=$2 AND ($3::uuid IS NULL OR p.id>$3::uuid)
      ORDER BY p.id LIMIT 201`, [a.id, a.generation, cursor]);
    return { items: result.rows.slice(0, 200), nextCursor: result.rows.length > 200 ? result.rows[199].pairId : null,
      generation: a.generation, assignmentStatus: a.status };
  } finally { client.release(); }
}

export async function reviewComparison(actor: FullActor, assignmentId: string, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AssignmentInputError("Review body required");
  const input = raw as Record<string, unknown>;
  if (!validId(input.pairId) || typeof input.excluded !== "boolean" || typeof input.reason !== "string" ||
      input.reason.trim().length < 10 || input.reason.length > 2000 ||
      !(input.expectedReviewId === null || validId(input.expectedReviewId))) throw new AssignmentInputError("Invalid comparison review");
  const pairId = input.pairId, excluded = input.excluded, reason = input.reason.trim();
  return runAuditedMutation({
    prepare: async client => {
      const a = await editorScope(client, actor, assignmentId, true);
      if (a.status === "FINALIZED") throw new AssignmentConflictError("Reopen before reviewing comparisons");
      const pair = await client.query(`SELECT p.id,review.id AS review_id,COALESCE(review.excluded,false) AS excluded
        FROM active_pair_assignment p
        JOIN (${latestAnswers}) sr ON sr.evaluator_user_id=p.evaluator_user_id AND sr.side=p.side
        JOIN submission_answer sa ON sa.revision_id=sr.id AND sa.pair_assignment_id=p.id
        LEFT JOIN latest_comparison_review review ON review.pair_assignment_id=p.id
        WHERE p.id=$3 AND p.assignment_id=$1 AND p.generation=$2`, [a.id, a.generation, pairId]);
      if (!pair.rows[0]) throw new AssignmentNotFoundError("Submitted comparison not found");
      if (pair.rows[0].review_id !== input.expectedReviewId) throw new AssignmentConflictError("Comparison review changed; refresh before retrying");
      if (pair.rows[0].excluded === excluded) throw new AssignmentConflictError("Comparison already has this review status");
      return { a, before: pair.rows[0] };
    },
    intent: ({ a, before }) => ({ actorUserId: actor.id, classroomId: a.classroom_id,
      action: "COMPARISON_REVIEW_REQUESTED", resourceType: "pair_assignment", resourceId: pairId, reason,
      before: { generation: a.generation, reviewId: before.review_id, excluded: before.excluded },
      after: { excluded } }),
    mutate: async (client, { a }) => {
      const reviewId = randomUUID();
      await client.query(`INSERT INTO comparison_review_decision
        (id,pair_assignment_id,excluded,reason,created_by) VALUES ($1,$2,$3,$4,$5)`, [reviewId, pairId, excluded, reason, actor.id]);
      const snapshot = await recomputeMutationScores(client, actor, a.id);
      return { pairId, reviewId, excluded, snapshotId: snapshot.id, snapshotNo: snapshot.snapshotNo };
    },
    committedAfter: result => result,
  });
}
