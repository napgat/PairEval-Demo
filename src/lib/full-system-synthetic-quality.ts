import type { PoolClient } from "pg";
export const syntheticEmail = (email: string) => /(?:@example\.test|\.invalid)$/i.test(email);
/** Operator-enrolled test cohort plus reserved student addresses; never a production telemetry gate. */
export async function syntheticQualityEnabled(client: PoolClient, classroomId: string) {
  if (!["development", "staging"].includes(process.env.PAIR_EVAL_ENV ?? "")) return false;
  const row = await client.query<{ enabled: boolean }>(`SELECT
    EXISTS (SELECT 1 FROM synthetic_quality_cohort WHERE classroom_id=$1)
    AND EXISTS (SELECT 1 FROM classroom_member WHERE classroom_id=$1 AND role='STUDENT')
    AND NOT EXISTS (SELECT 1 FROM classroom_member m JOIN app_user u ON u.id=m.user_id
      WHERE m.classroom_id=$1 AND m.role='STUDENT' AND NOT
      (u.email_lookup LIKE '%@example.test' OR u.email_lookup LIKE '%.invalid')) AS enabled`, [classroomId]);
  return row.rows[0].enabled;
}
