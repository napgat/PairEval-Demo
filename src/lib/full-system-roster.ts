import { normalizeEmail } from "./full-system-auth";

export type FullRosterRow = { line: number; email: string; groupName: string; studentId: string | null; displayName: string };
export type FullRosterPreview = { rows: FullRosterRow[]; errors: string[]; warnings: string[]; groups: string[] };

function recordsForCsv(text: string): { line: number; fields: string[] }[] | string {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = []; let field = ""; let quoted = false; let closed = false;
  let line = 1; let start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else { field += ch; if (ch === "\n") line++; }
    } else if (ch === '"') {
      if (field || closed) return `row ${start}: invalid quote`;
      quoted = true;
    } else if (ch === "," || ch === "\n" || ch === "\r") {
      fields.push(field); field = ""; closed = false;
      if (ch !== ",") {
        if (fields.some(value => value.trim())) records.push({ line: start, fields });
        fields = [];
        if (ch === "\r" && text[i + 1] === "\n") i++;
        line++; start = line;
      }
    } else {
      if (closed) return `row ${start}: text after closing quote`;
      field += ch;
    }
  }
  if (quoted) return `row ${start}: unclosed quote`;
  fields.push(field);
  if (fields.some(value => value.trim())) records.push({ line: start, fields });
  return records;
}

export function previewFullRosterCsv(input: unknown): FullRosterPreview {
  const empty = (errors: string[]): FullRosterPreview => ({ rows: [], errors, warnings: [], groups: [] });
  if (typeof input !== "string" || !input.trim()) return empty(["CSV is required"]);
  if (Buffer.byteLength(input, "utf8") > 128 * 1024) return empty(["CSV exceeds 128 KB"]);
  const parsed = recordsForCsv(input.replace(/^\uFEFF/, ""));
  if (typeof parsed === "string") return empty([parsed]);
  const header = parsed.shift();
  const names = header?.fields.map(field => field.trim().toLowerCase()) ?? [];
  if (names.length < 2 || names.length > 4 || names[0] !== "email" || names[1] !== "group_name" ||
      names.slice(2).some(name => !["student_id", "display_name"].includes(name)) || new Set(names).size !== names.length) {
    return empty(["row 1: expected email,group_name[,student_id][,display_name] header"]);
  }
  const errors: string[] = []; const rows: FullRosterRow[] = [];
  const emails = new Set<string>(); const studentIds = new Set<string>(); const counts = new Map<string, number>();
  for (const record of parsed) {
    if (record.fields.length !== names.length) { errors.push(`row ${record.line}: expected ${names.length} columns`); continue; }
    const values = new Map(names.map((name, index) => [name, record.fields[index].trim()]));
    const email = normalizeEmail(values.get("email") ?? "");
    const groupName = values.get("group_name") ?? "";
    const studentId = values.get("student_id") || null;
    const displayName = values.get("display_name") || email.split("@")[0];
    if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) || email.length > 254) errors.push(`row ${record.line}: invalid email`);
    if (!groupName || groupName.length > 80) errors.push(`row ${record.line}: group_name must be 1–80 characters`);
    if (studentId && studentId.length > 80) errors.push(`row ${record.line}: student_id is too long`);
    if (!displayName || displayName.length > 120) errors.push(`row ${record.line}: display_name must be 1–120 characters`);
    if (emails.has(email)) errors.push(`row ${record.line}: duplicate email`);
    if (studentId && studentIds.has(studentId)) errors.push(`row ${record.line}: duplicate student_id`);
    emails.add(email); if (studentId) studentIds.add(studentId);
    counts.set(groupName, (counts.get(groupName) ?? 0) + 1);
    rows.push({ line: record.line, email, groupName, studentId, displayName });
  }
  if (!rows.length) errors.push("CSV has no students");
  if (rows.length > 200) errors.push("CSV exceeds 200 students");
  if (errors.length) return empty(errors);
  const warnings = [...counts].filter(([, count]) => count < 2).map(([name]) => `group ${name} has fewer than 2 students`);
  return { rows, errors: [], warnings, groups: [...counts.keys()] };
}
