import type { FullActor } from "./full-system-auth";
import { databasePool } from "./full-system-postgres";
import { editorScope, type ScoreRun } from "./full-system-score-runs";
type History = {
  name: string;
  side: string;
  value: number | null;
  assignmentId: string;
};
export function repeatedLowAgreement(
  history: History[],
): Array<{ criterion: string; side: string; assignments: number }> {
  const keys = [
      ...new Set(
        history.map((r) => `${r.side}:${r.name.trim().toLowerCase()}`),
      ),
    ],
    output = [];
  for (const key of keys) {
    const rows = history.filter(
      (r) => `${r.side}:${r.name.trim().toLowerCase()}` === key,
    );
    let low = 0;
    for (const r of rows) {
      if (r.value === null || r.value >= 0.2) break;
      low++;
    }
    if (low >= 2)
      output.push({
        criterion: rows[0].name,
        side: rows[0].side,
        assignments: low,
      });
  }
  return output;
}
export async function criterionQualityFeedback(actor: FullActor, id: string) {
  const client = await databasePool().connect();
  try {
    const scope = await editorScope(client, actor, id);
    const snapshots = await client.query<{
      assignment_id: string;
      output_json: ScoreRun;
      input_json: { criteria: Array<{ id: string; name: string }> };
    }>(
      `SELECT DISTINCT ON (a.id) a.id AS assignment_id,s.output_json,s.input_json FROM assignment a JOIN score_snapshot s ON s.assignment_id=a.id AND s.generation=a.generation WHERE a.classroom_id=$1 ORDER BY a.id,s.snapshot_no DESC`,
      [scope.classroom_id],
    );
    const dates = await client.query<{ id: string; created_at: Date }>(
      "SELECT id,created_at FROM assignment WHERE classroom_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10",
      [scope.classroom_id],
    );
    const history: History[] = [];
    for (const a of dates.rows) {
      const s = snapshots.rows.find((s) => s.assignment_id === a.id);
      if (!s) continue;
      for (const c of s.input_json.criteria) {
        const measures =
          s.output_json.quality?.measures.filter(
            (m) => m.id === "QS-07" && m.criterionId === c.id,
          ) ?? [];
        const measured = measures.filter((m) => m.ratio !== null);
        history.push({
          assignmentId: a.id,
          name: c.name,
          side: measures[0]?.side ?? "GROUP",
          value: measured.length
            ? Math.min(...measured.map((m) => m.ratio!))
            : null,
        });
      }
    }
    return repeatedLowAgreement(history);
  } finally {
    client.release();
  }
}
