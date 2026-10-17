# ผลทดสอบ UI ครบ 98 กรณี — 17 ตุลาคม 2026

**ผลสุดท้าย: PASS 98 / FAIL 0 / BLOCKED 0 / NOT RUN 0** หลังแก้และทดสอบซ้ำ ใช้คู่มือ [MANUAL_UI_TEST](../MANUAL_UI_TEST.md) ไม่ใช่ผลว่าครบ PRD 132/132 หรือพร้อม production

## เครื่องและวิธีตรวจ

- Windows x64, Node.js 24.18.0, Playwright 1.63.0 / Chromium; source ตั้งต้น main `8c33107` พร้อมการแก้ที่รวมในรุ่นเดียวกับรายงานนี้ ตรวจรุ่นที่ติดตั้งด้วย `git rev-parse --short HEAD`
- ใช้ชุดทดสอบแยก `E:\PairEval-Friend-Check-20261016` และ PostgreSQL ในเครื่อง ไม่ใช้ฐาน staging หรือข้อมูลนักศึกษาจริง
- ใช้ browser automation คลิก/พิมพ์/คีย์บอร์ดและดาวน์โหลดจริง จัดห้องทดสอบใหม่ผ่าน UI ไม่ใช่บันทึกว่ามีคนทดลองบนเครื่องเพื่อนแล้ว
- นักศึกษา 1–2 และผู้สอนส่งผ่าน GUI; คำตอบอีก 14 คนเตรียมเป็น fixture ผ่าน API เพื่อให้รายงานมีข้อมูลพอ ไม่อ้างว่าคลิกครบ 16 คน อ่าน API/SQL เพิ่มเพื่อยืนยันข้อมูลภายใน ไม่ใช้แทนขั้นตอนคลิกของแต่ละกรณี
- Privacy Notice ใช้ session ของบัญชีสังเคราะห์ใหม่ที่เตรียมแยก ไม่ได้ล็อกอินผ่าน Google จริง
- SET-04 อ่านงาน Final ตัวอย่างที่เตรียมไว้เดิมและรักษาข้อมูลไว้ ส่วน SCR/APL ใช้งานใหม่ในห้อง GUI แยก รอกำหนดส่งจริงที่ตั้งผ่าน UI แล้วทดสอบเงื่อนไขเดียวกัน ไม่เปลี่ยนนาฬิกาหรือ SQL เพื่อข้ามเวลา
- เมื่อ selector/ค่าคาดของตัวทดสอบผิด หรือรันถี่จนได้ 429 ให้แก้ตัวทดสอบ/รอและทำต่อจากข้อมูลที่บันทึกจริง ไม่ปิด rate limit และไม่เปลี่ยนข้อผิดพลาดของตัวทดสอบเป็นบั๊กของแอป

## ปัญหาที่พบ แก้แล้ว และตรวจซ้ำ

| รหัส | ปัญหาก่อนแก้ | สิ่งที่แก้ / หลักฐานตรวจซ้ำ |
|---|---|---|
| B98-01 | โหลด session ไม่สำเร็จ/429 แล้วแสดงเหมือนยังไม่ได้ล็อกอิน | แสดงข้อความพร้อมปุ่มลองใหม่; จำลอง 429/503/network แล้วกดกลับเข้าสู่หน้าห้องได้ด้วย session เดิมทั้ง 3 กรณี |
| B98-02 | เปิด Individual URL ของกลุ่มไม่เกิน 2 คนแล้วแสดงกำลังโหลดไม่สิ้นสุดและเหตุผลไม่ชัด | หน้า error จบสถานะโหลด บอกเหตุผลภาษาไทย มีทางกลับ/ลองใหม่ ไม่มีคู่หรือปุ่มส่ง; SPC-01 ตรวจซ้ำผ่าน |
| B98-03 | เหตุผลลด coverage บังคำเตือนกลุ่ม 3 คนความเชื่อมั่นต่ำ | แสดงทั้งสองข้อความพร้อมกัน; SPC-02 ตรวจแผนก่อน publish และรายงานหลังประเมินผ่าน |
| B98-04 | ผู้ไม่มีสิทธิ์เปิด URL รายงานยังเห็นปุ่มคำนวณ แม้ API ปฏิเสธ | รอการตรวจสิทธิ์ก่อนแสดงรายงาน; 5 เส้นทางปฏิเสธจริงของ Student/TA ไม่มีปุ่มจัดการ/คู่/ข้อมูลรายงาน, Owner ยังเปิดรายงานได้ |
| B98-05 | ตารางรายงานจอแคบไม่รับโฟกัส, Axe แจ้ง scrollable-region-focusable | เพิ่ม Tab focus/ชื่อ region และกรอบ focus ในรายงาน แผนจับคู่และ archive; จอแคบและ browser zoom 200% ใช้ Tab เข้าตารางแล้ว ArrowRight เลื่อนได้ |
| B98-06 | ข้อความยังไม่มีลิงก์ผลงานจาง: contrast 3.04:1 | ปรับเป็นสีเข้ม #52666f; ตรวจหน้า Group/Individual ในจอ 320/390 px ผ่าน Axe หลังแก้ |

ข้อร่างน้ำหนักเกณฑ์ 90% **ไม่ใช่บั๊ก**: บันทึก DRAFT ได้ แต่ตรวจแผนและเผยแพร่ไม่ผ่านจนแก้ครบ 100% ได้เพิ่มคำอธิบายในคู่มือแล้ว

## ตรวจโค้ด ตัวเลข และข้อมูลคงอยู่

- unit tests **107/107** (24 files), typecheck, lint และ build ผ่านหลังการแก้ล่าสุด
- UI/Axe ชุดปกติ **22 หน้าจอ/สถานะ** ผ่าน, page errors 0, skipped 0
- UI จอ 320/390 px **14 หน้าจอ/สถานะ** ผ่าน: ห้อง รายชื่อ/ทีมผู้สอน จัดการงาน รายงาน/อุทธรณ์ แบบประเมินสองด้าน คะแนน/อุทธรณ์ ไม่มี Axe violations หรือ page overflow ตามที่ตรวจ
- Browser zoom 200% **6 หน้าจอ** ตรวจค่าจริง getZoom=2, DPR=2, CSS zoom=1 ไม่ใช้เพียง CSS transform; Tab เข้าตารางและเลื่อนด้วยลูกศรได้ ตัวช่วยอยู่ใน browser profile ทดสอบแยก ดู API ที่ใช้ใน [Chrome Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom) และ [Playwright extensions](https://playwright.dev/docs/chrome-extensions)
- ตรวจสูตรคะแนนอิสระ 16 คน/4 กลุ่มจาก snapshot รวม weights/criteria/participation/override แล้วเทียบ CSV/XLSX; ตรวจ Answered/Assigned, 4 sheets, QS metadata และเวลาของ snapshot เพิ่มด้วย
- ปิด–เปิด launcher จริง: ทุก snapshot/input hash, สมาชิก, draft choices, submission revisions และอุทธรณ์ที่จดไว้ตรงเดิม; Co ที่ถูกถอดยังเข้าไม่ได้ ห้อง archive ยังอยู่ถูกที่ คืนห้องแล้ว 15 คน รุ่นงานและ deadline ทั้งสองด้านไม่เปลี่ยน
- ล้างเฉพาะห้อง fixture ที่สร้างรอบนี้ **9 ห้อง** เหลือจากรายการนี้ 0; audit pending 0; ห้องสาธิตเดิมยังมีนักศึกษา 16 คน ไม่ลบ audit ประวัติ
- ผล Backend/acceptance 41 checkpoints และ recovery ก่อนรอบนี้ดู [รายงาน Backend และ GUI](FULL_SYSTEM_BACKEND_UI_2026-10-17.md) ไม่ได้นำจำนวน tests มาบวกเป็นจำนวน requirements

## ภาพตัวอย่างที่ตรวจแล้ว

- [คะแนน/อุทธรณ์ที่ 320 px](evidence/manual-ui-98-2026-10-17/student-score-320.png)
- [รายงานเมื่อ browser zoom 200% — ภาพ viewport จริง](evidence/manual-ui-98-2026-10-17/report-browser-zoom-200.png)
- [เหตุผลปิด Individual สำหรับกลุ่ม 2 คน](evidence/manual-ui-98-2026-10-17/small-group-disabled.png)

ภาพ full-page ของ browser zoom อาจถูกตัวจับภาพตัดตามพิกัด CSS จึงใช้ภาพ viewport จาก browser สำหรับตรวจภาพ และตรวจ geometry/reflow แยก ไม่ใช้ภาพที่ถูกตัดนั้นรับรองผล

## ผลรายกรณี

หลักฐานย่อยในตารางใช้ชื่อจาก log ตัวทดสอบเพื่อให้อ้างกลับได้ คำอธิบายขั้นตอนเป็นภาษาไทยตามคู่มือ เก็บภาพ/ไฟล์ส่งออก/สถานะดิบไว้ใน `.verification/manual-ui-98-20261017` เฉพาะเครื่อง ไม่ส่ง env/session/backup/key เข้า Git

### SET

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| SET-01 | PASS | เปิดชุด local แล้วเข้า 3103 | classroom created via GUI: 16 students / 4 groups | — |
| SET-02 | PASS | เข้า Owner เปิดห้องสาธิตเดิมและรายชื่อ | baseline GUI roster 16 students / 4 distinct groups | — |
| SET-03 | PASS | บันทึกชื่อห้อง/งาน URL และสถานะก่อนเริ่ม | classroom created via GUI: 16 students / 4 groups | — |
| SET-04 | PASS | เตรียมงาน Final แล้วดูเวลาที่แสดงผ่าน UI | prepare-final preserved separate pre-existing fixture; real deadline visible in editor | — |

### NAV

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| NAV-01 | PASS | Owner → ห้องเรียน ค้นหาบางส่วนของชื่อห้อง แล้วใส่คำที่ไม่มี | dashboard search and no-result state | — |
| NAV-02 | PASS | สลับทั้ง 5 บัญชีที่ 3103 แล้วเปิดการ์ดห้องสาธิต | all five roles use correct room card; profile name, back link, logo and main nav work | B98-01 |
| NAV-03 | PASS | ใช้โลโก้ PairEval, เมนูห้องเรียน และลิงก์กลับจากหน้าลึก | all five roles use correct room card; profile name, back link, logo and main nav work | — |
| NAV-04 | PASS | เปิดเมนูบัญชี → ออกจากระบบ แล้ว refresh แอป | GUI logout returns to sign in and session API is unauthorized | — |
| NAV-05 | PASS | เปิดงาน/คะแนนของ Student 1 แล้วสลับเป็น Student 2 และ refresh URL เดิม | second student independently submitted both sides | — |

### CLS

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| CLS-01 | PASS | Owner → “สร้างห้องเรียนใหม่” กรอกชื่อและ Asia/Bangkok วาง CSV 16 คน → สร้าง | classroom created via GUI: 16 students / 4 groups | — |
| CLS-02 | PASS | เริ่มสร้างห้องอีกครั้ง ลองชื่อว่างและชื่อ 1 ตัวอักษร | GUI empty/short room name and malformed CSV create no classroom | — |
| CLS-03 | PASS | สร้างห้องด้วย CSV ที่แก้อีเมลแถวหนึ่งเป็น `not-an-email` | GUI empty/short room name and malformed CSV create no classroom | — |
| CLS-04 | PASS | ในห้อง UI หลัก → รายชื่อและกลุ่ม ค้นหาชื่อ, `S001`, อีเมล และคำที่ไม่มี | GUI roster search by name, student number, email and absent term; clears correctly | — |
| CLS-05 | PASS | ก่อน publish กาง “นำเข้าหรือปรับกลุ่มด้วยไฟล์ CSV” วางไฟล์เดิม → ตรวจข้อมูล | GUI original roster preview/import is idempotent | — |
| CLS-06 | PASS | แก้ CSV ให้สองแถวใช้อีเมลเดียวกัน หรือเปลี่ยน header ผิด → ตรวจข้อมูล | GUI duplicate CSV cannot import; 16 existing members preserved | — |

### STA

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| STA-01 | PASS | Owner → รายชื่อและกลุ่ม → ทีมผู้สอน ดูแถวตนเอง | Owner email/name/role visible with no remove action | — |
| STA-02 | PASS | เพิ่ม `v20-presentation-co@example.test` เป็น “อาจารย์ร่วม” และ `v20-presentation-ta@example.test` เป็น “ผู้ช่วยสอน” | Owner read-only and staff GUI add | — |
| STA-03 | PASS | เพิ่มอีเมล Co เดิมซ้ำ, อีเมล `unknown-manual@example.test` และ `not-an-email` | GUI duplicate/unknown/invalid email and Owner/Student conversion rejected; members unchanged | — |
| STA-04 | PASS | กดถอด Co แล้วลอง “กลับไปตรวจสอบ” และ Escape จากนั้นยืนยันถอดจริง | GUI cancel button/Escape then confirmed Co removal; direct URL revoked, baseline room still readable | — |
| STA-05 | PASS | กลับ Owner เพิ่มอีเมล Co เดิมอีกครั้ง | Co restored through GUI, same membership id/join date, access restored | — |
| STA-06 | PASS | ถอด TA แล้วเพิ่มกลับเป็น Co จากนั้นถอดและคืนเป็น TA | TA removed/restored as Co with editor access, then removed/restored as TA without editor access | — |
| STA-07 | PASS | ลองเพิ่ม Owner หรือ `v20-presentation-s0@example.test` ที่เป็น Student ในห้องนี้ | GUI duplicate/unknown/invalid email and Owner/Student conversion rejected; members unchanged | — |
| STA-08 | PASS | สลับ Co/TA/Student เปิด URL รายชื่อเดิม | Co/TA can read roster without staff editor; Student has no roster data | — |

### ASN

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| ASN-01 | PASS | Owner กด “＋ สร้างงานใหม่” กรอกค่าครบ → บันทึกฉบับร่าง → refresh เปิดงานเดิม | DRAFT survives reload | — |
| ASN-02 | PASS | ใน DRAFT เปลี่ยนน้ำหนักกลุ่มให้รวม 90% แล้วบันทึก/ตรวจแผน จากนั้นคืน 60+40 | GUI permits unfinished DRAFT with group criteria 90; feasibility rejects it and cannot publish; restores 60+40 | — |
| ASN-03 | PASS | ลองคะแนนติดลบ, ช่วงต่ำสุดสูงกว่าสูงสุด หรือ weight ผู้สอนเกิน 99.99 แล้วคืนค่าเดิม | GUI negative score, reversed floor/ceiling, and instructor weight 100 rejected; valid values restored | — |
| ASN-04 | PASS | “ตรวจแผน เพิ่มผู้ประเมิน และดูประวัติ” → ใส่ seed → ตรวจความพร้อมการจับคู่ ซ้ำก่อนเปลี่ยนค่า | GUI feasibility repeated with same seed returns identical part counts/coverage/workload/reasons | — |
| ASN-05 | PASS | เมื่อแผนพร้อม กด “เผยแพร่และบันทึกคู่” แล้วสลับ Student | student Group pairs exclude own group | — |
| ASN-06 | PASS | Owner เปิดงาน OPEN ดูเกณฑ์/คะแนนเต็มและลองแก้ | feasibility, publish and locked criteria | — |
| ASN-07 | PASS | เปลี่ยนเฉพาะ deadline รายบุคคลให้ช้าลง → บันทึก → refresh | GUI extends Individual deadline alone and preserves Group after reload in Asia/Bangkok | — |
| ASN-08 | PASS | คัดลอกเป็นงานใหม่ชื่อ `UI-กลุ่มเท่านั้น` ตั้งคะแนนรายบุคคล 0 ลบเกณฑ์รายบุคคล ตั้งเกณฑ์กลุ่มรวม 100 แล้วบันทึก/ตรวจ/เผยแพร่ | GUI clone is new DRAFT, disabled Individual has no deadline and no student evaluation link after publish | — |
| ASN-09 | PASS | คัดลอกอีกงาน ตั้ง deadline เป็นเวลาใกล้ ๆ ที่ยังมีเวลาส่งจริง ทดสอบก่อน/หลังหมดเวลาตาม EVG-07 | real elapsed deadline disables editing/submission | — |

### EVG

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| EVG-01 | PASS | กรอง “เปิดรับอยู่” ค้นหาชื่องาน เปิด “ประเมินกลุ่ม” และลิงก์ผลงาน | GUI open filter/search, six choices, both linked and missing artifacts; actual HTTPS artifact popup loaded Example Domain and closed | B98-06 |
| EVG-02 | PASS | เลือกคำตอบหนึ่งคู่ รอ “บันทึกแล้ว” แล้ว refresh | fresh GUI draft/reload keeps choice/progress and remains unsubmitted | — |
| EVG-03 | PASS | กด “ล้างคำตอบ” ของคู่นั้น รอบันทึก แล้วเลือกใหม่ | progress decrements/restores on clear; navigating away/back preserves draft with submitted revision still 2 | — |
| EVG-04 | PASS | ตอบบางคู่ กด “ยืนยันส่งคำตอบ” (หรือ “ส่งฉบับแก้ไข” ถ้าเคยส่งแล้ว) → ยกเลิกก่อน → เปิดใหม่และยืนยัน | fresh partial dialog counts correct; cancel creates no revision, confirmed partial creates first revision/time | — |
| EVG-05 | PASS | เปลี่ยนคำตอบอย่างน้อยหนึ่งคู่และกด “ส่งฉบับแก้ไข” ก่อน deadline | Group revision 2 submitted via GUI | — |
| EVG-06 | PASS | เลือกคำตอบเพิ่มแล้วกลับไปหน้ารายการก่อนส่ง เปิดงานเดิม | progress decrements/restores on clear; navigating away/back preserves draft with submitted revision still 2 | — |
| EVG-07 | PASS | ใช้งานเวลาใกล้หมดที่เตรียมใน ASN-09 เปิดหน้าไว้จนพ้น deadline แล้ว refresh/ลองส่ง | real elapsed deadline disables editing/submission | — |

### EVI

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| EVI-01 | PASS | Student 1 เปิด “ประเมินรายบุคคล” เลือกคำตอบ รอ autosave และ refresh | Individual peer pairs exclude self and draft/progress survive reload independently | — |
| EVI-02 | PASS | ยืนยันส่งรายบุคคล แล้วเปลี่ยนคำตอบและส่งฉบับแก้ไข | Individual draft and two GUI submissions independent of Group | — |
| EVI-03 | PASS | เปิด “ดูคะแนนของฉัน” และ “คะแนนนี้คำนวณอย่างไร” | personal Interim and participation explanation | — |
| EVI-04 | PASS | สลับ Student 2 ทำร่าง/ส่งทั้งสองด้าน แล้วเปิดคะแนนของฉัน | both students UI Group/Individual/Total match independent latest Final; refresh stable, personal data isolated | — |

### TEA

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| TEA-01 | PASS | Owner เลือกงาน → การจับคู่และผู้ประเมิน เลือก “คู่และเกณฑ์” ใส่จำนวน 1 → เพิ่มผู้ประเมิน | extra student evaluator assigned through GUI | — |
| TEA-02 | PASS | คู่เดิม → “มอบคู่ให้ตนเอง” → “ประเมินกลุ่ม” เลือกและยืนยันส่ง | Owner self-assigned a pair and submitted GUI evaluation | — |
| TEA-03 | PASS | กดมอบคู่เดิมให้ตนเองซ้ำ จากนั้นลองจำนวนเพิ่มมากกว่าผู้มีสิทธิ์เหลือ | duplicate self assignment and excessive additional student count rejected without adding pairs | — |
| TEA-04 | PASS | Co เข้าเมนูเดียวกัน มอบ Group ให้ตนเองและส่งจริง เปิดรายงาน จากนั้นสลับ TA | TA direct instructor editor/evaluation/report URLs reveal no editor, pairs or report | B98-04 |

### RPT

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| RPT-01 | PASS | กด “คำนวณผลระหว่างดำเนินงานใหม่” จดเลขฉบับ/เวลา | saved snapshot number/time recorded; refresh does not create or lose snapshot | — |
| RPT-02 | PASS | เปิด 4 แท็บ คะแนนกลุ่ม/รายบุคคล/ความครอบคลุมคู่/คุณภาพคำตอบ | all report tabs, quality limitations and histogram | — |
| RPT-03 | PASS | เปิดคุณภาพคำตอบและกราฟ “ดูการกระจายคะแนนเปรียบเทียบตามเกณฑ์” สลับเกณฑ์ | all quality rows/QS reasons visible and histogram switches every criterion | — |
| RPT-04 | PASS | งานยังไม่ Final → คุณภาพคำตอบ → ทบทวนคำตอบที่ส่ง เลือกหนึ่งรายการ ใส่เหตุผลอย่างน้อย 10 ตัว → ตัดคำตอบออกและคำนวณใหม่ | GUI exclusion persisted, snapshot increased, participation unchanged | — |
| RPT-05 | PASS | เลือกคำตอบเดิม → คืนคำตอบและคำนวณใหม่ และลองเหตุผลสั้นกว่า 10 ตัว | short review reason cannot exclude/restore; complete cut/restore and snapshot checks passed earlier | — |

### EXP

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| EXP-01 | PASS | เปิดแท็บ Group ดาวน์โหลด CSV แล้วเปิด Individual ดาวน์โหลดอีกไฟล์ | CSV/XLSX parsed and all 16 totals checked against independent weighted calculation | — |
| EXP-02 | PASS | ดาวน์โหลด Excel (4 แผ่นงาน) | CSV Answered/Assigned and workbook Created UTC/4 sheets/QS metadata additionally checked against exported snapshot; weighted independent score oracle already passed | — |
| EXP-03 | PASS | เทียบ Group score, Individual score, Answered/Assigned, Multiplier และ Total ของ Student 1/2 กับรายงานและการคำนวณใน §10.1 | CSV Answered/Assigned and workbook Created UTC/4 sheets/QS metadata additionally checked against exported snapshot; weighted independent score oracle already passed | — |
| EXP-04 | PASS | กาง “ส่งออกคำตอบรายคู่สำหรับตรวจสอบ” → ดาวน์โหลดแบบรหัสผู้ประเมิน แล้วสลับ Co ทดลอง | Co can download pseudonymous raw choices/weights/review status, has no identity export, Final or Reopen controls | — |
| EXP-05 | PASS | Owner กาง “เปิดเผยตัวผู้ประเมิน” ลองเหตุผลสั้น แล้วใส่เหตุผลครบ กดยืนยันแต่ Cancel ก่อน จากนั้นยืนยันจริง | identity export also rejects short reason; Owner confirmed/cancelled download in prior phase | — |

### SCR

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| SCR-01 | PASS | Owner งานที่ยังไม่หมดเขต → รายงาน มี Interim แล้วกดยืนยันผลคะแนน | GUI Final before deadline rejected | — |
| SCR-02 | PASS | หลัง deadline จริงของงาน Final ตัวอย่าง → คำนวณ Interim จดฉบับ → กดยืนยันแต่ยกเลิกก่อน แล้วกดยืนยันจริง | GUI cancel then Final after real deadline | — |
| SCR-03 | PASS | Student 1 เปิดคะแนนงาน Final แล้ว refresh | both students UI Group/Individual/Total match independent latest Final; refresh stable, personal data isolated | — |
| SCR-04 | PASS | Owner กาง “เปิดทบทวนคะแนนที่ยืนยันแล้ว” ใส่เหตุผลสั้นแล้วครบอย่างน้อย 10 ตัว → เปิดคะแนนให้แก้ไข | GUI Reopen requires reason and retains old Final | — |
| SCR-05 | PASS | กาง “ปรับคะแนนพร้อมเหตุผล” เลือก INDIVIDUAL/Student 1 จดค่าเดิม ใส่ 4.25 จากเต็ม 5 (ถ้าเดิม 4.25 ใช้ 4.50) พร้อมเหตุผล → บันทึก | GUI Override to Interim does not allow closing appeal | — |
| SCR-06 | PASS | ลองคะแนนเกินเต็ม เช่น 99 สำหรับด้านเต็ม 5 แล้วคำนวณ/refresh | out-of-range override rejected; successful 4.25 retained | — |
| SCR-07 | PASS | ยืนยัน Final ใหม่ แล้วตรวจ Student 1 และ audit; สลับ Co เปิดรายงาน | Co can download pseudonymous raw choices/weights/review status, has no identity export, Final or Reopen controls | — |

### APL

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| APL-01 | PASS | Student 1 → คะแนน Final → ขอทบทวน กรอกสั้นกว่า 20 ตัว แล้วใช้ “ขอให้ทบทวนคะแนนรายบุคคลจากหลักฐานการทำงานในโครงงานตัวอย่างนี้” → ส่ง | student submits appeal and duplicate form disappears | — |
| APL-02 | PASS | Owner เปิดรายงาน → คำขอทบทวนคะแนน เลือกคำขอและพิมพ์คำตอบอย่างน้อย 10 ตัว ยังไม่กดตอบ | instructor sees student appeal and can select it | — |
| APL-03 | PASS | ทำ SCR-04 Reopen แล้วกลับกรอกคำตอบ จากนั้นทำ SCR-05 Override เป็น Interim | GUI Override to Interim does not allow closing appeal | — |
| APL-04 | PASS | ทำ SCR-07 Final ใหม่ → เลือกคำขอ ใส่ “ตรวจหลักฐานตัวอย่างและปรับคะแนนในผลยืนยันฉบับล่าสุดแล้ว” → ยืนยัน/ตอบกลับ | GUI new Final then resolved appeal | — |
| APL-05 | PASS | สลับ Student 1 แล้ว Student 2 เปิดคะแนน/ประวัติคำขอ | student 1 sees revised score and own reply, student 2 does not see it | — |
| APL-06 | PASS | ใช้คำขอแยกจาก Student 2 หรือสร้างคำขอใหม่หลังปิดเดิม (ถ้าระบบเปิดให้ภายในช่วงเวลา) → Owner ปฏิเสธพร้อมเหตุผลอย่างน้อย 10 ตัวบน Final | rejected second appeal status/reason visible to its own student | — |

### CHG

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| CHG-01 | PASS | งานยัง OPEN ลอง preview/import CSV ที่เปลี่ยนกลุ่มผ่านหน้ารายชื่อ | GUI roster change while OPEN rejected, roster unchanged | — |
| CHG-02 | PASS | Owner เปิดงาน → ยกเลิกเผยแพร่ ลอง Cancel แล้วกรอกเหตุผลครบ 5 ตัว เช่น “เปลี่ยนกลุ่มข้อมูลสังเคราะห์เพื่อทดสอบ” | GUI cancel then unpublish retains old generation | — |
| CHG-03 | PASS | เปิด CSV เดิม เปลี่ยนเฉพาะ group_name ของ s0 จากกลุ่ม 1 เป็นกลุ่ม 2 → preview → ยืนยัน | GUI preview and atomic group move of exactly one student | — |
| CHG-04 | PASS | ตรวจแผนและ publish ใหม่ → Student 1 เปิด Individual/Group และแจ้งเตือน | both Group and Individual new-generation UI have no inherited draft/submitted revision | — |

### WDR

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| WDR-01 | PASS | Owner → จัดการรายชื่อนักศึกษาและกลุ่ม → เครื่องมือทดสอบข้อมูลตัวอย่าง เลือกคนและกรอกเหตุผลสั้น | withdrawal needs a complete reason | — |
| WDR-02 | PASS | ใส่ “ถอนสมาชิกสังเคราะห์เพื่อทดสอบการจัดสรรงานใหม่” → กดถอนแล้ว Cancel จากนั้นยืนยันจริง | GUI cancellation keeps membership; confirmed withdrawal leaves 15 active students | — |
| WDR-03 | PASS | เปิดงาน รายงาน และประวัติจับคู่หลังถอน | report still loads after withdrawal and recompute | — |
| WDR-04 | PASS | ทดสอบ rollback ด้วยห้องเล็กตาม §14.1 ถอน s0 ซึ่งเป็นคนเดียวของกลุ่ม 1 | GUI infeasible withdrawal rolls back: five members and assignment generation/status unchanged | — |

### ARC

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| ARC-01 | PASS | Owner → จัดการงาน → “เก็บห้องเรียนเมื่อจบรายวิชา” → เก็บห้องเรียน ลอง Cancel แล้ว Confirm | GUI archive cancellation and confirmation; read-only archive opens | — |
| ARC-02 | PASS | เลือกห้องในหน้าเก็บแล้ว เปิดรายละเอียด จากนั้นเปิด URL งานเดิม | archived details readable; direct editor/evaluation have no mutations, classroom absent from active dashboard | — |
| ARC-03 | PASS | สลับ Student 1 และ TA ซึ่งอยู่ในห้อง archive แล้วเปิดรายละเอียด | archived Student sees own row, TA sees no scores/restore control | — |
| ARC-04 | PASS | Owner → ห้องเรียนที่เก็บแล้ว → นำห้องกลับมาใช้งาน ลองยกเลิกแล้วค่อยยืนยัน | GUI restore cancellation/confirmation after restart preserves 15 members, exact assignment status/generation and both deadlines | — |

### NOT

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| NOT-01 | PASS | หลัง publish/เปลี่ยนกลุ่ม/ยืนยัน Final สลับบัญชีผู้ได้รับผลแล้วกลับหน้าหลัก → การแจ้งเตือน | publish/group-change/Final messages visible without numeric score/evaluator identity; both work and score notification deep links open correct destinations | — |
| NOT-02 | PASS | คลิกลิงก์แจ้งเตือนของงานและคะแนน | publish/group-change/Final messages visible without numeric score/evaluator identity; both work and score notification deep links open correct destinations | — |
| NOT-03 | PASS | Owner/Co เปิดรายงาน → ประวัติการทำรายการของห้องเรียน เทียบเหตุการณ์ที่เพิ่งทำ | both Owner and Co report UI display committed classroom activity history | — |

### DAT

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| DAT-01 | PASS | Student 1 → เมนูบัญชี → ขอสำเนาข้อมูลของฉัน เปิด `paireval-my-data.json` ด้วยตัวอ่านข้อความ | GUI JSON downloads for two students contain only own profile, submissions and scores | — |
| DAT-02 | PASS | สลับ Student 2 ดาวน์โหลดไฟล์อีกครั้ง เก็บคนละชื่อแล้วเทียบ | GUI JSON downloads for two students contain only own profile, submissions and scores | — |
| DAT-03 | PASS | Student/TA เปิด URL รายงานหรือจัดการงานที่จดจาก Owner และเปิด URL ห้องที่ตนไม่ได้สังกัด | Student and TA direct URLs for non-member classroom expose no roster or teacher editor; role report denials checked | B98-04 |
| DAT-04 | PASS | เฉพาะเมื่อผู้ดูแลเตรียมบัญชีสังเคราะห์ที่ยังไม่รับทราบ Notice ให้: เข้าแอป อ่านประกาศ ออกจากระบบก่อนยอมรับ แล้วเข้ามากดรับทราบ | fresh synthetic session: notice blocks rooms, logout without acceptance, acknowledge then reload persists; no real OAuth claim | — |

### UX

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| UX-01 | PASS | ใช้ Tab/Shift+Tab/Enter/Space จากหน้าหลักถึงฟอร์มทีมผู้สอนและแบบประเมิน | Full keyboard-only journey after role selection: dashboard room link > teacher editor > roster > staff form with Tab/Enter/Space/Shift+Tab; student dashboard > work > Group radio arrows. Visible focus and no unintended mutation. | — |
| UX-02 | PASS | ในรายงาน ใช้ลูกศรซ้าย/ขวา Home/End สลับแท็บ และ Escape ปิด dialog/เมนูบัญชี | report ArrowLeft/Right/Home/End activate and focus expected tabs; account Escape restores focus; dialogs tested cancel/Escape with focus return | — |
| UX-03 | PASS | ย่อหน้าต่างหรือใช้ responsive mode ของ browser ที่ 390 และ 320 px ตรวจหน้าหลัก roster ทีมผู้สอน งานประเมิน คะแนน รายงาน และอุทธรณ์ | 390px and 320px: dashboard, roster/staff, assignment editor, report/appeals, Group/Individual, score/appeal; Axe zero, no page overflow, last radio visible above non-sticky submission footer | B98-05 / B98-06 |
| UX-04 | PASS | ซูม browser 200% และใช้คีย์บอร์ดเลื่อนตารางในจอแคบ | Real Chromium tabs.setZoom=2 verified via getZoom/DPR=2, CSS zoom=1; six screens reflow, keyboard scroll of report table, Axe no violations | B98-05 |
| UX-05 | PASS | ทดสอบร่างค้างเมื่อเชื่อมต่อขาด: เปิดแบบประเมินที่ยังไม่หมดเขต ใช้ DevTools ตั้ง Network Offline เลือกคำตอบ แล้วคืน No throttling/Online รอสำเร็จและ refresh | real browser Offline/Online queues choice, reconnect syncs draft, reload retains choice and never auto-submits | — |
| UX-06 | PASS | จดห้อง สมาชิก draft/revision คะแนน Final และสถานะอุทธรณ์ → หยุดด้วย Stop script ใน GETTING_STARTED → เปิด .cmd และเลือกบทบาทใหม่ | after real restart, removed Co remains denied, archived classroom stays archived, Individual unsubmitted draft persists; all recorded revisions/Final/appeals match | — |

### SPC

| ID | ผล | กรณีที่ตรวจ | หลักฐาน / สิ่งที่พบ | บั๊กที่แก้ |
|---|---|---|---|---|
| SPC-01 | PASS | ใช้ s0–s5 จำนวน 6 คน เปลี่ยน group_name เป็น 3 กลุ่ม กลุ่มละ 2 คน สร้างงาน/ตรวจแผน/publish แล้ว Student 1 เปิดงาน | groups of two have no Individual action/pair; direct URL shows clear disabled reason without endless loading | B98-02 |
| SPC-02 | PASS | ใช้ s0–s8 จำนวน 9 คน แบ่ง 3 กลุ่ม กลุ่มละ 3 คน ตรวจแผนแล้ว publish เปิด Individual จากนั้นคำนวณ Interim และเปิดรายงาน | groups of three: feasibility low-confidence warning, only two peers in Individual, report retains low confidence | B98-03 |
| SPC-03 | PASS | ใช้ CSV ตัวอย่างเฉพาะ 8 คนแรก ซึ่งเป็น 2 กลุ่ม กลุ่มละ 4 คน สร้างงานแล้วตรวจแผน | two groups of four cannot publish; feasibility reason remains visible | — |

## ขอบเขตที่ยังเลื่อน

คืนชุดสาธิตเดิม `E:\PairEval-Professor-Review-20261016` แล้ว โดยคัดลอกเฉพาะ source/คู่มือ ไม่คัดลอกฐานหรือ env: source ตรงกับ worktree ที่ตรวจ, build และ UI/Axe 22 สถานะผ่านอีกครั้ง เปิดได้ที่ [หน้าตัวเลือกบทบาท](http://localhost:3103) การแก้และเอกสารรอบนี้รวมอยู่ในรุ่นเดียวกับรายงานนี้ สำหรับเครื่องเพื่อนให้เริ่มที่ [คู่มือตรวจซ้ำ](../PEER_RETEST.md)

การผ่าน 98 กรณีคือชุดพฤติกรรมของต้นแบบที่คู่มือระบุ รวม SPC-03 ที่ยืนยันข้อจำกัดห้องสองกลุ่ม **ไม่ได้แปลว่าข้อจำกัดนั้นผ่าน PRD แล้ว** OAuth/entitlement บัญชีจริง, deploy รุ่นล่าสุด, hosting cron, export ใหญ่แบบ background/email, production load/security และ screen reader ทุกหน้ายังไม่ได้รับรอง ส่วนเพื่อนยังต้องตรวจบนเครื่องตนเอง

[ผลแบบ JSON สำหรับ AI](manual-ui-98-results-2026-10-17.json) มีเฉพาะสถานะ/คำอธิบายที่แชร์ได้ แบบฟอร์มเปล่า [MANUAL_UI_RESULTS_TEMPLATE](MANUAL_UI_RESULTS_TEMPLATE.md) คงไว้ให้แต่ละคนกรอกผลของตน ไม่แทนผลเพื่อนด้วยผลรอบนี้
