> บันทึกประวัติจากรอบก่อนแก้: โปรดใช้ [ผลล่าสุดตาม PRD v2.0](docs/full-system/prd-v2.0-readiness-2026-10-15.md) สำหรับการนำเสนอครั้งนี้

# PairEval — ผลตรวจความพร้อมบนโน้ตบุ๊กนำเสนอ

> อัปเดตหลังแก้ dependency และสคริปต์: ดู [ผลทดสอบรอบแก้จริง](docs/full-system/readiness-hardening-2026-10-15.md) — production High/Critical เป็น 0, สคริปต์ Full System จริงผ่าน 10/10 ชุด เนื้อหาด้านล่างเป็นบันทึกรอบตรวจเดิมก่อนแก้

วันที่ตรวจ: 15 ตุลาคม 2026 (Asia/Bangkok)

**ข้อสรุป: พร้อมแสดงฟังก์ชันหลักในฐานะต้นแบบโครงงานบนเครื่องนี้ มีเดโมสำรองที่ไม่ต้องใช้อินเทอร์เน็ตแล้ว ส่วน Full System ออนไลน์ยังต้องซ้อมด้วยบัญชี Google ที่จะใช้จริงก่อนวันนำเสนอ** ผลตรวจนี้ไม่ใช่การยืนยันว่าครบ PRD หรือพร้อมรับข้อมูลคะแนนจริง

## รุ่นที่ตรวจและขอบเขต

- รีโป `napgat/PairEval-Demo`, โค้ด `staging` commit `1befe03`; โฟลเดอร์ `D:\PairEval-Review-20261015` เป็นสำเนาตรวจสอบแยก
- `main` ยังอยู่ที่ `3280f46` ซึ่งเป็น Demo รุ่นเก่า หน้าใหม่และ PostgreSQL อยู่ใน `staging` การอ่าน README หลักอย่างเดียวทำให้เข้าใจขอบเขต Full System ไม่ครบ
- Node.js 24.14.1 และ npm 11.11.0 บน Windows เครื่องที่จะนำเสนอ
- ตรวจ Full System กับ PostgreSQL 18.4 ในเครื่อง ใช้ข้อมูลสังเคราะห์เท่านั้น แยก operational/audit เป็นคนละฐาน และจำกัด audit role ให้ SELECT/INSERT สิ่งนี้ทดสอบพฤติกรรมแอปและสิทธิ์ audit ได้ แต่ไม่เท่ากับการพิสูจน์การแยกโครงสร้างพื้นฐานของ Neon
- ไม่ใช้ secret ของเครื่องพัฒนา ไม่เขียนข้อมูลลง staging ไม่ deploy ไม่ push และไม่แก้ submodule

## ผลที่รันจริง

| รายการ | ผล | ขอบเขตหลักฐาน |
|---|---|---|
| ติดตั้งจาก lockfile | ผ่าน | `npm ci` บนเครื่องนี้ |
| Unit tests | ผ่าน 82/82 | `npm test`, 20 test files |
| Audit integrity unit tests เพิ่มเติม | ผ่าน 2/2 | Vitest รัน `scripts/audit-integrity-core.test.mjs` โดยตรง |
| Typecheck / lint / production build | ผ่านทั้งสาม | บน commit ที่ตรวจ; ไม่ได้ปรับ dependency |
| Demo Main Flow | ผ่าน 32/32 | สร้างห้อง 21 คน, สร้างงาน, 345 คู่, draft/submit/re-submit, คะแนน, CSV และสิทธิ์ |
| Demo UI audit | ผ่าน 36/36 | error/empty states, นักศึกษาเห็นคะแนนตน, จอ 390 px |
| Full System: งานและ pairing | ผ่านด้วยสำเนาทดสอบที่ปรับ selector | เปลี่ยนกลุ่ม, coverage 5→3, เก็บรุ่นเก่า, rollback เมื่อจัดคู่ไม่ได้, แจ้งเตือนและไม่สร้าง reminder ซ้ำ |
| Full System: การประเมิน | ผ่านสคริปต์เดิม | สร้าง/เผยแพร่งานจาก UI, Group/Individual, autosave, refresh, submit/re-submit, กำหนดส่งและการแยกสิทธิ์ |
| Full System: รายงานและคะแนน | ผ่านด้วยสำเนาทดสอบที่ปรับ selector | snapshot, override, Finalize/Reopen, อุทธรณ์, CSV มี BOM และ XLSX 4 sheets |
| Full System: ผู้สอนประเมิน | ผ่านด้วยสำเนาทดสอบที่ปรับ selector | เพิ่ม evaluator, แจ้งเตือน, ปฏิเสธเพิ่มซ้ำ, น้ำหนักผู้สอน 0.5 ให้ q=2/3 และ My Score ตรง snapshot |
| Full System: notice gate | ผ่านด้วยสำเนาทดสอบที่ปรับ selector | ก่อนรับทราบอ่านห้องไม่ได้, ตรวจ origin/version, กดรับทราบใน UI แล้วอ่านได้ |
| Full System: QS-05–07 | ผ่านด้วยสำเนาทดสอบที่ปรับ selector | เวลา active จาก browser, z/W, NA, CSV/XLSX, คุณภาพไม่เปลี่ยนสูตรคะแนนย้อนหลัง |
| จอขนาดโน้ตบุ๊ก | ผ่านกรณีที่ตรวจ | evaluation/report 1366×768 ไม่มีหน้าล้นแนวนอน; ภาพอยู่ในหลักฐาน |
| สร้างฐานข้อมูลใหม่ | ผ่าน | migrations 001–012; rehearsal ใน schema แยกพบ 30 tables แล้ว rollback สำเร็จ ไม่ใช่ backup/restore drill |
| Audit role / outcome | ผ่าน | INSERT/SELECT ได้; UPDATE/DELETE/TRUNCATE ไม่ได้; ตรวจท้ายงาน 95 committed, 0 pending; fixture ที่ตรวจนับเหลือ 0 |
| เดโมสำรองไม่มีอินเทอร์เน็ต | ผ่าน | ปิด PostgreSQL แล้วบล็อกทุก request นอก localhost; ผู้สอนเปิดรายงาน/คู่ นักศึกษาบัญชีเริ่มต้นเปิดคู่ Group ได้; ไม่มี remote origin ถูกเรียก |
| เว็บ staging | ผ่านเฉพาะหน้าเข้าและ OAuth redirect | เปิดหน้า login ได้ และปุ่มนำไป Google sign-in ถูกปลายทาง ยังไม่ได้ทำ callback ด้วยบัญชีจริงในรอบนี้ |
| Production dependency audit | **ไม่ผ่าน** | High 2 packages: `next` 16.3.7 และ `source-map-js`; Moderate 2 packages: `uuid`/`exceljs`; ไม่มี Critical ในผลรอบนี้ |

Full System มีสคริปต์ตาม UI ไม่ทัน: ตัวอย่าง `Feasible assignment · DRAFT`, `Synthetic Day 7 · OPEN`, `รุ่น 2 · INTERIM`, `Individual Summary`, `Quality`, `CSV รายชื่อและกลุ่ม` และ `ส่งคำตอบ` ถูกเปลี่ยนชื่อ/ย้ายในหน้าปัจจุบันแล้ว ส่วน migration rehearsal เดิมยังบังคับว่าต้องมี 9 ไฟล์ แม้ปัจจุบันมี 12 ไฟล์ จึงแยกความล้มเหลวของสคริปต์เดิมออกจากผลของแอป โดยรันสำเนาที่ปรับ selector และจำนวน migration เท่านั้น ไม่แก้ source แอปหรือ assertion ของสูตร/สิทธิ์เพื่อให้ผ่าน สำเนาบางไฟล์เพิ่ม screenshot/export evidence และตรวจความกว้างจอ

## เรื่องที่ควรจัดการก่อนนำเสนอ

1. **เลือกเส้นทางให้ตรงฟีเจอร์:** Full System ออนไลน์อยู่ที่ <https://paireval-full-staging.vercel.app/full-system> ส่วน <http://localhost:3100> คือ SQLite Demo สำรอง สูตรและฟีเจอร์รองของสองรุ่นต่างกัน อย่าใช้เดโมสำรองยืนยันว่ามี Finalize/XLSX/OAuth
2. **ซ้อมบัญชีจริงบนโน้ตบุ๊ก:** ใช้ Google account ที่ได้รับสิทธิ์และอยู่ใน OAuth Test users ตามการตั้งค่าปัจจุบัน ให้เจ้าของบัญชีอ่านและกดรับทราบด้วยตนเอง แล้วเปิดห้อง งาน Group/Individual และรายงานให้ครบหนึ่งรอบ เอกสารเดิมบันทึกว่ามีบัญชีที่เตรียมไว้สองบัญชี แต่รอบนี้ไม่ได้ยืนยันการล็อกอินของทั้งสอง
3. **อัปเดต dependency ก่อนส่งงานด้านคุณภาพ/เผยแพร่รอบถัดไป:** audit ปัจจุบันทำให้ขั้นตอน `npm audit --omit=dev --audit-level=high` ใน CI คืน exit 1 แม้ตัวแอป build และเดโมผ่าน ความรุนแรงจาก audit ไม่ได้แปลว่าทุกช่องโหว่เข้าถึงได้ผ่านหน้าจอของแอปนี้ ยังไม่ได้แก้ dependency ในงานตรวจนี้
4. **อัปเดต Full System smoke scripts และ runbook:** ทำให้ใช้ชื่อปุ่มภาษาไทยและ 12 migrations ได้จากไฟล์จริง ปัจจุบัน CI หลักรัน browser flow ของ SQLite Demo จึงยังไม่ครอบคลุม Full System regression เหล่านี้
5. **ถ้าจะโชว์การเปิดผลงาน A/B ให้เตรียมลิงก์ตัวอย่าง:** fixture ที่ตรวจไม่มีลิงก์ผลงานจริงและ UI แสดงว่าไม่มีลิงก์ จึงพิสูจน์การให้คำตอบ/คำนวณคะแนนได้ แต่ยังไม่ได้พิสูจน์การเปิดไฟล์ผลงานที่จะนำเสนอต่ออาจารย์

ไม่อ้างว่าทำครบทุก PRD: real-user UAT, การรัน scheduler อัตโนมัติจริงบน staging, full security/a11y/load และ recovery/retention acceptance ยังอยู่นอกผลตรวจรอบนี้ เอกสาร execution matrix เดิมก็ยังระบุสถานะหลายส่วนเป็น in progress

## เดโมสำรองที่เตรียมไว้บนเครื่องนี้

เปิด `D:\PairEval-Review-20261015\Open-PairEval-Demo.cmd` หรือเปิด <http://localhost:3100> ขณะ server ทำงาน หากเปิดไฟล์คำสั่งเพื่อเริ่มใหม่ ให้เปิดหน้าต่างนั้นค้างไว้ระหว่างสาธิต ไม่ต้องติดตั้งหรือ build ใหม่เมื่อไฟล์ชุดนี้ยังอยู่ครบ

- ห้อง: **PairEval Demo · ห้องที่จัดคู่ได้**
- งาน: **ประเมินโครงงานตัวอย่าง** (`class-feasible-assignment`)
- สร้างคู่ไว้แล้ว **345 รายการ**
- เตรียมคำตอบสังเคราะห์ของเพื่อน **39 revisions / 328 answers** โดยเว้น `student-01@demo.invalid` ให้ผู้สาธิตกดเอง บัญชีนี้มี Group 2 คู่ และ Individual 15 คู่
- อีกห้อง **PairEval Demo · ห้องที่จัดคู่ไม่ได้** ใช้อธิบายการตรวจ feasibility ได้
- ห้อง **ห้อง Main Flow วันที่ 6** เป็นข้อมูลที่เกิดจากทดสอบครบขั้นตอน มีคะแนนให้เปิดดูเปรียบเทียบได้

เส้นทางสาธิต 5–10 นาที:

1. หน้าแรก → เข้า Demo ผู้สอน → เลือกห้องที่จัดคู่ได้ → เปิดงาน/หน้าสร้างคู่ อธิบาย target, workload และ Actual
2. เปลี่ยนบทบาท → เลือก `student-01@demo.invalid` → เปิดงาน → Group เลือกคำตอบ → Save draft → refresh → Submit
3. เปลี่ยนคำตอบ → Re-submit → เปิดคะแนนของฉัน แล้วกลับผู้สอนเพื่อเปิดรายงานและส่งออก CSV
4. ถ้าจะโชว์ Individual ให้ตอบบางส่วนพร้อมอธิบายผลของการส่งไม่ครบ ข้อมูลที่เตรียมไว้ทำให้ไม่ต้องตอบครบ 15 คู่ระหว่างเดโม
5. เปิดห้องที่จัดคู่ไม่ได้เพื่อแสดงข้อความเหตุผล แล้วอธิบายว่า Full System ออนไลน์เพิ่ม OAuth, PostgreSQL, XLSX, snapshot และ workflow ผู้สอน

**ก่อนนำเสนออย่ารัน `seed:reset` หรือ Main Flow test ทับชุดที่เตรียมไว้** เพราะจะล้าง/เปลี่ยนข้อมูลสำหรับซ้อม ส่วนการเปิด CSV/XLSX ด้วย Microsoft Excel ที่ติดตั้งจริงบนโน้ตบุ๊กยังไม่ได้ตรวจในรอบนี้ ตรวจเฉพาะโครงสร้างไฟล์และภาษาไทย/BOM ตามสคริปต์

## หลักฐานและสิ่งที่ส่งมอบ

- ผลทดสอบพร้อมประวัติรอบที่ selector ยังไม่ตรงและรอบแก้สำเนาแล้วผ่าน: `.verification/readiness-20261015/results.json`
- รายการ selector ที่ปรับในสำเนา: `.verification/readiness-20261015/*.changes.json`
- ภาพหน้าประเมินบนโน้ตบุ๊ก: `.verification/readiness-20261015/full-evaluation-laptop.png`
- ภาพรายงาน Full System: `.verification/readiness-20261015/full-report-laptop.png`
- ภาพเดโมสำรอง: `.verification/readiness-20261015/offline-demo-laptop.png` และ `offline-student-laptop.png`
- ไฟล์ส่งออกสังเคราะห์: `.verification/readiness-20261015/score-example.csv` และ `score-example.xlsx`
- ผล audit ฉบับเต็ม: `production-audit-20261015.json`

ตรวจเสร็จแล้วปิด Full System server และ PostgreSQL ทดสอบ เหลือเฉพาะ Demo server ที่ port 3100 เพื่อให้เปิดดูได้ทันที โค้ดแอปและ lockfile ยังคง commit เดิม ไม่มีการ commit หรือ push งานตรวจนี้
