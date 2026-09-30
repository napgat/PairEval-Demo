import type { FullActor } from "./full-system-auth";
import { NOTICE_VERSION } from "./full-system-notice-version";
import { runAuditedMutation } from "./full-system-audit-outbox";

/** Acknowledgement for the student-project staging preview, not institutional PRD approval. */
export async function acknowledgeStagingNotice(actor: FullActor): Promise<void> {
  if (!["development", "staging"].includes(process.env.PAIR_EVAL_ENV ?? "")) {
    throw new Error("Staging notice is unavailable in this environment");
  }
  await runAuditedMutation({
    prepare: async client => {
      const user = await client.query("SELECT id FROM app_user WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [actor.id]);
      if (user.rowCount !== 1) throw new Error("Account is no longer active");
      const previous = await client.query<{ notice_version: string }>(
        "SELECT notice_version FROM privacy_notice_acceptance WHERE user_id=$1", [actor.id]);
      return previous.rows[0]?.notice_version ?? null;
    },
    intent: previous => ({ actorUserId: actor.id, action: "STAGING_NOTICE_ACKNOWLEDGED_REQUESTED",
      resourceType: "privacy_notice", resourceId: actor.id,
      before: { version: previous }, after: { version: NOTICE_VERSION } }),
    mutate: async client => {
      await client.query(`INSERT INTO privacy_notice_acceptance (user_id,notice_version,accepted_at)
        VALUES ($1,$2,now()) ON CONFLICT (user_id) DO UPDATE
        SET notice_version=EXCLUDED.notice_version, accepted_at=EXCLUDED.accepted_at`,
      [actor.id, NOTICE_VERSION]);
    },
    committedAfter: () => ({ version: NOTICE_VERSION }),
  });
}
