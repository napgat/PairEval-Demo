import { describe, expect, it } from "vitest";
import { assembleScoreRun } from "./full-system-score-runs";
import { reportCsv, reportRows, reportWorkbook, safeExportCell, validateExport } from "./full-system-score-export";

const base = () => ({ assignmentId: "00000000-0000-4000-8000-000000000001", generation: 1,
  kind: "INTERIM" as const, formulaVersion: "v2.1",
  settings: { groupMax: 15, individualMax: 5, floor: .6, ceiling: 1,
    minComparisons: 3, kMin: 3, completionThreshold: .9 },
  groups: [{ id: "g1", name: "=Unsafe" }, { id: "g2", name: "G2" }],
  students: [{ id: "s1", group_id: "g1", display_name: "-Unsafe" },
    { id: "s2", group_id: "g2", display_name: "Student 2" }],
  criteria: [{ id: "c1", side: "GROUP" as const, name: "Group", weight_pct: "100" },
    { id: "c2", side: "INDIVIDUAL" as const, name: "Individual", weight_pct: "100" }],
  pairs: [{ id: "p1", criterionId: "c1", side: "GROUP" as const,
    aId: "g1", bId: "g2", displayLeft: "A" as "A" | "B", evaluatorId: "s1" },
    { id: "p2", criterionId: "c2", side: "INDIVIDUAL" as const,
      aId: "s1", bId: "s2", displayLeft: "A" as const, evaluatorId: "s2" }],
  answers: [{ pairId: "p1", choice: 1, evaluatorId: "s1", weight: 1 },
    { pairId: "p2", choice: 6, evaluatorId: "s2", weight: 1 }],
  overrides: [] as Array<{ id: string; side: "GROUP" | "INDIVIDUAL"; item_id: string;
    override_value: string; reason: string }> });

describe("Day 5 score decisions and export", () => {
  it("uses submitted comparisons, participation, and immutable override input", () => {
    const run = assembleScoreRun(base());
    expect(run.groups.map(g => g.component)).toEqual([15, 9]);
    expect(run.students[0].individualComponent).toBe(3);
    expect(run.students[0].M).toBe(1);
    expect(run.students[0].total).toBe(18);
    expect(run.students[0].flags).toContain("BELOW_K");
    const changed = base();
    changed.overrides.push({ id: "o1", side: "GROUP", item_id: "g1",
      override_value: "12.5000", reason: "Instructor reviewed artifact" });
    const overridden = assembleScoreRun(changed);
    expect(overridden.students[0].groupComponent).toBe(12.5);
    expect(overridden.students[0].total).toBe(15.5);
    expect(overridden.groups[0].flags).toContain("OVERRIDDEN");
    expect(run.groups[0].component).toBe(15);
  });
  it("escapes spreadsheet formulas and emits UTF-8 BOM CSV", () => {
    const run = assembleScoreRun(base());
    expect(safeExportCell(" =2+2")).toBe("' =2+2");
    expect(safeExportCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeExportCell(-1)).toBe(-1);
    const csv = reportCsv(run, "group");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=Unsafe");
    expect(reportRows(run, "coverage")).toHaveLength(3);
    expect(() => validateExport("xlsx", "group", true)).toThrow();
  });
  it("aggregates coverage and weighted mean for the same logical pair", () => {
    const input = base();
    input.pairs.push({ id: "p3", criterionId: "c1", side: "GROUP", aId: "g1", bId: "g2",
      evaluatorId: "s2", displayLeft: "B" });
    input.answers.push({ pairId: "p3", choice: 1, evaluatorId: "s2", weight: 0.5 });
    const run = assembleScoreRun(input);
    expect(run.pairSummary).toHaveLength(2);
    expect(run.pairSummary[0]).toMatchObject({ assigned: 2, answered: 2, meanForA: 0.6667 });
    expect(reportRows(run, "coverage")[1]).toEqual([
      "GROUP", "c1", "g1", "g2", 2, 2, 0.6667, 0]);
  });
  it("keeps earlier snapshots exportable before pair aggregation existed", () => {
    const earlier = assembleScoreRun(base());
    delete (earlier as Partial<typeof earlier>).pairSummary;
    expect(reportRows(earlier, "coverage")[0]).toEqual([
      "Pair ID", "Side", "Criterion ID", "Submitted"]);
  });
  it("excludes a reviewed answer from scores and k while retaining participation and evidence", () => {
    const input = base();
    const original = JSON.stringify(input);
    const previous = assembleScoreRun(input);
    const reviewed = assembleScoreRun({ ...input, answers: input.answers.map(a => ({ ...a,
      excluded: a.pairId === "p2", exclusionReason: a.pairId === "p2" ? "Instructor reviewed artifact" : undefined })) });
    expect(reviewed.students[0].individualComponent).toBeNull();
    expect(reviewed.students[1]).toMatchObject({ answered: 1, assigned: 1, p: 1, M: 1 });
    expect(reviewed.students[0].criteria[0].comparisons).toBe(0);
    expect(reviewed.pairSummary[1]).toMatchObject({ answered: 1, excluded: 1, meanForA: null });
    expect(reviewed.exclusions).toEqual([{ pairId: "p2", side: "INDIVIDUAL", criterionId: "c2", reason: "Instructor reviewed artifact" }]);
    expect(reviewed.quality).toEqual(previous.quality);
    expect(reportCsv(reviewed, "quality")).toContain("INSTRUCTOR_DECISION");
    expect(previous.students[0].individualComponent).toBe(3);
    expect(JSON.stringify(input)).toBe(original);
  });
  it("exports advisory signal evidence and preserves scores without automatic penalties", async () => {
    const run = assembleScoreRun(base());
    expect(run.groups[0].component).toBe(15);
    expect(run.quality?.measures.find(row => row.id === "QS-02"))?.toMatchObject({ flagged: true, total: 1 });
    const csv = reportCsv(run, "quality");
    expect(csv).toContain("Evaluator 001");
    expect(csv).toContain("QS-04");
    expect(csv).toContain("NOT_ASSESSABLE");
    const earlier = structuredClone(run);
    delete earlier.quality;
    expect(reportRows(earlier, "quality")[0]).toEqual(["Side", "Item ID", "Flag", "Suggested action"]);
    const bytes = await reportWorkbook(run, { snapshotNo: 1, inputHash: "f".repeat(64), createdAt: "2026-09-30T00:00:00Z" });
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.default.Workbook();
    await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
    expect(book.worksheets).toHaveLength(4);
    expect(JSON.stringify(book.getWorksheet("Metadata")?.getSheetValues())).toContain("QS-02");
  });
  it("writes exactly four XLSX sheets with the formula version", async () => {
    const run = assembleScoreRun(base());
    const bytes = await reportWorkbook(run, { snapshotNo: 2, inputHash: "f".repeat(64),
      createdAt: "2026-09-29T00:00:00.000Z" });
    expect(bytes.subarray(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.default.Workbook();
    await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
    expect(book.worksheets.map(sheet => sheet.name)).toEqual([
      "Group Summary", "Individual Summary", "Pair Coverage", "Metadata"]);
    expect(book.getWorksheet("Metadata")?.getCell("B5").value).toBe("v2.1");
    expect(book.getWorksheet("Group Summary")?.getCell("A2").value).toBe("'=Unsafe");
  });
});
