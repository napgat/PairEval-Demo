# สารบัญเอกสาร PairEval

## เริ่มใช้งานรุ่นปัจจุบัน

| เอกสาร | ใช้เมื่อ |
|---|---|
| [README โครงงาน](../README.md) | เปิด repo ครั้งแรก |
| [GETTING_STARTED](GETTING_STARTED.md) | ติดตั้ง/เปิด–ปิด/อัปเดต local |
| [TRY_IT](TRY_IT.md) | เพื่อนลองใช้งานและรายงานปัญหา |
| [DEMO_SCRIPT_TH](DEMO_SCRIPT_TH.md) | บทพูดสาธิตภาษาไทย พร้อมเปิดหน้า กด ชี้ และทางแก้เมื่อข้อมูลไม่พร้อม สำหรับคนที่ยังไม่คุ้นระบบ |
| [MANUAL_UI_TEST](MANUAL_UI_TEST.md) | คู่มือคลิกทดสอบปัจจุบัน 100 กรณี รวมอ่านแจ้งเตือน/อ่านทั้งหมด แยกข้อมูลและบทบาท |
| [แบบบันทึก Manual UI](testing/MANUAL_UI_RESULTS_TEMPLATE.md) | คัดลอกไปกรอก PASS/FAIL/BLOCKED/NOT RUN พร้อมหลักฐานและ bug report |
| [ผล UI ครบ 98 กรณี](testing/MANUAL_UI_98_RESULTS_2026-10-17.md) | 98/98 หลังแก้และตรวจซ้ำ พร้อมผลรายข้อ ภาพจอเล็ก/ซูม และ JSON สำหรับ AI |
| [รูประฆังบน navbar](testing/NOTIFICATION_BELL_2026-10-17.md) | พฤติกรรม API และผลตรวจเฉพาะการแจ้งเตือนรุ่นใหม่ |
| [เวลาประวัติตามห้องเรียน](testing/AUDIT_TIMEZONE_2026-10-19.md) | ตรวจ API/GUI เวลาไทยและ UTC พร้อมวันข้ามเที่ยงคืนและเขตเวลาของ browser ที่ต่างกัน |
| [ผล Backend และ GUI 17 ต.ค.](testing/FULL_SYSTEM_BACKEND_UI_2026-10-17.md) | ผลทดสอบจริง การแก้ 3 จุด สูตรคะแนน/ไฟล์ส่งออก audit/recovery และกรณีที่ยังไม่ได้ตรวจ |
| [PEER_RETEST](PEER_RETEST.md) | อัปเดตและตรวจสองปัญหาเดิมรอบที่ 2 |
| [AI_HANDOFF](AI_HANDOFF.md) | ให้ AI ช่วยติดตั้งและตรวจ |
| [PROJECT_STATUS](PROJECT_STATUS.md) | ดูความพร้อมและข้อจำกัดล่าสุด |
| [AGENTS](../AGENTS.md) | กติกาทำงานสำหรับ coding agent |

## ออกแบบและหลักฐานของ Full System v2.0

| เอกสาร | ความหมาย |
|---|---|
| [การปรับตาม PRD v2.0](full-system/prd-v2.0-alignment-2026-10-15.md) | baseline ของอาจารย์ที่ใช้กับรุ่นส่งมอบนี้ |
| [แผนที่หลักฐาน 132 IDs](full-system/prd-v2.0-evidence-map.md) | requirement → implementation/test; ไม่ใช่การรับรองผ่านทั้งหมด |
| [Readiness 15 ต.ค.](full-system/prd-v2.0-readiness-2026-10-15.md) | ผลรับรองเฉพาะชุดทดสอบและข้อจำกัดด้าน NFR |
| [สาธิต/Final/อุทธรณ์ 16 ต.ค.](full-system/student-local-delivery-2026-10-16.md) | บันทึกการซ้อมและตัวเลขจากเครื่องผู้พัฒนา |
| [ปรับ UI และผล GUI](full-system/ui-usability-2026-10-16.md) | หลักฐาน 22 หน้าจอ/สถานะก่อน handoff |
| [ทีมผู้สอน: คู่มือ/API/ผลตรวจ](full-system/staff-management-2026-10-17.md) | ฟอร์มเพิ่ม–ถอด Co-teacher/TA และการเพิ่มกลับในรุ่นปัจจุบัน |
| [ผลจัดชุดให้เพื่อน](full-system/peer-handoff-2026-10-16.md) | รุ่นส่งเข้า Git, ติดตั้งใหม่ และจัด branch |
| [แก้ปัญหาจากเพื่อน](full-system/peer-feedback-2026-10-17.md) | ผลทำซ้ำ แก้ และตรวจ deadline/อุทธรณ์ วันที่ 17 ต.ค. |
| [ผลตรวจซ้ำก่อนให้เพื่อนลอง](full-system/peer-retest-2026-10-17.md) | ผลตรวจรุ่นแก้ 9e1d8fd อีกครั้งพร้อมรายการทดสอบรอบที่ 2 |

## เอกสารประวัติ — ใช้ดูที่มา

- [SQLite Demo เดิม](archive/sqlite-demo.md), [คู่มือสาธิตเดิม](demo-guide.md), `docs/day-01.md` ถึง `day-07.md`: ใช้ SQLite/port 3000 ไม่ใช่ขั้นตอนเปิด Full System
- [ชุดออกแบบเดิม](design%20document/Document%20Readme.md), PRD v2.1/188-ID matrix, v2.2 candidate และ `full-system/day-*.md`/`post-day-07-*.md`: บันทึกการพัฒนาก่อนปรับเป็น baseline v2.0 เก็บพาธไว้เพื่อรักษาลิงก์ traceability ประวัติ
- [requirements-gap-matrix เดิม](full-system/requirements-gap-matrix.md): เปรียบเทียบ Demo รุ่นเก่า ไม่ใช้ประเมินฟีเจอร์ปัจจุบัน
- [Git delivery รอบก่อน](full-system/git-delivery-2026-10-16.md) และไฟล์ใน `delivery/`: อ้างถึง ZIP ที่ตรึงก่อนปรับ UI ล่าสุด ไม่ใช่ source รุ่นล่าสุดบน main

## แผนผังไฟล์

```text
README.md / AGENTS.md          จุดเริ่มสำหรับคนและ AI
Open-*.cmd / Open-*.ps1        เปิดชุดสาธิต local
Stop-PairEval-Demo.ps1         ปิดโดยรักษาข้อมูล
src/app/full-system/           หน้าจออาจารย์และนักศึกษา
src/app/api/                   API และการตรวจสิทธิ์
src/lib/full-system-*          pairing, score, audit และงานหลัก
db/migrations/ + db/audit/     schema ของสายงานนี้
scripts/                      เตรียมข้อมูล/ตรวจ/สำรองและกู้คืน
examples/                     CSV สมมติ แยกไฟล์ Full System จาก Demo เดิม
docs/                         คู่มือปัจจุบันที่ระดับนี้; หลักฐาน/ประวัติในโฟลเดอร์ย่อย
delivery/                     บันทึก ZIP รุ่นที่ตรึงไว้
.verification/                runtime ส่วนตัว ไม่อยู่ใน Git
```

[CSV ของ Full System](../examples/full-system-roster.csv) ใช้ `email,group_name,student_id,display_name`; CSV `email,groupname` ใน `examples/` เป็น Demo เก่า อย่าใช้สลับกัน
