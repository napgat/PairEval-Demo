import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { AssignmentInputError, AssignmentNotFoundError } from "@/lib/full-system-assignments";
import { databasePool } from "@/lib/full-system-postgres";
import { domainAllowed } from "@/lib/full-system-auth";
import { readAuditTimeline } from "@/lib/full-system-audit";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try {
    const id = (await context.params).id;
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
      throw new AssignmentInputError("Invalid assignment ID");
    }
    const result = await databasePool().query<{ classroom_id: string; allowed_email_domains: string[] }>(
      `SELECT a.classroom_id,c.allowed_email_domains FROM assignment a
       JOIN classroom c ON c.id=a.classroom_id JOIN classroom_member m ON m.classroom_id=c.id
       WHERE a.id=$1 AND c.status='ACTIVE' AND m.user_id=$2
         AND m.role IN ('OWNER','CO_TEACHER') AND m.membership_status='ACTIVE'`,
    [id, auth.actor.id]);
    const row = result.rows[0];
    if (!row || !domainAllowed(auth.actor.hostedDomain, row.allowed_email_domains)) {
      throw new AssignmentNotFoundError("Audit not found");
    }
    return NextResponse.json({ data: await readAuditTimeline(row.classroom_id) });
  } catch (error) { return assignmentError(error); }
}
