import { observeRoute } from "@/lib/observe-route";
import { type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { AssignmentConflictError } from "@/lib/full-system-assignments";
import { pseudonymousRawExport } from "@/lib/full-system-score-runs";
import { identifiedRawExport } from "@/lib/full-system-identity-access";

export const runtime = "nodejs";
async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (typeof body.includeIdentities !== "boolean") throw new AssignmentConflictError("Choose whether to include identities");
    const id = (await context.params).id;
    const file = body.includeIdentities ? await identifiedRawExport(auth.actor, id, body) : await pseudonymousRawExport(auth.actor, id);
    return new Response(new TextEncoder().encode(file.csv), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store" } });
  } catch (error) { return assignmentError(error); }
}

export const POST = observeRoute(POSTHandler);
