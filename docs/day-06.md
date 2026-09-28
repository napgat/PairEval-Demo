# วัน/ช่วงงาน: วันที่ 6 — 28 กันยายน 2026

สภาพแวดล้อมที่ทดสอบ: Windows, Node.js 24, Next.js 16, SQLite (`node:sqlite`), Playwright Chromium; server ที่ `http://localhost:3100`.

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | ผลที่ตรวจได้ |
|---|---|---|
| Main Flow จาก seed ใหม่ | เสร็จ P0 | สร้างห้อง/งาน → จัดคู่ → เติม submission ของเพื่อน → นักศึกษา Save/Submit/Re-submit → รายงาน/My Score → CSV |
| คะแนนจาก Submit/Re-submit | เสร็จ P0 | ค่าจาก API และหน้า UI เปลี่ยนตาม revision ล่าสุด; draft ไม่เปลี่ยนคะแนน |
| สิทธิ์นักศึกษา | เสร็จในขอบเขต Demo | session เห็นเฉพาะคะแนนตน; คนอื่นและ CSV ถูกปฏิเสธ |
| Error/empty/mobile | เสร็จ P0 | CSV/น้ำหนักผิดแสดงเหตุผล, ก่อนจัดคู่มีข้อความ, ไม่มีคำตอบแสดง NO_DATA, หน้าหลักพอดีจอ 390 px |
| P1 | มี UI บอกสถานะ; backend ยังไม่ทำ | หน้า Extras ติดป้าย “ยังไม่เปิดใช้งานใน Demo” |

## สิ่งที่เปลี่ยน

- บันทึกงานวันที่ 5 เป็น commit `2273e1d` ใน PairEval-Demo ก่อนเริ่มวันที่ 6; Repo ไม่มี remote
- แก้ตัวอย่าง Individual ใน `docs/day-05.md` และ unit test ให้ A1, A2, A3 ประเมินเฉพาะคู่ที่ไม่มีตนเอง: A3 ประเมิน A1–A2, A2 ประเมิน A1–A3, A1 ประเมิน A2–A3; คะแนน A1 Individual = 3 และตัวอย่างรวมเมื่อ Group ส่ง 1/2 = 7.8
- หน้าแรกเลือกบัญชีนักศึกษาสังเคราะห์ที่อยู่ในฐานข้อมูลได้; server ตรวจว่า user ID เป็นนักศึกษาจริงก่อนออก session
- หน้า Student ใช้ห้อง/งานปัจจุบันของ URL และตรวจ membership จึงเปิดงานในห้องที่สร้างใหม่ได้; sidebar ไม่สร้างลิงก์งานที่ยังไม่มี
- ข้อความ Submit บางส่วนบอกว่าคะแนนถูกคิดตามสัดส่วนแล้ว
- `scripts/seed-answers.mjs` รับ assignment ID และ student ID ที่ต้องเว้นไว้เป็นพารามิเตอร์ โดยค่าเริ่มต้นยังใช้ข้อมูล seeded เดิม
- เพิ่ม `scripts/day6-main-flow.mjs` และ `scripts/day6-ui-audit.mjs` พร้อมคำสั่ง npm ให้ทดสอบซ้ำได้

## วิธีตรวจจาก seed ใหม่

1. หยุด server แล้วรัน `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run seed:reset`
2. เปิด `npm run start -- -p 3100`; อีก terminal รัน `npm run test:main-flow` แล้ว `npm run test:ui-audit`
3. Main Flow ใช้เบราว์เซอร์สร้างห้องใหม่จาก CSV 3 กลุ่ม × 7 คน (หนึ่งคนเป็น `student-01` จาก seed), สร้าง Assignment ใหม่ Group 60/40 และ Individual 100, ตรวจว่าก่อนจัดคู่หน้านักศึกษาว่างพร้อมคำอธิบาย, สร้างคู่ 345 assignments ครบในครั้งเดียว
4. สคริปต์เลือกนักศึกษาที่ได้รับทั้ง Group และ Individual อย่างน้อยอย่างละ 2 คู่, เรียก `seed-answers.mjs <assignment-id> <student-id>` เพื่อบันทึกคำตอบสังเคราะห์ของเพื่อนเป็น submission revisions จริง และเว้นนักศึกษาที่เลือกไว้ให้กดส่งผ่าน UI
5. นักศึกษาบันทึก draft, refresh, Submit/Re-submit Group และ Individual; ตรวจคะแนนใน API/หน้า My Score, สลับไปผู้สอนดู Report และดาวน์โหลด CSV; เปลี่ยนกลับไปนักศึกษาเพื่อยืนยันสิทธิ์เฉพาะตน
6. หลังรอบสุดท้าย ฐานข้อมูลมี 3 ห้อง, 8 กลุ่ม, 46 users, 3 assignments, 345 pair assignments, 44 submission revisions, 334 answers, 0 drafts. ข้อมูลนี้ยังอยู่เพื่อเปิดสาธิต; reset จะล้างทั้งหมด

## ผลทดสอบจริง

| ชุดทดสอบ | ผ่าน | ไม่ผ่าน | สิ่งที่ตรวจ |
|---|---:|---:|---|
| Vitest ทั้งโปรเจกต์ | 20 | 0 | สูตร, pairing, validation รวม unit fixture Individual ที่ไม่มี self-evaluation |
| E2E Main Flow จาก `seed:reset` รอบสุดท้าย | 32 | 0 | สร้างห้อง/งาน, error/empty, pairing, synthetic revisions, draft, Submit/Re-submit, คะแนน, รายงาน, CSV, สิทธิ์, มือถือ |
| UI audit หลัง Main Flow | 36 | 0 | ลิงก์หลัก Instructor/Student, infeasible/NO_DATA/P1, หน้าจอ 390 px, การเลือกคำตอบ/นำทาง/เลื่อนตารางบนมือถือ, role guard |
| Typecheck, lint, production build | 3 | 0 | ผ่าน ไม่มี warning |

ค่าที่อ่านได้จริงในรอบสุดท้าย: Group ของนักศึกษาที่เลือกเป็น **0 → 1.8120 → 3.6400** (ก่อนส่ง → Submit → Re-submit); คะแนนรวมหลัง Individual Submit **3.7070** และหลัง Re-submit **3.7738**. คะแนนในรายงานผู้สอนเปลี่ยนเมื่อเปลี่ยน choice ใน Group และ Individual ด้วย. ตัวเลขอาจต่างเมื่อ reset เพราะ ID งาน/เกณฑ์ใหม่ทำให้ Pairing Engine แจกงานต่างกัน แต่ทุกค่ามาจาก submission จริงในรอบนั้น

รอบทดสอบครั้งแรกหยุดที่ locator ของสคริปต์ซึ่งจับ `role=alert` ได้ทั้งกล่อง error ของแอปและตัวแจ้งของ Next.js; แก้ให้ชี้กล่อง `.error-box` แล้วรันจาก seed ใหม่ผ่านทั้งหมด. รอบ UI audit เพิ่มการคลิกลิงก์บนมือถือแล้วตรวจเร็วเกิน navigation; เพิ่มการรอหัวข้อปลายทางและรันผ่าน 36/36. ไม่พบข้อผิดพลาดของแอปที่ยังค้างจากสองกรณีนี้

## ตาราง feature coverage เทียบ Project Description

| ส่วน | ทำงานจริงใน Demo | UI demo / ยังไม่ทำ |
|---|---|---|
| §4.1 Authentication | Demo session, role และ membership guard | Google OAuth/บัญชีจริงยังไม่ทำ; ผู้ใช้เลือกบัญชีสังเคราะห์เองได้ |
| §4.2 Classroom | สร้างห้อง, CSV preview/validation แบบ transaction, roster/groups | UI แก้กลุ่มหลังสร้างและอาจารย์ร่วมยังไม่ทำ |
| §4.3 Assignment | สร้างงาน, คะแนน/criteria/deadline validation | แก้ไขงานหลังสร้างยังไม่ทำ |
| §4.4 Pairing | Group/Individual no self-evaluation, target 5, feasibility/coverage, บันทึกครบทั้งงาน | เพิ่ม evaluator, instructor evaluation, re-assignment UI ยังไม่ทำ |
| §4.5 Evaluation | เฉพาะคู่ของตน, เลือก 1–6, draft, revisions, deadline server-side | การแจ้งเตือนและ workflow รายวันยังไม่ทำ |
| §4.6 Scoring | สูตร Demo §3 ข้อ 8–10, latest submitted revision, partial/no submit/NO_DATA | Instructor weighted votes, daily job และสูตร PRD v2.1 ไม่อยู่ใน Demo |
| §4.7 Report/Export | Group/Individual/total, criteria และ pair coverage, My Score ส่วนตัว, CSV summary | Raw Pairs report และ Excel export ยังไม่ทำ |

## ข้อจำกัด/ความเสี่ยง

- การเลือกบัญชีสังเคราะห์จากหน้าแรกไม่มีรหัสผ่าน จึงใช้สาธิตสิทธิ์ของ session เท่านั้น ไม่ใช่การป้องกันผู้ใช้จริง
- ผลประเมินจากเพื่อนเป็นคำตอบสังเคราะห์ แต่บันทึกเป็น submission revisions จริง; ไม่มีตัวเลขคะแนนฝังใน seed, หน้าเว็บ หรือ CSV
- ตรวจความกว้าง การเลือกคำตอบ การนำทาง และการเลื่อนตารางที่ viewport 390 px ด้วย Chromium; ตรวจภาพหน้าจอ My Score, Evaluation และ Report แล้ว. ยังไม่ได้ตรวจอุปกรณ์จริงหลายรุ่นหรือเปิด CSV ใน Excel โดยตรง (ตรวจการดาวน์โหลด, MIME และจำนวนแถวแล้ว)
- P1 ใน Extras เป็นข้อความบอกสถานะ ยังไม่เชื่อม backend; ไม่มี remote, PR หรือ deployment ของ PairEval-Demo และไม่ได้แก้ Lab 07

## งานถัดไป

1. วันที่ 7 ซ้อมสาธิตจาก seed ใหม่บนเครื่องที่จะนำเสนอ โดยใช้ขั้นตอนใน README และเก็บภาพ/หลักฐานตามแผน
2. ตรวจ CSV ด้วยโปรแกรมตารางที่ใช้สาธิตจริง และแก้เฉพาะปัญหาที่พบ
3. ทบทวนข้อความจำกัดความสามารถของ Demo ก่อนส่งมอบ
