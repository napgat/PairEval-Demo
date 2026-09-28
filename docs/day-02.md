# วัน/ช่วงงาน: วันที่ 2 ของแผน — 28 กันยายน 2026

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | พฤติกรรมที่ตรวจได้ |
|---|---|---|
| Demo access และสิทธิ์จัดการ | เสร็จสำหรับ Demo | เลือกบัญชีตัวอย่างแล้วได้ session; student/anonymous เรียก API จัดการไม่ได้; ยังไม่ใช่ auth จริง |
| Classroom + CSV import | เสร็จ | ผู้สอน preview CSV, เห็นแถว/กลุ่ม, สร้างห้องพร้อมสมาชิกแบบ transaction; CSV ผิดปฏิเสธทั้งไฟล์ |
| Assignment form | เสร็จ | สร้างงานและเปิดรายละเอียดซ้ำได้; คะแนนย่อย, criteria 100%, deadline ถูกตรวจที่ server |
| Pairing Group/Individual | ยังไม่เริ่ม | หน้าสถานะระบุว่าไม่เคยคำนวณ coverage |
| Evaluation, Scoring, Report, CSV export | ยังไม่เริ่ม | หน้าจอเปิดได้แต่ระบุว่ายังไม่มี submission/คะแนน |
| P1 | ยังไม่เริ่ม | หน้า P1 ติดป้าย “ยังไม่เปิดใช้งานใน Demo” |

## สิ่งที่เปลี่ยน

- `src/lib/classroom-input.ts`: parser CSV รองรับ BOM, CRLF, quoted fields และข้อผิดพลาดตามแถว; ตรวจ header, email ซ้ำ, group ว่าง และจำกัด 200 คน ใช้เฉพาะอีเมล `.invalid` เพื่อคงข้อมูลสังเคราะห์
- `src/app/api/classrooms/{preview,route.ts}`: preview แบบไม่เขียนฐานข้อมูลและสร้าง Classroom/Group/Membership/User ภายใน transaction เดียว ตรวจ CSV ซ้ำก่อนบันทึก
- `src/lib/assignment-input.ts`, `src/app/api/assignments/route.ts`: ตรวจคะแนนรวมกับคะแนนส่วนย่อย, น้ำหนัก criteria แยก Group/Individual รวม 100%, ชื่อซ้ำและ deadline ก่อนสร้างงานกับเกณฑ์ใน transaction
- `src/app/api/demo/session/route.ts`, `src/lib/demo-session.ts`: session token ของบัญชีตัวอย่างและการตรวจบทบาทสำหรับหน้า/API ที่จัดการข้อมูล
- `src/app/demo/components/*` และหน้า Demo: เพิ่มฟอร์ม, ปุ่มนำทาง, preview, ข้อความผิดพลาด และแสดงข้อมูลที่บันทึกจาก SQLite แทนค่าในหน้า
- `examples/roster-*.csv`: CSV สังเคราะห์ที่ถูก/ผิดสำหรับลองกรอกจริง
- `scripts/seed.mjs`: เพิ่มตาราง session โดย seed/reset ยังเริ่มจากข้อมูลเดิม

## วิธีตรวจ

1. `npm run seed:reset`, `npm run build`, `npm run start -- -p 3100`
2. เปิด `http://localhost:3100`, เข้า Demo ผู้สอน, เลือก “สร้างห้อง + CSV”, วาง CSV สังเคราะห์ 2 คน / 2 กลุ่ม, preview แล้วบันทึก; กลับมาเปิดรายชื่อ/กลุ่มเห็น 2 คนใน 2 กลุ่ม (`examples/roster-valid.csv` เป็นไฟล์ตัวอย่าง 21 คนสำหรับทดลองต่อ)
3. จากหน้าห้องกด “สร้างงาน”, กรอกคะแนนรวม 20, Group 15, Individual 5 และ criteria 100% ในแต่ละส่วน; กดสร้างและเปิดรายละเอียดงานซ้ำได้
4. ลอง CSV ซ้ำจาก `examples/roster-invalid.csv` และเกณฑ์ Group 90%; ระบบแจ้งเหตุผลและไม่มีข้อมูลบางส่วนถูกบันทึก
5. ตรวจอัตโนมัติด้วย `npm test`, `node scripts/day2-smoke.mjs`, `node scripts/day2-browser.mjs`; หลังตรวจหยุด server แล้ว `npm run seed:reset` กลับเป็นชุดเริ่มต้น

## ผลทดสอบ

| ชุดตรวจ | ผ่าน | ไม่ผ่าน | ข้อสังเกต |
|---|---:|---:|---|
| Unit validation (Vitest) | 8 | 0 | CSV, อีเมลซ้ำ, รูปแบบผิด, คะแนน, น้ำหนัก, deadline |
| Integration HTTP + SQLite | 16 | 0 | student/anonymous 403, preview, rollback, สร้างห้อง/งาน, เปิดหน้าซ้ำ |
| Browser flow (Playwright Chromium) | 1 | 0 | คลิก CSV preview → สร้างห้อง → น้ำหนัก 90% ถูกปฏิเสธ → แก้ 100% แล้วสร้างงาน |
| Build / typecheck / lint | 3 | 0 | build และ typecheck ผ่าน, lint ไม่มี warning |
| Pairing/Scoring E2E | 0 | 0 | ยังไม่ใช่งานวันที่ 2 |

ผล API ทดสอบการ rollback โดยให้แถวหลังใช้อีเมลผู้สอน เมื่อพบ conflict จำนวนห้องและผู้ใช้ยังเท่าเดิม ยืนยันว่าไม่เกิด import ครึ่งชุด หลังทดสอบรีเซ็ตฐานข้อมูลกลับเป็น 2 ห้อง, 5 กลุ่ม, 25 นักศึกษา, 2 งาน และ 0 คู่

## ข้อจำกัด/ความเสี่ยง

- ทุกคนยังเลือกบัญชีผู้สอนตัวอย่างที่หน้าแรกได้ session แยกสิทธิ์คำสั่งระหว่างบทบาท แต่ไม่ใช่ Google OAuth หรือระบบยืนยันตัวตนสำหรับคะแนนจริง
- การนำเข้าอนุญาตเฉพาะ `.invalid` เพื่อป้องกันรายชื่อจริง จึงยังไม่รองรับ CSV ของชั้นเรียนจริง
- หน้างานยังไม่มีการแก้ไข/ลบงาน ส่วน pairing, evaluation, scoring และ export ยังไม่ทำ จึงไม่มีคะแนนคงที่แอบแสดงเป็นผลจริง
- SQLite เป็นฐานข้อมูลเครื่องเดียวสำหรับ Demo; ยังไม่มีการ deploy หรือ remote ของรีโปนี้
- Lab 07 ยังอยู่ branch `codex/lab-07-performance` พร้อมไฟล์เอกสารที่แก้ค้างเดิม ไม่มีการแก้โค้ด, submodule pointer, PR หรือ deployment ของ Lab

## งานถัดไป

1. วันที่ 3: ทำ Pairing Engine แยก Group/Individual พร้อมตรวจ evaluator eligibility และ no self-evaluation
2. ทำ preview แสดงจำนวนคู่ target/actual coverage และเหตุผล infeasible ก่อนบันทึกคู่
3. เพิ่ม unit tests กฎจับคู่และทดสอบชุด feasible/infeasible จาก seed รวมถึงห้องที่นำเข้าใหม่
