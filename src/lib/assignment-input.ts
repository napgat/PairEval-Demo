export type CriterionInput = { name: string; weightPercent: number };
export type AssignmentInput = {
  classroomId: string; name: string; totalScore: number; groupMax: number; individualMax: number;
  groupDeadline: string; individualDeadline: string;
  groupCriteria: CriterionInput[]; individualCriteria: CriterionInput[];
};

export function validateAssignment(input: unknown, now = Date.now()): { value: AssignmentInput | null; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { value: null, errors: ["ข้อมูล Assignment ไม่ถูกต้อง"] };
  const raw = input as Record<string, unknown>;
  const text = (key: string) => typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
  const number = (key: string) => typeof raw[key] === "number" && Number.isFinite(raw[key]) ? raw[key] as number : NaN;
  const classroomId = text("classroomId");
  const name = text("name");
  const totalScore = number("totalScore");
  const groupMax = number("groupMax");
  const individualMax = number("individualMax");
  const groupDeadline = text("groupDeadline");
  const individualDeadline = text("individualDeadline");
  if (!classroomId) errors.push("กรุณาเลือกห้องเรียน");
  if (name.length < 2 || name.length > 120) errors.push("ชื่องานต้องมี 2–120 ตัวอักษร");
  if (!(totalScore > 0)) errors.push("คะแนนรวมต้องมากกว่า 0");
  if (!(groupMax > 0) || !(individualMax > 0)) errors.push("คะแนน Group และ Individual ต้องมากกว่า 0 ทั้งคู่");
  if (Number.isFinite(totalScore) && Number.isFinite(groupMax) && Number.isFinite(individualMax) && Math.abs(groupMax + individualMax - totalScore) > 0.000001) errors.push("คะแนน Group + Individual ต้องเท่ากับคะแนนรวม");
  const validateDeadline = (value: string, label: string) => {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || timestamp <= now) errors.push(`${label} ต้องเป็นวันที่ในอนาคต`);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
  };
  const groupDeadlineIso = validateDeadline(groupDeadline, "กำหนดส่ง Group");
  const individualDeadlineIso = validateDeadline(individualDeadline, "กำหนดส่ง Individual");
  function criteria(key: string, label: string): CriterionInput[] {
    const source = raw[key];
    if (!Array.isArray(source) || source.length === 0) { errors.push(`${label} ต้องมีเกณฑ์อย่างน้อย 1 ข้อ`); return []; }
    if (source.length > 20) errors.push(`${label} มีเกณฑ์ได้ไม่เกิน 20 ข้อ`);
    const items = source.map((item: unknown, index: number) => {
      const criterion = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
      const criterionName = typeof criterion.name === "string" ? criterion.name.trim() : "";
      const weightPercent = typeof criterion.weightPercent === "number" ? criterion.weightPercent : NaN;
      if (!criterionName || criterionName.length > 100) errors.push(`${label} ข้อ ${index + 1}: ชื่อเกณฑ์ต้องมี 1–100 ตัวอักษร`);
      if (!Number.isFinite(weightPercent) || weightPercent <= 0 || weightPercent > 100) errors.push(`${label} ข้อ ${index + 1}: น้ำหนักต้องมากกว่า 0 และไม่เกิน 100%`);
      return { name: criterionName, weightPercent };
    });
    const names = items.map(item => item.name.toLowerCase());
    if (new Set(names).size !== names.length) errors.push(`${label}: ชื่อเกณฑ์ซ้ำ`);
    if (items.every(item => Number.isFinite(item.weightPercent)) && Math.abs(items.reduce((sum, item) => sum + item.weightPercent, 0) - 100) > 0.000001) errors.push(`${label}: น้ำหนักรวมต้องเท่ากับ 100%`);
    return items;
  }
  const groupCriteria = criteria("groupCriteria", "เกณฑ์ Group");
  const individualCriteria = criteria("individualCriteria", "เกณฑ์ Individual");
  return { value: errors.length ? null : { classroomId, name, totalScore, groupMax, individualMax, groupDeadline: groupDeadlineIso, individualDeadline: individualDeadlineIso, groupCriteria, individualCriteria }, errors };
}
