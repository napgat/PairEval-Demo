import { NextResponse, type NextRequest } from "next/server";
import { actorForRequest, sameOrigin } from "@/lib/full-system-auth";
import { NOTICE_VERSION } from "@/lib/full-system-notice-version";
import { acknowledgeStagingNotice } from "@/lib/full-system-privacy-notice";
import { AuditOutcomePendingError, AuditUnavailableError } from "@/lib/full-system-audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_INVALID" } }, { status: 403 });
  const actor = await actorForRequest(request);
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const body = await request.json().catch(() => null) as { noticeVersion?: unknown } | null;
  if (body?.noticeVersion !== NOTICE_VERSION) {
    return NextResponse.json({ error: { code: "NOTICE_VERSION_INVALID" } }, { status: 422 });
  }
  try {
    await acknowledgeStagingNotice(actor);
    return NextResponse.json({ data: { noticeVersion: NOTICE_VERSION, acknowledged: true } });
  } catch (error) {
    if (error instanceof AuditOutcomePendingError) return NextResponse.json(
      { error: { code: "AUDIT_PENDING", requestId: error.requestId } }, { status: 202 });
    if (error instanceof AuditUnavailableError) return NextResponse.json(
      { error: { code: "AUDIT_UNAVAILABLE" } }, { status: 503 });
    return NextResponse.json({ error: { code: "NOTICE_ACKNOWLEDGEMENT_FAILED" } }, { status: 500 });
  }
}
