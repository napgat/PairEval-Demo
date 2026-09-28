# วันที่ 5 — Scoring, Report, My Score, CSV

## ตัวอย่างคำนวณด้วยมือ (เขียนก่อน UI)

กำหนดกลุ่ม A, B; Group เต็ม 15 คะแนน มี criterion คุณภาพ 60% และนำเสนอ 40%.
แต่ละ criterion มีคำตอบที่ส่งแล้วหนึ่งครั้ง: คุณภาพเลือก 2 จึงได้ A=0.8, B=0.2;
นำเสนอเลือก 4 จึงได้ A=0.4, B=0.6. แต่ละ item ถูกประเมินหนึ่งครั้ง
ค่าเฉลี่ยจึงเท่ากับแต้มดังกล่าว และผลรวมใน criterion เท่ากับ 1.
คะแนนตั้งต้นของ A = 15 × (0.8 × 0.6 + 0.4 × 0.4) = **9.6**;
B = 15 × (0.2 × 0.6 + 0.6 × 0.4) = **5.4**.
ส่วน Group นี้เป็นตัวอย่างเลขย่อเพื่อเทียบสูตรใน unit test เท่านั้น; Assignment จริงที่มีเพียง
2 กลุ่มจัดคู่แบบห้ามประเมินกลุ่มตนเองไม่ได้ และ Pairing Engine จะปฏิเสธ ไม่ใช่ข้อมูลเดโมที่สร้างคู่ผ่าน

Individual ของกลุ่ม A มีนักศึกษา A1, A2, A3; criterion เดียวหนัก 100%, เต็ม 5.
คู่ A1–A2 ให้ **A3** ประเมินเลือก 2 (A1=0.8, A2=0.2), คู่ A1–A3 ให้
**A2** ประเมินเลือก 1 (A1=1, A3=0), และคู่ A2–A3 ให้ **A1** ประเมิน
เลือก 3 (A2=0.6, A3=0.4). ไม่มีผู้ใดประเมินคู่ที่มีตนเอง.
ค่าเฉลี่ย A1=0.9, A2=0.4, A3=0.2; ผลรวม=1.5. หลัง normalize
A1 ได้ 0.9/1.5 × 5 = **3**, A2 ได้ 0.4/1.5 × 5 = **1.3333**,
A3 ได้ 0.2/1.5 × 5 = **0.6667**.
ถ้า A1 ส่ง Group เพียง 1 จาก 2 คู่ และส่ง Individual คู่ A2–A3 ครบ 1 จาก 1 คู่
คะแนนของ A1 เป็น Group 9.6 × 1/2 = **4.8**, Individual 3 × 1 = **3**,
รวม **7.8**. คะแนนตั้งต้นของกลุ่ม A ยังเป็น 9.6 และคะแนนของคนอื่นไม่ถูกคูณตาม A1.

ใช้เฉพาะ revision ที่กด Submit ล่าสุดของแต่ละ evaluator/ชนิด. Draft และ revision เก่า
ไม่มีผล; ไม่ส่งชนิดนั้นได้ 0. หาก item ใดไม่มีคำตอบหรือผลรวมเฉลี่ยใน criterion เป็นศูนย์
ผลที่ต้องใช้ item นั้นแสดง `NO_DATA` ไม่แต่งเป็นคะแนนสุดท้าย. หากไม่ถูกมอบหมายคู่
completion ratio เป็น 1 และไม่ถูกหักเพราะไม่มีงาน.

## วัน/ช่วงงาน

วันที่ 5 ของแผน — 28 กันยายน 2026 (Windows, Node.js 24, Next.js 16, SQLite, Chromium)

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | หลักฐาน |
|---|---|---|
| Scoring Group/Individual | เสร็จ P0 | สูตรแยกจาก UI; submission ล่าสุดต่อ evaluator/ชนิด; normalize Individual ภายในกลุ่ม |
| No submission, partial, draft, Re-submit | เสร็จ P0 | unit และ HTTP integration ผ่าน; NO_DATA เมื่อ item ขาดคำตอบ |
| Instructor report | เสร็จ P0 | คะแนนกลุ่ม/คน/เกณฑ์ และจำนวนคำตอบต่อคู่ |
| My Score | เสร็จ P0 | หน้า/API ส่งเฉพาะคะแนน student ที่เข้าสู่ระบบ |
| CSV summary | เสร็จ P0 | ผู้สอนดาวน์โหลดได้; นักศึกษาถูกปฏิเสธ |
| P1 | ยังไม่เริ่ม | ฟีเจอร์รองยังติดป้าย Demo |

## สิ่งที่เปลี่ยน

- บันทึกงานวันที่ 4 เป็น commit `4569525` ใน PairEval-Demo ก่อนเริ่มวันที่ 5; Repo นี้ไม่มี remote
- `src/lib/score-engine.ts`: ตาราง choice 1–6, ค่าเฉลี่ยต่อ item, normalize ต่อ criterion, น้ำหนัก, คะแนนสูงสุด และ completion ratio; คืน `null`/NO_DATA เมื่อคำนวณไม่ได้
- `src/lib/score-store.ts`: อ่าน submission revisions/answers จริง, เลือก revision ล่าสุดใน engine, รายงาน coverage ต่อคู่, สร้าง CSV
- `src/app/api/assignments/[id]/scores/route.ts`: instructor ได้รายงานเต็ม; student ได้เฉพาะคะแนนตน; ตรวจ session/สมาชิกฝั่ง server
- `src/app/api/assignments/[id]/export/route.ts`: CSV เฉพาะ instructor
- หน้า Report, Export และ My Score แสดงค่าที่คำนวณ; ไม่มีคะแนนฝังใน UI
- `scripts/seed-answers.mjs`: เพิ่ม submission ของผู้ประเมินสังเคราะห์คนอื่นจริงใน SQLite หลังสร้างคู่ ไม่แก้ submission เดิม; มี 345 คู่, 42 revisions, 332 answers หลังการทดสอบ

## วิธีตรวจ

1. รัน `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — ผ่าน
2. `npm run seed:reset`, เปิด `npm run start -- -p 3100`, รัน `node scripts/day5-smoke.mjs` — สร้างคู่ 345 รายการ, เพิ่ม submission ของผู้ประเมินอื่น, ทดสอบ draft/partial/no submit/Re-submit/สิทธิ์/CSV
3. รัน `node scripts/day5-browser.mjs` — เปิดรายงาน, ดาวน์โหลด CSV, เปิด My Score และ reload ที่ viewport มือถือ 390 px
4. ตรวจ SQLite หลังรัน: 345 pair assignments, 42 submission revisions, 332 submission answers, 0 drafts. ปัจจุบันฐานข้อมูลยังอยู่ในสภาพนี้สำหรับเดโม; reset แล้วต้องสร้างคู่และรัน `npm run demo:answers` ใหม่
5. อ่าน My Score ของ `student-01` จาก API หลังการทดสอบครั้งนี้: Interim, Group 3.84, Individual 0.0496, รวม 3.8896; ส่ง Group 2/2 และ Individual 1/15. ค่านี้เป็นผลของคู่สุ่มที่บันทึกในรอบนี้ จึงอาจเปลี่ยนเมื่อ reset และสร้างคู่ใหม่

## ผลทดสอบ

| ชุด | ผ่าน | ไม่ผ่าน | ผลจริง |
|---|---:|---:|---|
| Unit (Vitest ทั้งโปรเจกต์) | 20 | 0 | รวม 6 scoring cases และ 2 สถานะ Interim/Final |
| HTTP + SQLite integration วันที่ 5 | 24 | 0 | คะแนนเปลี่ยนเมื่อ Re-submit, draft ไม่เปลี่ยน, no submission เป็น 0, student ไม่ได้ CSV/ข้อมูลคนอื่น |
| Browser Chromium วันที่ 5 | 4 | 0 | Report, ดาวน์โหลด CSV, My Score ส่วนตัว, หน้าจอมือถือ |
| Typecheck, lint, build | 3 | 0 | ผ่านทั้งหมด ไม่มี warning |

## ข้อจำกัด/ความเสี่ยง

- ทุกคนยังเลือกบัญชีตัวอย่างผู้สอนจากหน้าแรกได้ จึงเป็นการตรวจสิทธิ์ภายใน Demo ไม่ใช่ authentication สำหรับระบบจริง
- ข้อมูลการประเมินจากผู้ประเมินอื่นเป็นข้อมูลสังเคราะห์ที่บันทึกเป็น submission จริง; มีเพียง student-01 เป็นบัญชีนักศึกษาที่เลือกได้ผ่าน UI เดโม คะแนนทั้งหมดคำนวณจากคำตอบในฐานข้อมูล
- หาก item ไม่มีคำตอบหรือ normalize ไม่ได้ จะแสดง NO_DATA/คะแนนชั่วคราว; ไม่สร้างคะแนนแทนข้อมูลที่ขาด
- ยังไม่มี instructor weighted votes, Raw Pairs report, Excel export และกติกา floor/ceiling ของ PRD v2.1 เพราะไม่อยู่ในสูตร Demo วันที่ 5
- ไม่มี remote/PR/deployment ของ PairEval-Demo; Lab 07 อยู่ที่ branch เดิมและมีไฟล์ Project Description ที่แก้ค้างไว้ก่อนงานนี้ ไม่มีการแตะ Lab 07

## งานถัดไป

วันที่ 6: ตรวจ Main Flow ซ้ำจาก seed ใหม่, เก็บ responsive/error/empty states และขัดเกลา P1 ตามลำดับแผน
