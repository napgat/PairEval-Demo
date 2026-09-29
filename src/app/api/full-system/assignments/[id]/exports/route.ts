import { type NextRequest } from "next/server";
import { assignmentActor, assignmentError } from "@/lib/full-system-assignment-http";
import { AssignmentConflictError } from "@/lib/full-system-assignments";
import { reportCsv, reportWorkbook, validateExport } from "@/lib/full-system-score-export";
import { latestScoreRun } from "@/lib/full-system-score-runs";

export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await assignmentActor(request, true); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { format, report } = validateExport(body.format, body.report, body.includeIdentities);
    const snapshot = await latestScoreRun(auth.actor, (await context.params).id);
    if (!snapshot) throw new AssignmentConflictError("Recompute scores before exporting");
    const filename = `${snapshot.classroomSlug}_${snapshot.assignmentSlug}_${report}_${new Date()
      .toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-")}.${format}`;
    const bodyBytes = format === "csv" ? new TextEncoder().encode(reportCsv(snapshot.output, report)) :
      await reportWorkbook(snapshot.output, snapshot);
    return new Response(new Blob([new Uint8Array(bodyBytes)]), { headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" :
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) { return assignmentError(error); }
}
