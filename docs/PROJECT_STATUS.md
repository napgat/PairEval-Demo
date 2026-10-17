# สถานะโครงงาน — 17 ตุลาคม 2026

## ความพร้อมประมาณ 95% สำหรับต้นแบบนักศึกษา

เปอร์เซ็นต์นี้เป็น **ประมาณการการส่งมอบตามขอบเขตที่ตกลง** ไม่ใช่สัดส่วน FR/NFR ของ PRD ทั้งหมด และไม่คำนวณจากจำนวน tests หรือจำนวน requirement ที่มีลิงก์

| หมวดส่งมอบ | น้ำหนัก | สถานะ |
|---|---:|---|
| ฟังก์ชันหลักสำหรับสาธิตอาจารย์–นักศึกษา | 70% | มี implementation และผลตรวจ local ตามหลักฐานด้านล่าง |
| ตรวจ workflow/สิทธิ์/ตัวเลข/ข้อมูลคงอยู่ของต้นแบบ | 15% | ผ่านชุดทดสอบที่ระบุ ขอบเขตจำกัดตามรายงาน |
| คู่มือคน/AI และทดลองติดตั้ง source แยกจากเครื่องเดิม | 10% | จัดชุด handoff และตรวจตามบันทึกการส่งมอบ |
| เพื่อนติดตั้งและลองบนคอมพิวเตอร์ของตนเอง | 5% | ส่งรายงานแล้ว 2 ปัญหา ทำซ้ำและแก้ผ่าน local; **รอเพื่อนตรวจซ้ำ** ก่อนปิด acceptance |

เมื่อเพื่อนลองแล้วพบข้อผิดพลาด ต้องแก้และตรวจซ้ำก่อนปิดงาน 100% ของขอบเขตต้นแบบ การรับรอง production เป็นอีกขอบเขตหนึ่ง

## ฟีเจอร์ที่มีสำหรับทดลอง

- การแจ้งเตือนบนรูประฆัง navbar ทุกหน้า พร้อมจำนวนยังไม่อ่าน/อ่านทั้งหมด ดู [พฤติกรรม API และผลตรวจเฉพาะ](testing/NOTIFICATION_BELL_2026-10-17.md); คู่มือปัจจุบันเพิ่มเป็น 100 กรณี ผลครบ 98 ของรุ่นก่อนยังเก็บเป็นหลักฐานแยก

- ห้องเรียน, roster/กลุ่ม, Owner/Co-teacher/TA/Student และสิทธิ์ตามห้อง
- Owner จัดการทีมผู้สอนผ่านหน้ารายชื่อและกลุ่ม: เพิ่มด้วยอีเมล ถอด และเพิ่มกลับโดยเก็บประวัติสมาชิก
- งาน DRAFT, feasibility, seeded pairing, publish/unpublish/clone, deadline และประวัติ generation
- ประเมิน Group/Individual, draft, ส่งซ้ำแบบเก็บ revision, ตรวจ deadline และคะแนนเฉพาะตน
- Instructor evaluation/น้ำหนัก, เพิ่มผู้ประเมิน, เปลี่ยนกลุ่ม/ถอนนักศึกษาและทบทวนคำตอบตามขอบเขตในรายงาน
- คะแนน Interim/Final เป็น snapshot, Reopen/Override พร้อมเหตุผล, รายงาน/CSV/XLSX และอุทธรณ์
- Quality signals/coverage, การแจ้งเตือน, งานคำนวณและเตือนด้วย worker/คำสั่ง local
- Export ที่จำกัดสิทธิ์, คำขอข้อมูล/anonymize สังเคราะห์, audit outcome และสำรอง–กู้คืน local
- UI อาจารย์/นักศึกษาใช้เมนูร่วม ค้นหา สถานะภาษาไทย keyboard/dialog และหน้าจอแคบ

รายการนี้ยืนยันว่ามีเส้นทางให้ทดลอง ไม่ได้แปลว่าทดสอบทุก edge case หรือข้อกำหนดย่อยครบทั้งหมด

## หลักฐานที่ใช้

| หลักฐาน | ผลและขอบเขต |
|---|---|
| [UI ครบคู่มือ 98 กรณี 17 ต.ค.](testing/MANUAL_UI_98_RESULTS_2026-10-17.md) | 98 PASS, 0 FAIL/BLOCKED/NOT RUN; แก้เพิ่ม 6 จุด, จอเล็ก 14 สถานะ/zoom 6 สถานะ, unit 107/107; ยังไม่ใช่ PRD หรือ production ครบทุกข้อ |
| [Backend และ GUI รอบเต็ม 17 ต.ค.](testing/FULL_SYSTEM_BACKEND_UI_2026-10-17.md) | unit 107/107, acceptance 41 checkpoints, GUI เส้นทางหลัก, ตรวจสูตร/CSV/XLSX 16 คน, audit/recovery; แก้ contrast/timing/หน้าจอเมื่อไม่มีสิทธิ์; ไม่อ้าง manual 98/98 |
| [Readiness v2.0](full-system/prd-v2.0-readiness-2026-10-15.md) | acceptance ชุดเดิม 41/41, recovery สังเคราะห์ และผลโหลดที่ยังมีข้อไม่ผ่าน |
| [ซ้อมส่งมอบ](full-system/student-local-delivery-2026-10-16.md) | GUI Group/Individual, Final→อุทธรณ์→Reopen→Override→Final; ตรวจคะแนนอิสระ 16 คนและ CSV/XLSX |
| [UI usability](full-system/ui-usability-2026-10-16.md) | unit 88/88, typecheck/lint/build, GUI/Axe 22 หน้าจอ/สถานะ; ไม่รับรอง WCAG ทุกข้อ |
| [Peer handoff](full-system/peer-handoff-2026-10-16.md) | ผล source ติดตั้งใหม่, checks ของรุ่นส่ง Git และ branch ที่จัดเก็บ |
| [แก้ผลทดลองจากเพื่อน 17 ต.ค.](full-system/peer-feedback-2026-10-17.md) | Deadline ของด้านคะแนน 0 และปิดอุทธรณ์หลัง Final; 94/94 tests และ GUI/API regression ผ่าน |
| [ตรวจซ้ำก่อนให้เพื่อนลองรอบที่ 2](full-system/peer-retest-2026-10-17.md) | ผลตรวจรุ่นแก้ซ้ำ; ใช้ [PEER_RETEST](PEER_RETEST.md) ให้เพื่อนตรวจบนข้อมูลเดิม |
| [ทีมผู้สอน 17 ต.ค.](full-system/staff-management-2026-10-17.md) | GUI/API เพิ่ม–ถอด–เพิ่มกลับ, ตรวจสิทธิ์, audit และจอ 320/390 px; unit 106/106 |
| [Evidence map](full-system/prd-v2.0-evidence-map.md) | traceability 132 IDs ของ baseline v2.0; มีข้อ partial และ mapped evidence ไม่ใช่ผ่าน 132/132 |

## สิ่งที่ยังไม่รับรอง / เลื่อนตามขอบเขตนักศึกษา

- เพื่อนทดลองและส่ง feedback แล้ว แต่ยังรอการตรวจซ้ำหลังแก้ 2 ปัญหา ไม่ปิดเป็น 100% จากผล local อย่างเดียว
- ทีมผู้สอนเพิ่มได้เฉพาะบัญชีที่มีอยู่และไม่ถูกปิดใช้งาน ยังไม่มีคำเชิญทางอีเมลหรือการสมัครบัญชีแทนผู้อื่น
- Google OAuth จริง, first-login Privacy Notice จริง และนโยบายก่อนรับข้อมูลส่วนบุคคลจริง
- ความครบ PRD/NFR ทุกข้อ, โหลดพร้อมกันจริง, uptime และ security review ระดับ production
- screen reader ทุกหน้า, ทุก browser/OS และทุกเส้นทาง accessibility
- scheduler บน hosting, backup นอกเครื่องและ recovery ระดับองค์กร; local worker/command ใช้สาธิตได้
- dependency audit รอบก่อน: production ไม่มี high/critical แต่มี moderate 2; ถ้านับ dev tools มี high 5 ต้องประเมินก่อนใช้งานกว้างขึ้น
- ยังไม่ deploy สาย v2.0 ล่าสุดลงฐาน staging เดิม และ migration 013–015 ชนกับสาย v2.1 ต้อง reconcile ก่อน

## งานที่ต้องทำต่อ

1. เจ้าของให้สิทธิ์ GitHub แก่เพื่อน (รีโปเป็น Private) หรือส่ง source ZIP ของ main แล้วเพื่อนทำตาม [คู่มือติดตั้ง](GETTING_STARTED.md) และ [รายการทดสอบ](TRY_IT.md)
2. ส่งผลกลับพร้อม commit/environment/ข้อที่ข้าม แก้เฉพาะปัญหาที่พบแล้วตรวจซ้ำ
3. ตรึง commit ที่เพื่อนตรวจผ่านเป็นรุ่นนำเสนอ เก็บข้อมูลสังเคราะห์ในเครื่องของแต่ละคน ไม่ส่ง DB/session ต่อกัน

การดูเอกสารออกแบบเดิมหรือจำนวน tests เพิ่มอย่างเดียว ไม่ปิดงานข้อ 1–2 ให้โดยอัตโนมัติ
