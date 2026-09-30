import { type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { AssignmentConflictError } from "@/lib/full-system-assignments";
import { pseudonymousRawExport } from "@/lib/full-system-score-runs";

export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (body.includeIdentities !== false) {
      throw new AssignmentConflictError("Evaluator identity export awaits policy approval");
    }
    const file = await pseudonymousRawExport(auth.actor, (await context.params).id);
    return new Response(new TextEncoder().encode(file.csv), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store" } });
  } catch (error) { return assignmentError(error); }
}
