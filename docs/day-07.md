# วัน/ช่วงงาน: วันที่ 7 — ตรวจบนเครื่อง Windows ปัจจุบัน (28 กันยายน 2026)

เครื่องนำเสนอจริงเป็นอีกเครื่อง ผู้ใช้ขอให้ตรวจวิธีเปิด CSV ใน Microsoft Excel **บนเครื่องปัจจุบันก่อน** ดังนั้นผลด้านล่างไม่ใช่หลักฐานว่าเครื่องนำเสนอจริงผ่านแล้ว

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | ผลที่ตรวจได้ |
|---|---|---|
| เปิดแอป/เดิน Main Flow จาก seed ใหม่ | เสร็จบนเครื่องปัจจุบัน; เครื่องจริงยังไม่ตรวจ | Production build เปิดได้, E2E 32/32, UI audit 36/36 |
| เตรียมคำตอบสังเคราะห์ของผู้ประเมินอื่น | เสร็จ | `demo:prepare` เลือกบัญชีที่มีคู่ Group/Individual, สร้าง submission จริง, รันซ้ำไม่เพิ่มซ้ำ |
| CSV ใน Microsoft Excel | เสร็จบนเครื่องปัจจุบัน; เครื่องจริงยังไม่ตรวจ | เปิดด้วย Text Import Wizard แบบ UTF-8/Delimited/Comma แล้วอ่านภาษาไทยและ 21 แถวได้ |
| README/คู่มือเดโม/ไฟล์ส่งมอบ | เสร็จบนเครื่องปัจจุบัน | ขั้นตอน 5–10 นาที, synthetic data, error case, Excel, สูตร, P1; ZIP แตกและเปิดได้ในพาธภาษาอังกฤษ |
| P1 | ยังไม่เริ่ม backend | หน้าที่มีอยู่บอกสถานะ Demo/ยังไม่เปิดใช้ |

## สิ่งที่เปลี่ยน

- บันทึกงานวันที่ 6 เป็น commit `228286f` ใน PairEval-Demo ก่อนเริ่มวันที่ 7
- เพิ่ม `examples/roster-demo-21.csv` สำหรับ upload ห้องใหม่ 3 กลุ่ม × 7 คน
- เพิ่ม `scripts/prepare-demo.mjs` และ `npm run demo:prepare -- <assignment-id>` เพื่อเลือกบัญชีที่จะกดส่งเอง แล้วเพิ่ม revision/answer ของผู้ประเมินสังเคราะห์คนอื่นโดยอาศัยคู่จริง
- คำสั่งเลือกเฉพาะบัญชีที่ยังไม่เคยส่งในงานนั้น เพื่อไม่บอกผิดว่าเว้นบัญชีที่มี submission แล้ว
- เพิ่ม `docs/demo-guide.md` พร้อมขั้นตอน Microsoft Excel ที่ตรวจผ่าน และอัปเดต README ให้ชี้คู่มือ
- สร้าง `delivery/PairEval-Demo-source.zip` จากไฟล์โครงการ 64 ไฟล์ โดยไม่รวม `node_modules`, `.next`, `.git` และฐานข้อมูล SQLite; อัปเดต `.gitignore` ไม่ให้ ZIP เข้า commit โดยไม่ตั้งใจ
- ไม่แก้ Lab 07, repo/branch/PR/deployment/submodule ของ Lab และไม่สร้าง remote ให้ PairEval-Demo

## วิธีตรวจและผลที่เห็นจริง

1. เปิด CSV ที่ส่งออกจาก PairEval-Demo ใน Microsoft Excel ผ่าน **File → Open → Browse**. Excel เปิด Text Import Wizard และเดาเป็น **Fixed width** ซึ่งไม่แยกคอลัมน์ถูกต้อง จึงเลือก **Delimited**, File origin `65001: Unicode (UTF-8)`, header, แล้วเลือก **Comma** เพียงตัวเดียวในหน้า 2 จากนั้น Finish
2. Excel แสดง `assignment`, `group`, `student_id`, `student`, คะแนน Group/Individual/รวมเป็นคนละคอลัมน์; แถว 2–22 คือ 21 นักศึกษา; คลิก D2 อ่านข้อความเต็มได้เป็น `นักศึกษา day6-17`. เลือกตารางทั้งหมดแล้วดับเบิลคลิกเส้นคั่นหัวคอลัมน์ A/B เพื่อ AutoFit สำเร็จ. มีแถบเตือน Possible Data Loss เฉพาะกรณีบันทึก CSV กลับ
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` ผ่านจากไฟล์ปัจจุบัน
4. `npm run seed:reset` → เปิด production server → `node scripts/day3-smoke.mjs` ได้คู่ 345 รายการและผ่าน 12/12 → `npm run demo:prepare -- class-feasible-assignment` สร้าง 39 revisions / 328 answers โดยเว้น `student-01@demo.invalid` (Group 2, Individual 15); รันซ้ำได้ 0 revisions / 0 answers เพิ่ม
5. ปิด server → `npm run seed:reset` อีกครั้ง → เปิด production server → `node scripts/day6-main-flow.mjs` เดินห้อง/งานใหม่, invalid CSV, invalid weights, pairing 345, synthetic submissions, draft/Submit/Re-submit, report/My Score/CSV/สิทธิ์. จับเวลาการรันอัตโนมัติ **4.12 วินาที**. จากนั้น `npm run test:ui-audit` ตรวจลิงก์/error/empty/มือถือ 390 px
6. แตก `delivery/PairEval-Demo-source.zip` ไปที่ `C:\Users\evilm\AppData\Local\Temp\PairEval-Zip-Check-20260928-205508` ซึ่งเป็นพาธภาษาอังกฤษ ตรวจว่ามี `package.json`, คู่มือ และไม่มี DB เดิม แล้วรัน `npm ci --offline`, `npm run build`, `npm run seed:reset`, `npm run start -- -p 3102`. `GET /api/health` ได้ HTTP 200 `{"status":"ok"}`; หน้าแรกได้ HTTP 200 และมีชื่อแอป PairEval
7. หลังแก้ `demo:prepare` ทดสอบกับงานที่ทุกคนส่งแล้ว: คำสั่งจบพร้อมข้อความว่าไม่พบบัญชีที่ยังไม่ส่ง (ปฏิเสธตามคาด). จากนั้น `seed:reset` → สร้างคู่ seed ใหม่ → คำสั่งสร้าง 39 revisions / 328 answers, เว้น `student-01`; รันซ้ำสร้าง 0/0 และยังเลือกบัญชีเดิม

## ผลทดสอบจริง

| ชุดทดสอบ | ผ่าน | ไม่ผ่าน | หมายเหตุ |
|---|---:|---:|---|
| Vitest | 20 | 0 | 4 test files |
| Typecheck/lint/build | 3 | 0 | Production build สำเร็จ |
| Pairing smoke จาก seed | 12 | 0 | feasible/infeasible/สิทธิ์/transaction |
| `demo:prepare` | 3 | 0 | สร้างคำตอบจริง, รันซ้ำไม่เพิ่ม, ปฏิเสธเมื่อไม่มีบัญชีที่ยังไม่ส่ง |
| Main Flow จาก seed ใหม่ | 32 | 0 | คะแนน Group `0 → 2.5448 → 5.0800`; total หลัง Individual Submit/Re-submit `5.1335 → 5.1870` |
| UI audit | 36 | 0 | หน้าหลัก, role guard, 390 px |
| Excel UI บนเครื่องปัจจุบัน | 1 | 0 | UTF-8, 21 แถว, ภาษาไทย/คอลัมน์คะแนนถูกต้องหลังเลือก Delimited/Comma |
| เปิดจาก ZIP ในพาธภาษาอังกฤษ | 5 | 0 | แตกไฟล์, `npm ci`, build, seed, health/หน้าแรก |

## ตาราง feature coverage

| ส่วน | ทำงานจริงใน Demo | ยังเป็น P1 / ไม่ได้ทำ |
|---|---|---|
| Classroom / Assignment | สร้างห้อง, CSV validation, groups, สร้างงาน/เกณฑ์/deadline | แก้กลุ่มและงานหลังสร้าง, อาจารย์ร่วม |
| Pairing | Group/Individual target 5, ห้ามประเมินตนเอง, preview และบันทึกทั้งชุด | เพิ่ม evaluator, re-assignment UI, อาจารย์ประเมิน |
| Evaluation | Save draft, Submit/Re-submit revision, session/owner/deadline server-side | Notification / workflow รายวัน |
| Scoring / Report | สูตร Demo §3 ข้อ 8–10 จาก latest submitted revision, รายงาน, My Score เฉพาะตน | สูตร PRD v2.1 เต็ม, instructor weighted votes, Raw Pairs report |
| Export | CSV summary ดาวน์โหลดและเปิดใน Excel ได้บนเครื่องปัจจุบัน | Excel `.xlsx` export |

## ข้อจำกัด/ความเสี่ยง

- การซ้อมแบบคนกดจริง 5–10 นาทีบน **เครื่องนำเสนอจริง** และการเปิดไฟล์ส่งมอบบนเครื่องนั้นยังไม่ได้ทำ เพราะยังไม่ได้เปิด PairEval-Demo ใน Codex บนเครื่องนั้น; ผล 4.12 วินาทีเป็นเวลาของ E2E อัตโนมัติ ไม่ใช่เวลาการพูดสาธิต. ZIP เปิดและรันได้บนเครื่องปัจจุบันจากพาธภาษาอังกฤษแล้ว
- CSV ใน Excel ทดสอบบนเครื่องปัจจุบันเท่านั้น; เครื่องจริงอาจตั้งค่าตัวคั่นต่างกัน จึงบันทึกตัวเลือกที่ต้องตรวจในคู่มือ
- Session เดโมเลือกบัญชีสังเคราะห์ได้จากหน้าแรกโดยไม่ใช้รหัสผ่าน ไม่ใช้ข้อมูลจริงหรือเปิดเป็นระบบจริง คำตอบสังเคราะห์เป็น submission จริง แต่ไม่ใช่ความเห็นของนักศึกษาจริง
- P1 ที่ระบุในตารางยังไม่ทำ backend; ไม่มี remote, PR หรือ deployment สำหรับ Repo นี้

## งานถัดไป

1. เปิดไฟล์ส่งมอบในพาธภาษาอังกฤษบนเครื่องนำเสนออีกเครื่อง, ติดตั้ง dependencies, build และเปิดแอปจริง
2. จับเวลาซ้อมด้วยคนกด 5–10 นาทีจาก `seed:reset` บนเครื่องนั้นตาม `docs/demo-guide.md` รวม CSV ใน Microsoft Excel
3. บันทึกผลและปัญหาจริงของเครื่องนั้นก่อนระบุว่าส่งมอบผ่าน Definition of Done
