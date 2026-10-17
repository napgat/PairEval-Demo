import { observeRoute } from "@/lib/observe-route";
import { NextResponse, type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/full-system-notifications";

export const runtime = "nodejs";
async function GETHandler(request: NextRequest) {
  const auth = await assignmentActor(request); if (auth.error) return auth.error;
  try { return NextResponse.json(await listNotifications(auth.actor)); }
  catch (error) { return assignmentError(error); }
}
async function POSTHandler(request: NextRequest) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (body?.all === true && body.id === undefined) {
      return NextResponse.json({ data: { read: true, updatedCount: await markAllNotificationsRead(auth.actor) } });
    }
    if (body?.all !== undefined) return NextResponse.json({ error: { code: "INVALID_ID" } }, { status: 422 });
    if (typeof body?.id !== "string") return NextResponse.json({ error: { code: "INVALID_ID" } }, { status: 422 });
    const read = await markNotificationRead(auth.actor, body.id);
    return read ? NextResponse.json({ data: { read: true } }) :
      NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  } catch (error) { return assignmentError(error); }
}

export const GET = observeRoute(GETHandler);
export const POST = observeRoute(POSTHandler);
