# วัน/ช่วงงาน: วันที่ 4 ของแผน — 28 กันยายน 2026

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | พฤติกรรมที่ตรวจได้ |
|---|---|---|
| Classroom, Assignment, Pairing | เสร็จตามขอบเขตเดโมถึงวันที่ 3 | งานวันที่ 3 ถูก commit เป็น `496ff96` ใน PairEval-Demo ก่อนเริ่มวันที่ 4 |
| Group Evaluation | เสร็จ | แสดงเฉพาะคู่ Group ของ session นักศึกษา; เลือก 1–6, Save draft, Submit/Re-submit ได้ |
| Individual Evaluation | เสร็จ | แสดงเฉพาะคู่ Individual ของ session เดียวกัน; draft, revision, deadline แยกจาก Group |
| Draft persistence | เสร็จ | Save แล้ว refresh หรือสลับหน้า กลับมาเห็นคำตอบที่บันทึกไว้ |
| Submission revisions | เสร็จ | Submit ได้ revision 1, Re-submit ได้ revision 2 โดย revision 1 ไม่ถูกแก้ |
| Session/ownership/deadline | เสร็จสำหรับ Demo | API ตรวจ student session, assignment membership, pair owner/kind และ deadline ทุกครั้งที่อ่านหรือเขียน; หลัง deadline อ่านได้แต่เขียนไม่ได้ |
| Scoring, Report, My score, CSV export | ยังไม่เริ่ม | ยังไม่มีคะแนนคำนวณหรือไฟล์ส่งออก |
| P1 | ยังไม่เริ่ม | ยังมีป้าย “ยังไม่เปิดใช้งานใน Demo” |

## สิ่งที่เปลี่ยน

- สร้าง commit `496ff96 feat: add atomic group and individual pairing` ใน **PairEval-Demo เท่านั้น** ก่อนเริ่มวันที่ 4; ไม่มี remote และไม่ได้แก้ Lab 07
- `scripts/seed.mjs`: เพิ่ม `revision_number` และ unique constraint ต่อ assignment/evaluator/kind เพื่อแยก revision ชัดเจน
- `src/lib/evaluation-store.ts`: โหลดเฉพาะคู่ของ evaluator ที่เข้าสู่ระบบ, อ่าน draft หรือ submission ล่าสุด, Save draft แบบ snapshot, Submit revision ใหม่และเก็บ answer snapshot; ตรวจ deadline/สิทธิ์ก่อนเขียนใน transaction
- `src/app/api/assignments/[id]/evaluation/[kind]/route.ts`: GET เฉพาะคู่ของตน, PUT Save draft, POST Submit; ส่งข้อมูล `no-store` และปฏิเสธ anonymous/instructor/ต่างห้อง/คู่คนอื่น
- `src/app/demo/components/evaluation-panel.tsx`: หน้า Group/Individual จากคู่จริง, radio 1–6, progress รายเกณฑ์, deadline/countdown, คำเตือนเมื่อยังตอบไม่ครบ, เวลาที่ Save/Submit ล่าสุด และปุ่ม Re-submit
- หน้า assignment ของนักศึกษาเชื่อมไป Evaluation ทั้งสองชนิด; หลัง API บันทึก หน้าเรียก refresh เพื่ออ่านข้อมูล server ใหม่
- `scripts/day4-smoke.mjs` และ `scripts/day4-browser.mjs`: ชุดตรวจ API/ฐานข้อมูลและการคลิกหน้าเว็บจริง

## วิธีตรวจ

1. รัน `npm run seed:reset`, `npm test`, `npm run lint`, `npm run build`, `npm run start -- -p 3100`
2. อีก terminal รัน `node scripts/day4-smoke.mjs`: สร้างคู่, ใช้ student session อ่านคู่ Group/Individual, Save draft, GET ใหม่, Submit, Re-submit, ตรวจ revision เก่า และเปลี่ยน deadline ใน DB เพื่อทดสอบการปิดรับ
3. หยุด server, reset, เปิด server ใหม่ แล้วรัน `node scripts/day4-browser.mjs`: คลิกคู่จริง, Save draft, refresh, สลับ Group/Individual, Submit และ Re-submit แล้ว refresh อีกครั้ง
4. หยุด server และ `npm run seed:reset` หลังจบ ตอนนี้ฐานข้อมูลกลับเป็น 2 ห้อง, 5 กลุ่ม, 25 นักศึกษา, 2 งาน, 0 คู่และ 0 submission

## ผลทดสอบ

| ชุดตรวจ | ผ่าน | ไม่ผ่าน | ผลจริง |
|---|---:|---:|---|
| Unit validation/Pairing เดิม (Vitest) | 12 | 0 | ผ่านทั้งหมดหลังเพิ่ม schema และหน้า Evaluation |
| HTTP + SQLite integration วันที่ 4 | 27 | 0 | draft, revisions, session, foreign pair, kind, deadline, Group/Individual แยกกัน |
| Browser flow (Playwright Chromium) รอบสุดท้าย | 1 | 0 | draft อยู่หลัง refresh/switch, Group revision 1→2, Individual revision 1 |
| Build และ lint | 2 | 0 | Next.js build รวม typecheck ผ่าน; lint ไม่มี warning |

browser test รอบแรกตรวจ radio ก่อน client navigation ไปอีกหน้าจะเสร็จ จึงได้ผลล้มเหลวจากการทดสอบเอง หลังเพิ่มการรอหัวข้อของหน้าปลายทางและ refresh ข้อมูลหลังบันทึก รันจาก seed ใหม่ผ่านทั้ง flow ไม่มีข้อผิดพลาดของแอปที่ค้างจากกรณีนั้น

## ข้อจำกัด/ความเสี่ยง

- ทุกคนยังเลือกบัญชีผู้สอนตัวอย่างได้จากหน้าแรก จึงยังไม่ใช่ระบบยืนยันตัวตนสำหรับข้อมูลจริง
- คะแนนยังไม่คำนวณจาก submission; draft ไม่นับเป็นคะแนนและ partial credit จะทำวันที่ 5
- Demo ใช้ student session ตัวอย่างเพียง `student-01@demo.invalid` แม้ฐานข้อมูลมีนักศึกษาอื่น; API ตรวจ ownership ของคู่จาก session ปัจจุบันและทดสอบ foreign pair แล้ว
- ยังไม่มีการแก้/ลบ submission เก่าใน UI; การส่งใหม่เพิ่ม revision อย่างเดียว
- Day 4 changes ยังอยู่ใน working tree; ไม่มี remote, PR หรือ deployment ของ PairEval-Demo และ Lab 07 ไม่ถูกแก้

## งานถัดไป

1. วันที่ 5: คำนวณคะแนนจาก submission revision ล่าสุดเท่านั้น รวม Group/Individual criteria weights และ partial completion
2. ทำ Instructor report/coverage และ My score โดยนักศึกษาเห็นเฉพาะคะแนนตน
3. ทำ CSV export และทดสอบสูตรด้วยตัวอย่างที่คำนวณด้วยมือ รวม draft ไม่นับและ Re-submit ใช้ revision ล่าสุด
