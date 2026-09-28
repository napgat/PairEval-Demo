export type RosterRow = { line: number; email: string; groupname: string };
export type RosterPreview = { rows: RosterRow[]; errors: string[]; groups: string[] };

function splitCsv(input: string): { fields: string[]; line: number }[] | string {
  const text = input.replace(/^\uFEFF/, "");
  const records: { fields: string[]; line: number }[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else { field += char; if (char === "\n") line++; }
    } else if (char === '"') {
      if (field.length > 0 || closedQuote) return `แถว ${recordLine}: เครื่องหมายคำพูดใน CSV ไม่ถูกต้อง`;
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      fields.push(field);
      field = "";
      closedQuote = false;
      if (char !== ",") {
        if (fields.some(value => value.trim() !== "")) records.push({ fields, line: recordLine });
        fields = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
        line++;
        recordLine = line;
      }
    } else {
      if (closedQuote) return `แถว ${recordLine}: มีข้อความหลังเครื่องหมายคำพูดปิด`;
      field += char;
    }
  }
  if (quoted) return `แถว ${recordLine}: เครื่องหมายคำพูดไม่ปิด`;
  fields.push(field);
  if (fields.some(value => value.trim() !== "")) records.push({ fields, line: recordLine });
  return records;
}

export function previewRosterCsv(csv: unknown): RosterPreview {
  if (typeof csv !== "string" || csv.trim() === "") return { rows: [], errors: ["กรุณาเลือกไฟล์ CSV"], groups: [] };
  if (Buffer.byteLength(csv, "utf8") > 128 * 1024) return { rows: [], errors: ["ไฟล์ CSV ต้องไม่เกิน 128 KB"], groups: [] };
  const records = splitCsv(csv);
  if (typeof records === "string") return { rows: [], errors: [records], groups: [] };
  const header = records.shift();
  if (!header || header.fields.length !== 2 || header.fields[0].trim().toLowerCase() !== "email" || header.fields[1].trim().toLowerCase() !== "groupname") {
    return { rows: [], errors: ["แถว 1: หัวตารางต้องเป็น email,groupname ตามลำดับ"], groups: [] };
  }
  const errors: string[] = [];
  const rows: RosterRow[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (record.fields.length !== 2) { errors.push(`แถว ${record.line}: ต้องมี 2 คอลัมน์ email,groupname`); continue; }
    const email = record.fields[0].trim().toLowerCase();
    const groupname = record.fields[1].trim();
    if (!/^[^\s@,]+@[^\s@,]+\.invalid$/i.test(email)) errors.push(`แถว ${record.line}: อีเมลต้องเป็นข้อมูลสังเคราะห์ลงท้าย .invalid`);
    if (!groupname || groupname.length > 80) errors.push(`แถว ${record.line}: ชื่อกลุ่มต้องมี 1–80 ตัวอักษร`);
    if (seen.has(email)) errors.push(`แถว ${record.line}: อีเมล ${email} ซ้ำในไฟล์`);
    seen.add(email);
    rows.push({ line: record.line, email, groupname });
  }
  if (!rows.length) errors.push("CSV ต้องมีรายชื่อนักศึกษาอย่างน้อย 1 คน");
  if (rows.length > 200) errors.push("CSV รองรับได้ไม่เกิน 200 คนต่อห้อง");
  return { rows: errors.length ? [] : rows, errors, groups: errors.length ? [] : [...new Set(rows.map(row => row.groupname))] };
}

export function validateClassroomName(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 120) return "ชื่อห้องต้องมี 2–120 ตัวอักษร";
  return null;
}
