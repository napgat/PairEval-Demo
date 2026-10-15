import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { databasePool } from "./full-system-postgres";
import type { FullActor } from "./full-system-auth";

export type NotificationEvent = "ASSIGNMENT_PUBLISHED" | "PAIRS_REGENERATED" |
  "DEADLINE_48H_GROUP" | "DEADLINE_48H_INDIVIDUAL" | "SCORE_FINALIZED" | "EXTRA_EVALUATOR" | "FINALIZE_REVIEW_REQUIRED";

const details: Record<NotificationEvent, { message: string; page: "work" | "score" }> = {
  FINALIZE_REVIEW_REQUIRED: { message: "งานนี้ต้องตรวจสอบก่อนยืนยันคะแนนอัตโนมัติ", page: "score" },
  ASSIGNMENT_PUBLISHED: { message: "เปิดงานประเมินแล้ว", page: "work" },
  PAIRS_REGENERATED: { message: "รายการคู่ประเมินเปลี่ยนแล้ว โปรดตรวจงานอีกครั้ง", page: "work" },
  DEADLINE_48H_GROUP: { message: "เหลือไม่เกิน 48 ชั่วโมงก่อนปิดประเมินกลุ่ม", page: "work" },
  DEADLINE_48H_INDIVIDUAL: { message: "เหลือไม่เกิน 48 ชั่วโมงก่อนปิดประเมินบุคคล", page: "work" },
  SCORE_FINALIZED: { message: "ผลการประเมินพร้อมให้ตรวจแล้ว", page: "score" },
  EXTRA_EVALUATOR: { message: "มีงานประเมินเพิ่มเติม โปรดตรวจรายการงาน", page: "work" },
};

export function notificationContent(event: NotificationEvent, classroomId: string,
    assignmentId: string): { message: string; deepLink: string } {
  const config = details[event];
  return { message: config.message, deepLink: config.page === "score"
    ? `/full-system/assignments/${assignmentId}/my-score`
    : `/full-system/classrooms/${classroomId}/work` };
}

/** Called inside the domain mutation transaction so notifications cannot precede a failed action. */
export async function enqueueAssignmentNotifications(client: PoolClient, input: {
  assignmentId: string; classroomId: string; generation: number; event: NotificationEvent;
  recipientIds?: string[]; keySuffix?: string;
}) {
  const { message, deepLink } = notificationContent(input.event, input.classroomId, input.assignmentId);
  const recipients = input.recipientIds ?? (await client.query<{ user_id: string }>(`SELECT m.user_id
    FROM classroom_member m JOIN app_user u ON u.id=m.user_id
    WHERE m.classroom_id=$1 AND m.role='STUDENT' AND m.membership_status='ACTIVE'
      AND u.status='ACTIVE'`, [input.classroomId])).rows.map(row => row.user_id);
  let inserted = 0;
  for (const recipient of new Set(recipients)) {
    const key = [input.assignmentId, input.generation, input.event,
      input.keySuffix ?? "", recipient].join(":");
    const result = await client.query(`INSERT INTO app_notification
      (id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (dedupe_key) DO NOTHING`,
    [randomUUID(), recipient, input.assignmentId, input.generation, input.event, key,
      message, deepLink]);
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

export async function listNotifications(actor: FullActor) {
  const result = await databasePool().query<{ id: string; event_type: NotificationEvent;
    message: string; deep_link: string; created_at: Date; read_at: Date | null }>(`SELECT n.id,n.event_type,n.message,n.deep_link,n.created_at,n.read_at
    FROM app_notification n JOIN assignment a ON a.id=n.assignment_id
    JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=c.id AND m.user_id=n.recipient_user_id
    WHERE n.recipient_user_id=$1 AND (m.role='STUDENT' OR m.role='OWNER' AND n.event_type='FINALIZE_REVIEW_REQUIRED') AND m.membership_status='ACTIVE'
      AND c.status='ACTIVE' AND a.status IN ('OPEN','CLOSED','FINALIZED')
      AND n.generation=a.generation
      AND (n.event_type<>'SCORE_FINALIZED' OR a.status='FINALIZED')
      AND (cardinality(c.allowed_email_domains)=0 OR $2::text=ANY(c.allowed_email_domains))
    ORDER BY n.created_at DESC,n.id DESC LIMIT 100`, [actor.id, actor.hostedDomain]);
  return result.rows.map(row => ({ id: row.id, event: row.event_type, message: row.message,
    deepLink: row.deep_link, createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null }));
}

export async function markNotificationRead(actor: FullActor, id: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return false;
  const result = await databasePool().query(`UPDATE app_notification n SET read_at=COALESCE(read_at,now())
    FROM assignment a JOIN classroom c ON c.id=a.classroom_id
    JOIN classroom_member m ON m.classroom_id=c.id
    WHERE n.id=$1 AND n.assignment_id=a.id AND n.recipient_user_id=$2
      AND m.user_id=$2 AND (m.role='STUDENT' OR m.role='OWNER' AND n.event_type='FINALIZE_REVIEW_REQUIRED') AND m.membership_status='ACTIVE'
      AND c.status='ACTIVE' AND a.status IN ('OPEN','CLOSED','FINALIZED')
      AND n.generation=a.generation
      AND (n.event_type<>'SCORE_FINALIZED' OR a.status='FINALIZED')
      AND (cardinality(c.allowed_email_domains)=0 OR $3::text=ANY(c.allowed_email_domains))`,
  [id, actor.id, actor.hostedDomain]);
  return result.rowCount === 1;
}
