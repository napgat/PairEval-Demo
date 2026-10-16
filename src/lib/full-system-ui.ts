export const assignmentStatus = (value: string) => ({
  DRAFT: "ฉบับร่าง", OPEN: "เปิดรับการประเมิน", CLOSED: "ปิดรับการประเมิน", FINALIZED: "ประกาศคะแนนแล้ว",
}[value] ?? "งานประเมิน");

export const sideName = (value: string) => value === "GROUP" ? "กลุ่ม" : "รายบุคคล";
export const appealStatus = (value: string) => ({ OPEN: "รออาจารย์พิจารณา", RESOLVED: "พิจารณาแล้ว", REJECTED: "ไม่อนุมัติคำขอ" }[value] ?? value);
export const scoreFlag = (value: string) => ({
  OVERRIDDEN: "ผู้สอนปรับคะแนน", LOW_CONFIDENCE: "จำนวนคำตอบยังน้อย", BELOW_K: "ข้อมูลยังไม่พอเปิดเผยคะแนน",
  INSUFFICIENT_DATA: "ข้อมูลยังไม่เพียงพอ", NO_DATA: "ยังไม่มีคำตอบ", INCOMPLETE: "ยังส่งไม่ครบ",
}[value] ?? value);

export function friendlyError(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "");
  if (/Finalize the current scores before resolving an appeal/i.test(text)) return "กรุณายืนยันผลคะแนนฉบับล่าสุดก่อนตอบกลับหรือปิดคำขอทบทวนคะแนน";
  if (/Wait until both deadlines/i.test(text)) return "ยังยืนยันคะแนนไม่ได้ กรุณารอให้พ้นกำหนดส่งทั้งสองด้านก่อน";
  if (/AUDIT_UNAVAILABLE|audit.*unavailable/i.test(text)) return "ยังยืนยันการบันทึกไม่ได้ กรุณารอสักครู่แล้วโหลดข้อมูลใหม่ก่อนทำรายการซ้ำ";
  if (/UNAUTHENTICATED|SESSION_UNAVAILABLE/i.test(text)) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
  if (/NOT_FOUND|FORBIDDEN|not found|not permitted|not allowed/i.test(text)) return "ไม่พบข้อมูลหรือบัญชีนี้ไม่มีสิทธิ์เข้าถึง กรุณากลับไปเลือกห้องเรียน";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(text)) return "เชื่อมต่อไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง";
  if (/weight.*100/i.test(text)) return "กรุณาตรวจน้ำหนักเกณฑ์ให้รวมเป็น 100% แยกแต่ละด้าน";
  return /[ก-๙]/.test(text) ? text : "ทำรายการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง";
}
