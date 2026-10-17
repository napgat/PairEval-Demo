# ผลทดสอบ Backend และ GUI — 17 ตุลาคม 2026

**มีผลตรวจต่อจากรอบนี้แล้ว:** [UI ครบ 98 กรณี](MANUAL_UI_98_RESULTS_2026-10-17.md) ปิดกรณี GUI ที่เอกสารนี้เคยระบุว่ายังไม่ได้ตรวจ พร้อมการแก้เพิ่มเติม 6 จุด เอกสารด้านล่างเก็บผล Backend/GUI ของรอบก่อนหน้า ไม่ใช้รายการ “ยังไม่ได้ตรวจ” ด้านล่างเป็นสถานะล่าสุด

## สรุป

**เส้นทางหลักของต้นแบบ local ผ่านหลังแก้ปัญหาที่พบ 3 จุด** ทดสอบด้วยข้อมูลสังเคราะห์บน Windows x64, Node.js 24.18.0 และ PostgreSQL ในเครื่อง ตาม baseline PRD v2.0 รุ่นตั้งต้น `8c33107` พร้อมการแก้ที่รวมในรุ่นเดียวกับรายงานนี้

ผลนี้ไม่ใช่การรับรอง PRD 132/132 หรือ manual UI 98/98 และไม่ใช้แทนการตรวจซ้ำบนเครื่องเพื่อน ผลเดิมในเอกสารประวัติยังเป็นผลของรุ่น/วันนั้น

- โค้ดและเอกสาร: independent worktree `E:\PairEval-Commit-20261016`
- ชุดตรวจแยก: `E:\PairEval-Friend-Check-20261016` ใช้ฐาน local แยกจากข้อมูลนำเสนอ
- แอป/ตัวเลือกบทบาท: `localhost:3101` / `localhost:3103` ใช้ครั้งละหนึ่งชุด
- ไม่มีการทดสอบกับข้อมูลผู้ใช้จริงหรือแก้ฐาน staging ในรอบนี้

## 1. Backend และการตรวจโค้ด

| ชุดตรวจที่รันจริง | ผล | สิ่งที่ยืนยัน |
|---|---|---|
| `npm test` | 107/107, 24 files | รวม regression ป้องกัน timing lease เปิดใหม่ระหว่างส่งคำตอบ |
| `npm run typecheck`, `npm run lint`, `npm run build` | ผ่าน | รันซ้ำหลังแก้หน้าจอและ timing |
| `npm run test:prd-v20` | 41/41 checkpoints | API contract/สิทธิ์, CSV atomic, pairing, draft/offline/idempotency, export, immutable snapshot, local jobs, retention/anonymize, archive และ Firefox/WebKit ตามกรณีในสคริปต์ |
| `node scripts/day3-assignment-smoke.mjs development` | ผ่าน | DRAFT/criteria/weights, publish, generation, clone, feasibility/rollback, group change และ notification/reminder |
| `node scripts/day4-evaluation-smoke.mjs development` | ผ่าน | ประเมินสองด้าน, revisions, deadlines, privacy และคะแนนของตน พร้อม browser flow |
| `node scripts/day5-score-smoke.mjs development` | ผ่าน | snapshot/override/Final/Reopen/appeal, report และ CSV/XLSX |
| `node scripts/day7-instructor-smoke.mjs development` | ผ่าน | ผู้สอนประเมิน น้ำหนัก ผู้ประเมินเพิ่ม สิทธิ์ และ UI จอแคบ |
| `node scripts/post-day7-withdrawal-smoke.mjs development` | ผ่าน | ถอนสมาชิก/ทดแทนคู่/rollback, version/role/origin guard และ review ตัด–คืนคำตอบ; ชุดนี้เรียก flow ของ Day 5 ด้วย |
| `node scripts/post-day7-quality-smoke.mjs development` | ผ่านหลังแก้ timing | QS-05–07, เวลา browser จริง 7,004 ms, z=4.541868715470695, W=0, CSV/XLSX, NA, score invariance, bounds/replay/access denials |
| `node scripts/staff-ui-check.mjs` | ผ่าน 8 checkpoints | เพิ่ม–ถอด–เพิ่มกลับผู้สอน, ปฏิเสธบัญชี/บทบาทผิด, audit 6 outcomes และจำลอง 202/503/network failure |

ชุด acceptance 41 checkpoints รันก่อนการแก้หน้าจอ/timing ในรอบนี้ จากนั้นตรวจ regression ที่เกี่ยวข้องและ gates ของโค้ดซ้ำ ไม่ได้นำจำนวนชุดตรวจมาบวกเป็นจำนวน requirements ที่ผ่าน

## 2. คลิก GUI ที่ทำจริง

ใช้ Playwright ควบคุม Chromium และรอผลจากปุ่ม/ฟอร์มจริง การอ่าน API/ฐานใช้ยืนยันผลภายใน และเตรียมคำตอบนักศึกษาอีก 14 คนเป็น fixture; **ไม่ได้อ้างว่าคลิกประเมินครบทั้ง 16 คน**

| ส่วน | สิ่งที่คลิกและผลที่ตรวจ |
|---|---|
| เข้าใช้/เมนู | เลือก Owner, Co-teacher, TA และนักศึกษา 1–2; ค้นหาห้อง/งานและผลว่าง; ออกจากระบบแล้ว session ตอบ 401 |
| สร้างห้อง/รายชื่อ | สร้างห้อง 16 คน/4 กลุ่ม; ชื่อว่าง/สั้นและอีเมลผิดไม่สร้างห้อง; ค้นหารหัส/อีเมล; preview/import CSV เดิมไม่ซ้ำ; duplicate CSV ถูกปฏิเสธและสมาชิกเดิมครบ |
| ทีมผู้สอน | เพิ่ม Co/TA; ยกเลิก/Escape/ยืนยันถอด; เข้า URL หลังถูกถอดไม่ได้; เพิ่มกลับได้และเก็บประวัติ; ปฏิเสธ Owner/Student/บัญชีที่ไม่พบหรือ disabled ตามกรณีของสคริปต์ |
| งาน/จับคู่ | สร้าง DRAFT แล้ว reload; ตรวจแผนและ publish; เกณฑ์ถูกล็อก; เพิ่มผู้ประเมิน; Owner/Co มอบคู่ให้ตนเองแล้วประเมินจริง |
| Deadline/clone | ขยายเฉพาะ Individual แล้ว reload ค่า Group เท่าเดิมใน Asia/Bangkok; clone เป็น DRAFT แยก เปลี่ยน Individual เป็น 0 แล้ว publish นักศึกษาไม่มีลิงก์ประเมินด้านที่ปิด |
| Student Group | เลือก/ล้าง/บันทึกร่างแล้ว reload; ส่งบางส่วนโดยยกเลิก dialog ก่อน; ส่งฉบับแก้ไข revision 2; ไม่พบคู่ของกลุ่มตน; หมดเวลาจริงแล้วแก้/ส่งไม่ได้ |
| Student Individual | นักศึกษา 1 ส่งสอง revisions แยกจาก Group; นักศึกษา 2 ส่งทั้งสองด้านผ่าน GUI; คะแนนและคำอุทธรณ์แยกตามบัญชี |
| รายงาน/review | คำนวณ Interim; เปิด 4 แท็บ/กราฟ; ตัดและคืนคำตอบพร้อมเหตุผล เกิด snapshot ใหม่แต่จำนวนการมีส่วนร่วมไม่เปลี่ยน |
| Export | ดาวน์โหลด CSV Group/Individual และ Excel 4 sheets; raw แบบรหัสแทนตัวไม่มีอีเมล; Owner ยกเลิกก่อนยืนยัน identity export พร้อมเหตุผล |
| Final/อุทธรณ์ | ก่อน deadline ยืนยัน Final ถูกปฏิเสธ; รอเวลาจริง → ยกเลิกแล้ว Final → Student ยื่นคำขอ → Reopen → Override 4.25 → Final ใหม่ → ตอบคำขอ; ปุ่มตอบปิดขณะ Interim; เกินคะแนนเต็มถูกปฏิเสธ; คำขอของนักศึกษา 2 ทดสอบปฏิเสธพร้อมเหตุผล |
| เปลี่ยนกลุ่ม | Cancel/unpublish → preview ย้าย s0 หนึ่งคน → import → publish generation 2; คู่/ร่างใหม่ไม่ใช้ submission เก่า และ revision generation 1 ยังอยู่ |
| ถอนสมาชิก | เหตุผลสั้นกดไม่ได้; Cancel คง 16 คน; ยืนยันเหลือ 15 คนและรายงานเปิดได้; กรณี rollback ที่จัดทดแทนไม่ได้ตรวจผ่านชุด Backend แยก |
| เก็บ/คืนห้อง | Cancel/ยืนยัน archive; Student อ่านได้เฉพาะคะแนนตน TA ไม่เห็นคะแนนหรือปุ่ม restore; Owner Cancel/Escape แล้วคืนห้อง สมาชิกหลังถอนยัง 15 คน |
| แจ้งเตือน/audit | เปิดลิงก์แจ้งเตือนของนักศึกษาไปหน้าที่ระบุ; เปิดประวัติห้องในรายงานและพบ COMMITTED |
| สำเนาข้อมูล | นักศึกษา 1–2 ดาวน์โหลด JSON ผ่านเมนูจริง ตรวจ profile/submissions/scores ของแต่ละคน ไม่มีอีเมลผู้อื่นในไฟล์ |
| Privacy Notice | เตรียม session ของบัญชีสังเคราะห์ใหม่ที่ยังไม่รับทราบ → หน้าห้องถูกกั้น → logout ไม่เกิด acceptance → เข้าใหม่และกดรับทราบ → reload ไม่ถามซ้ำ; ไม่ได้ผ่าน Google จริง |
| สิทธิ์ URL โดยตรง | Student เปิดรายงานไม่ได้; หน้า teacher editor หลังแก้แสดงข้อความเข้าไม่ได้ ไม่มีปุ่มสร้างงาน; TA/Co มีข้อจำกัดตามบทบาทที่ตรวจ |
| เปิด–ปิดระบบ | หยุดและเปิดผ่าน launcher จริง เปรียบเทียบทุก snapshot/input hash, membership, appeal และ submission revision ของ fixture ตรงเดิม; เปิด Final/คะแนน 4.25/คำตอบอุทธรณ์ผ่าน GUI อีกครั้ง |

### ตรวจตัวเลขแยกจากโค้ดคะแนน

คำนวณจาก pairs/answers และ config ของ snapshot โดยไม่ import ฟังก์ชันคำนวณคะแนนของแอป: แปลง choice เป็น 1/0.8/0.6/0.4/0.2/0 ตามด้านที่แสดง, ถ่วงน้ำหนักผู้สอน, criteria, floor/ceiling, participation และ override แล้วเทียบ **16 นักศึกษา/4 กลุ่ม** ความต่างไม่เกิน 0.00011

อ่าน CSV/XLSX ด้วย parser แล้วเทียบคะแนนนักศึกษาทั้ง 16 คนกับผลอิสระจาก snapshot เดียวกัน ตรวจชื่อแผ่นงาน จำนวนแถว และ metadata snapshot ด้วย ไม่ได้ตรวจเพียงว่าไฟล์ดาวน์โหลด/เปิดได้ ส่วน Final เดิมยังมี input/output เดิมหลัง Reopen/Override/Final ใหม่

## 3. Accessibility และจุดที่แก้

`npm run test:demo-ui` รอบสุดท้ายผ่าน **22 หน้าจอ/สถานะ, page errors 0, skipped 0** ไม่มี Axe violations หรือ page horizontal overflow ตามเงื่อนไขของสคริปต์ ครอบคลุม 320/390 px, keyboard report tabs, focus/cancel/Escape ของ dialog และหน้าคะแนน Final

ตรวจเพิ่มหน้า Privacy Notice และหน้าคะแนนเมื่อกาง “คะแนนนี้คำนวณอย่างไร” ข้อค้นพบ/การแก้:

| ปัญหาจริง | การแก้และผลตรวจซ้ำ |
|---|---|
| ข้อความอธิบายคะแนน contrast ประมาณ 4.07:1 ต่ำกว่าเกณฑ์ 4.5:1 | ปรับสี `.fs-score-explainer p` ให้เข้มขึ้น; กางรายละเอียดแล้ว Axe ผ่าน |
| Timing อาจเปิด lease ใหม่จาก focus/pointer/observer ระหว่าง submit ทำให้ระยะเวลาที่ส่งเป็น NA | หยุดเริ่ม lease ระหว่าง `finish()`/submit แล้วเปิดรับการแก้ต่อหลังจบ request; เพิ่ม unit regression และ browser QS ผ่าน |
| Student เปิด URL teacher editor แล้วเห็นปุ่มสร้างงาน แม้ API ปฏิเสธ/ไม่มีข้อมูลงาน | กั้นหน้าจอระหว่างโหลดและเมื่อโหลดข้อมูลไม่ได้ แสดง error/ทางกลับ/ลองใหม่; เปิด URL ด้วย Student ซ้ำแล้วไม่มีปุ่มสร้าง |

ปรับสคริปต์เก่าที่ใช้ข้อความ/selector หรือ native confirm ก่อนเปลี่ยน UI ให้ตรง dialog ปัจจุบัน และกำหนดลิงก์ roster ของห้องเป้าหมายเพื่อทำงานได้เมื่อมีหลายห้อง การ timeout จาก selector เก่าไม่ถูกรายงานเป็นบั๊กของแอป และไม่ถือว่ารอบที่หยุดกลางทางผ่านจนกว่าจะรันส่วนที่เหลือสำเร็จ

## 4. Audit / สำรอง–กู้คืน / เก็บข้อมูลเดิม

- `node scripts/audit-smoke.mjs development` ผ่าน: role แอปเพิ่ม/อ่าน audit ได้ แต่ UPDATE/DELETE/TRUNCATE ถูกปฏิเสธด้วย 42501
- `npm run db:restore-drill` ผ่านในฐานชั่วคราว: operational **35 tables/4,062 rows**, audit **1 table/780 rows** ตรงกับ backup ทุกแถว; ตรวจ wrong key/tamper; restore 2.903 วินาที ไม่แทนที่ฐานที่ใช้อยู่
- ตัวเลข rows คือข้อมูล ณ backup เวลานั้น ไม่ใช่จำนวนปัจจุบันและไม่ใช่การรับรอง RTO ของระบบจริง
- ล้างเฉพาะห้องสังเคราะห์ที่สร้างใน browser รอบนี้ **9 ห้อง**, ห้องเหลือจากรายการนี้ **0**, audit pending **0**, page errors **0**; ห้องฐานสาธิตเดิมยังมีนักศึกษา **16 คน** ไม่ลบ audit ประวัติ
- ชุดนำเสนอเดิม `E:\PairEval-Professor-Review-20261016` แยกข้อมูลจากชุดทดสอบ ใช้ source ที่แก้แล้วหลังตรวจ ไม่คัดลอก DB/env/session ระหว่างชุด
- คืนชุดนำเสนอเดิมแล้ว: build ผ่าน, GUI/Axe 22 หน้าจอ/สถานะผ่านอีกครั้งโดยไม่ข้ามกรณี; app health และหน้าตัวเลือกบทบาทตอบ 200

## 5. ข้อที่ไม่ควรอ้างว่าผ่านจากรอบนี้

- คู่มือ [Manual UI 98 กรณี](../MANUAL_UI_TEST.md) เป็นรายการให้คนทดสอบต่อ ไม่ใช่ 98 PASS: ยังไม่ได้คลิกทุกขั้นตอนย่อย เช่น TA เปลี่ยนเป็น Co แล้วคืนบทบาทครบชุด, small-group SPC ทั้งสามแบบผ่าน GUI, zoom 200% และลิงก์ผลงานภายนอกทุกประเภท กรณีบางอย่างมีหลักฐาน Backend แต่ไม่แทน GUI
- Keyboard/Axe/viewport ผ่านเฉพาะกรณีที่ระบุ ไม่รับรอง screen reader ทุกหน้า WCAG ครบชุด หรืออุปกรณ์จริงทุกชนิด
- Google OAuth/entitlement/Privacy Notice สำหรับบัญชีจริง, deploy ล่าสุด, cron hosting, export ใหญ่แบบ background/email, โหลดพร้อมกันจริง และ recovery นอกเครื่อง ยังอยู่ในงานที่เลื่อนตามขอบเขต
- ไม่ใช้ผล local แทนการให้เพื่อนทดลองรุ่นแก้อีกครั้ง การแก้รอบนี้รวมอยู่ในรุ่นเดียวกับรายงานนี้

หลักฐาน runtime เช่นภาพ, ไฟล์ส่งออก, acceptance/results/restore drill และข้อมูล fixture อยู่ใน `.verification/` ของชุดทดสอบ เป็นข้อมูลส่วนตัวของเครื่อง **ไม่ใส่โฟลเดอร์นี้หรือ backup/key ลง Git** เอกสารนี้สรุปผลที่แชร์ได้; ใช้คู่มือ manual และสคริปต์ในตารางสำหรับตรวจซ้ำ
