import { createHmac, randomUUID } from "node:crypto";
import type { FullActor } from "./full-system-auth";
import { runAuditedMutation } from "./full-system-audit-outbox";
import { AssignmentConflictError } from "./full-system-assignments";

/** Explicit policy: the academic year starts on 1 August unless configured otherwise. */
export function retentionCutoff(
  now: Date,
  years: number,
  startMonth = 8,
): Date {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isInteger(years) ||
    years < 1 ||
    startMonth < 1 ||
    startMonth > 12
  )
    throw new Error("Invalid retention policy");
  const year =
    now.getUTCFullYear() - (now.getUTCMonth() + 1 < startMonth ? 1 : 0);
  // The collection academic year counts as year one; expire at the next academic-year boundary.
  return new Date(Date.UTC(year - years + 1, startMonth - 1, 1));
}
export function stablePrivacyAlias(key: string, userId: string): string {
  if (Buffer.byteLength(key) < 32)
    throw new Error("Privacy key must have at least 32 bytes");
  return `retained-${createHmac("sha256", key).update(userId).digest("hex").slice(0, 24)}`;
}
export function redactIdentity(
  value: unknown,
  replacements: Record<string, string>,
): unknown {
  if (typeof value === "string") return replacements[value] ?? value;
  if (Array.isArray(value))
    return value.map((item) => redactIdentity(item, replacements));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        redactIdentity(v, replacements),
      ]),
    );
  return value;
}

/** Immediate authenticated data access satisfies the 30-day service window; never includes ratings from other people. */
export async function exportOwnPersonalData(actor: FullActor) {
  return runAuditedMutation({
    prepare: async () => null,
    intent: () => ({
      actorUserId: actor.id,
      action: "PERSONAL_DATA_COPY_REQUESTED",
      resourceType: "user",
      resourceId: actor.id,
    }),
    mutate: async (client) => {
      const profile = await client.query(
        "SELECT email_raw,display_name,google_sub,status,created_at,last_login_at FROM app_user WHERE id=$1",
        [actor.id],
      );
      const memberships = await client.query(
        `SELECT c.name,c.timezone,m.role,m.student_number,m.membership_status,m.joined_at,g.name AS group_name FROM classroom_member m JOIN classroom c ON c.id=m.classroom_id LEFT JOIN group_entity g ON g.id=m.group_id WHERE m.user_id=$1`,
        [actor.id],
      );
      const revisions = await client.query(
        `SELECT r.assignment_id,r.side,r.generation,r.revision_number,r.submitted_at,
        COALESCE(jsonb_agg(jsonb_build_object('pairId',s.pair_assignment_id,'choice',s.choice)) FILTER(WHERE s.pair_assignment_id IS NOT NULL),'[]') AS own_answers
        FROM submission_revision r LEFT JOIN submission_answer s ON s.revision_id=r.id WHERE r.evaluator_user_id=$1 GROUP BY r.id ORDER BY r.submitted_at`,
        [actor.id],
      );
      const appeals = await client.query(
        "SELECT assignment_id,message,status,resolution,created_at,resolved_at FROM appeal WHERE student_user_id=$1",
        [actor.id],
      );
      const notice = await client.query(
        "SELECT notice_version,accepted_at FROM privacy_notice_acceptance WHERE user_id=$1",
        [actor.id],
      );
      const scoreRows = await client.query(
        `SELECT a.name,s.kind,s.created_at,
        (SELECT student FROM jsonb_array_elements(s.output_json->'students') student WHERE student->>'id'=$1::text) AS own
        FROM assignment a JOIN LATERAL(SELECT kind,created_at,output_json FROM score_snapshot WHERE assignment_id=a.id AND generation=a.generation ORDER BY snapshot_no DESC LIMIT 1)s ON true
        JOIN classroom_member m ON m.classroom_id=a.classroom_id WHERE m.user_id=$1::uuid AND m.role='STUDENT'`,
        [actor.id],
      );
      const ownScores = scoreRows.rows
        .filter((r) => r.own)
        .map((r) => ({
          assignment: r.name,
          kind: r.kind,
          asOf: r.created_at,
          groupComponent: r.own.groupComponent,
          individualComponent: r.own.flags.includes("BELOW_K")
            ? null
            : r.own.individualComponent,
          total: r.own.flags.includes("BELOW_K") ? null : r.own.total,
          p: r.own.p,
          M: r.own.M,
        }));
      const requestId = randomUUID();
      await client.query(
        "INSERT INTO privacy_data_request(id,user_id,kind,status,completed_at) VALUES($1,$2,'COPY','COMPLETED',now())",
        [requestId, actor.id],
      );
      return {
        requestId,
        generatedAt: new Date().toISOString(),
        profile: profile.rows[0],
        memberships: memberships.rows,
        submittedByMe: revisions.rows,
        ownScores,
        appeals: appeals.rows,
        notices: notice.rows,
      };
    },
    committedAfter: (data) => ({
      requestId: data.requestId,
      status: "COMPLETED",
    }),
  });
}

/** Uses server time and excludes every account with recent teaching/assessment activity. */
export async function runPrivacyRetention(now = new Date()) {
  const key = process.env.PAIR_EVAL_PRIVACY_KEY;
  if (!key || Buffer.byteLength(key) < 32)
    throw new AssignmentConflictError("Separate privacy key is not configured");
  const cutoff = retentionCutoff(
    now,
    2,
    Number(process.env.PAIR_EVAL_ACADEMIC_START_MONTH ?? 8),
  );
  const timingCutoff = retentionCutoff(
    now,
    1,
    Number(process.env.PAIR_EVAL_ACADEMIC_START_MONTH ?? 8),
  );
  const actorId = "00000000-0000-4000-8000-000000000026";
  return runAuditedMutation({
    prepare: async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(23180415)");
      const users = await client.query<{
        id: string;
        email_raw: string;
        email_lookup: string;
        display_name: string;
        google_sub: string | null;
      }>(
        `SELECT u.id,u.email_raw,u.email_lookup,u.display_name,u.google_sub FROM app_user u
        WHERE u.anonymized_at IS NULL AND u.created_at<$1 AND COALESCE(u.last_login_at,u.created_at)<$1
          AND u.id<>$2 AND NOT EXISTS(SELECT 1 FROM classroom_member m JOIN assignment a ON a.classroom_id=m.classroom_id
            WHERE m.user_id=u.id AND GREATEST(a.created_at,a.group_deadline_utc,a.individual_deadline_utc,a.finalized_at)>=$1)
          AND NOT EXISTS(SELECT 1 FROM submission_revision r WHERE r.evaluator_user_id=u.id AND r.submitted_at>=$1)
          AND NOT EXISTS(SELECT 1 FROM app_session s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>now())
        ORDER BY u.id LIMIT 200 FOR UPDATE OF u`,
        [cutoff, actorId],
      );
      return users.rows;
    },
    intent: (users) => ({
      actorUserId: actorId,
      action: "RETENTION_ANONYMIZATION_REQUESTED",
      resourceType: "retention",
      resourceId: cutoff.toISOString(),
      before: { count: users.length },
    }),
    mutate: async (client, users) => {
      await client.query(
        "DELETE FROM api_rate_window WHERE window_start<now()-interval '1 day'",
      );
      for (const user of users) {
        const alias = stablePrivacyAlias(key, user.id),
          replacements: Record<string, string> = {};
        for (const value of [
          user.email_raw,
          user.email_lookup,
          user.display_name,
          user.google_sub,
        ])
          if (value) replacements[value] = alias;
        // A narrowly scoped SECURITY DEFINER function handles immutable historical identity metadata.
        await client.query(
          "SELECT anonymize_expired_identity($1,$2,$3,$4::jsonb)",
          [user.id, cutoff, alias, replacements],
        );
      }
      const timing = await client.query("SELECT expire_active_timing($1)", [
        timingCutoff,
      ]);
      return {
        anonymized: users.length,
        timingCutoff: timingCutoff.toISOString(),
        timingRows: Number(timing.rows[0]?.expire_active_timing ?? 0),
      };
    },
    committedAfter: (result) => result,
  });
}
