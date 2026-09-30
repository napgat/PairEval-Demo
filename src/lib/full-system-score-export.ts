import ExcelJS from "exceljs";
import { AssignmentConflictError, AssignmentInputError } from "./full-system-assignments";
import type { ScoreRun } from "./full-system-score-runs";

type Cell = string | number | null;
type Report = "group" | "individual" | "coverage" | "quality";
const danger = /^[\s\uFEFF]*[=+\-@]/u;
export function safeExportCell(value: Cell): Cell {
  return typeof value === "string" && danger.test(value) ? `'${value}` : value;
}
const scalar = (value: number | null) => value === null ? "NO_DATA" : Number(value.toFixed(4));

export function reportRows(run: ScoreRun, report: Report): Cell[][] {
  if (report === "group") return [
    ["กลุ่ม", "Criterion", "q", "Comparison count", "Weighted score", "Group total", "Flags"],
    ...run.groups.flatMap(group => group.criteria.map(c => [group.name, c.name,
      scalar(c.q), c.comparisons, scalar(c.weightedScore), scalar(group.component),
      group.flags.join("|")] as Cell[]))];
  if (report === "individual") return [
    ["นักศึกษา", "Criterion", "q", "Comparison count", "Weighted score", "Group score",
      "Individual score", "Answered", "Assigned", "Participation", "Multiplier", "Total", "Flags"],
    ...run.students.flatMap(student => (student.criteria.length ? student.criteria :
      [{ name: "", q: null, comparisons: 0, weightedScore: null }]).map(c => [
      student.displayName, c.name, scalar(c.q), c.comparisons, scalar(c.weightedScore),
      scalar(student.groupComponent), scalar(student.individualComponent), student.answered,
      student.assigned, Number(student.p.toFixed(4)), Number(student.M.toFixed(4)),
      scalar(student.total), student.flags.join("|")] as Cell[]))];
  if (report === "coverage" && !run.pairSummary) return [
    ["Pair ID", "Side", "Criterion ID", "Submitted"],
    ...run.pairCoverage.map(pair => [pair.pairId, pair.side, pair.criterionId,
      pair.answered ? "YES" : "NO"] as Cell[])];
  if (report === "coverage") return [
    ["Side", "Criterion ID", "Item A ID", "Item B ID", "Answered", "Assigned", "Mean for A"],
    ...run.pairSummary.map(pair => [pair.side, pair.criterionId, pair.aId, pair.bId,
      pair.answered, pair.assigned, scalar(pair.meanForA)] as Cell[])];
  if (run.quality) return [["Side", "Subject", "Signal", "Count", "Total", "Ratio",
    "Threshold (strictly greater)", "Review", "Suggested action"],
    ...[...run.groups.map(g => ({ side: "GROUP", id: g.id, flags: g.flags })),
      ...run.students.map(s => ({ side: "INDIVIDUAL", id: s.id, flags: s.flags }))]
      .flatMap(item => item.flags.map(flag => [item.side, item.id, flag, null, null, null,
        null, "REVIEW", "ตรวจข้อมูล/เหตุผลก่อนตัดสินคะแนน"] as Cell[])),
    ...run.quality.measures.map(row => [row.side, row.evaluatorCode, row.id,
      row.count, row.total, row.ratio === null ? "INSUFFICIENT_DATA" : scalar(row.ratio),
      row.threshold, row.ratio === null ? "NOT_ASSESSABLE" : row.flagged ? "REVIEW" : "NO_SIGNAL",
      `${row.criterionId ? `Criterion ${row.criterionId}; ` : ""}ทบทวนด้วยตา; ไม่ลดน้ำหนักอัตโนมัติ`] as Cell[])];
  return [["Side", "Item ID", "Flag", "Suggested action"],
    ...[...run.groups.map(g => ({ side: "GROUP", id: g.id, flags: g.flags })),
      ...run.students.map(s => ({ side: "INDIVIDUAL", id: s.id, flags: s.flags }))]
      .flatMap(item => item.flags.map(flag => [item.side, item.id, flag,
        flag === "LOW_CONFIDENCE" ? "ตรวจจำนวนผู้ประเมิน" : flag === "BELOW_K" ?
          "รอผู้ประเมินส่งเพิ่ม" : flag === "NO_DATA" ? "ตรวจคำตอบที่ส่ง" :
            "ตรวจเหตุผล override"] as Cell[]))];
}

export function reportCsv(run: ScoreRun, report: Report): string {
  return `\uFEFF${reportRows(run, report).map(row => row.map(value => {
    const text = String(safeExportCell(value) ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n")}\r\n`;
}

export async function reportWorkbook(run: ScoreRun, snapshot: { snapshotNo: number;
  inputHash: string; createdAt: string }): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  book.creator = "PairEval";
  for (const [name, report] of [["Group Summary", "group"], ["Individual Summary", "individual"],
    ["Pair Coverage", "coverage"]] as const) {
    const sheet = book.addWorksheet(name);
    for (const row of reportRows(run, report)) sheet.addRow(row.map(safeExportCell));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const meta = book.addWorksheet("Metadata");
  for (const row of [
    ["Assignment ID", run.assignmentId], ["Generation", run.generation],
    ["Snapshot number", snapshot.snapshotNo], ["Kind", run.kind],
    ["Formula version", run.formulaVersion], ["Input SHA-256", snapshot.inputHash],
    ["Created UTC", snapshot.createdAt], ["Score floor", run.settings.floor],
    ["Score ceiling", run.settings.ceiling], ["Group max", run.settings.groupMax],
    ["Individual max", run.settings.individualMax],
    ["Minimum comparisons", run.settings.minComparisons],
    ["Anonymity k", run.settings.kMin],
    ["Completion threshold", run.settings.completionThreshold],
    ["Quality flags", "LOW_CONFIDENCE|BELOW_K|NO_DATA|OVERRIDDEN"]
  ] as Cell[][]) meta.addRow(row.map(safeExportCell));
  if (run.quality) {
    meta.addRow(["Quality signal version", run.quality.version]);
    meta.addRow(["Quality limitations", "QS-05/06/07 not computed; evaluator codes are snapshot-local; advisory only"]);
    meta.addRow([]);
    for (const row of reportRows(run, "quality")) meta.addRow(row.map(safeExportCell));
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}

export function validateExport(format: unknown, report: unknown, includeIdentities: unknown):
    { format: "csv" | "xlsx"; report: Report } {
  if (includeIdentities) throw new AssignmentConflictError("Identity export requires the Owner confirmation flow");
  if (format !== "csv" && format !== "xlsx" ||
      !["group", "individual", "coverage", "quality"].includes(String(report))) {
    throw new AssignmentInputError("Invalid export format or report");
  }
  return { format, report: report as Report };
}
