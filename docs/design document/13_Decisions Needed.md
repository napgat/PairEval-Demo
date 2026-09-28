# 13 — ข้อตัดสินใจสำหรับพัฒนาและเรื่องที่ยังต้องรับรอง

**แหล่งหลัก:** [PRD v2.1](pairwise_evaluation_prd%201.md) หัวข้อ 7–12, 17 และ [Traceability Matrix](12_Traceability%20Matrix.md)  
**วันที่จัดระเบียบ:** 28 กันยายน 2026; ตรวจต่อ 29 กันยายน 2026  
**สถานะ:** เป็นข้อสรุปที่ AI เสนอให้ใช้ **พัฒนาด้วยข้อมูลสังเคราะห์** ตามที่ผู้ใช้มอบหมายให้ตัดสินใจพร้อมเหตุผล; **ไม่ใช่คำอนุมัติของอาจารย์ มหาวิทยาลัย Registrar, IT หรือ Privacy Officer** และไม่ใช่หลักฐานว่า implementation ผ่านแล้ว

## วิธีอ่านและผลรวม

- **เลือกใช้พัฒนา** = เลือกกติกาที่มีเหตุผลพอให้ลงมือออกแบบ/เขียนโค้ดและทดสอบต่อ โดยยังต้องตรวจรับก่อนใช้คะแนนจริง
- **มีเงื่อนไข** = ใช้แนวทางจำกัดกับ staging/ข้อมูลสังเคราะห์ได้ แต่ยังปิดเรื่องนโยบายภายนอกหรือรายละเอียดสัญญา API ไม่ได้
- **ต้องแก้ PRD** = ข้อสรุปที่ขัดกับ default/ข้อความใน PRD v2.1; ข้อเสนอเป็นรายการ [Errata E-01–E-07](15_PRD%20v2.1%20Errata%20Proposal.md) และต้องออก version ใหม่ก่อนอ้างว่า requirement ปิดแล้ว

**ตอบได้ทั้งหมดหรือไม่:** OQ-1–8 และ DQ-09–14 มี **แนวทางสำหรับพัฒนา** ทุกข้อ แต่ยัง **ปิดรับรองไม่ได้ทั้งหมด**: OQ-6 ต้องให้ผู้ดูแลข้อมูลส่วนบุคคลวินิจฉัยการเก็บเวลาของคนจริง, DQ-11 มีร่าง field contract ราย endpoint แล้วแต่ยังต้อง review/ทำ contract tests และเพิ่ม route ที่ขาด, DQ-14 ยังต้องยืนยันผู้ให้บริการ/สิทธิ์เปิดผลงานจริง. OQ-1/2/4 ยังต้องให้เจ้าของนโยบายคะแนน/ทะเบียนรับรองก่อนใช้ข้อมูลจริง. ข้อขัดกับ PRD อยู่ใน [Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md)

## A. Open Questions ใน PRD หัวข้อ 17

| ID | ข้อสรุปเพื่อพัฒนา | เหตุผลหลัก / เงื่อนไข | สถานะ |
|---|---|---|---|
| **OQ-1** | ใช้ `score_floor=0.60`, `ceiling=1.00` เป็นค่าเริ่มต้นและปรับได้ต่อ Assignment เฉพาะ DRAFT | ตรงสูตรหัวข้อ 9.3; ค่านี้เป็นนโยบายคะแนนที่ผู้สอนต้องรับรองก่อนใช้จริง | เลือกใช้พัฒนา; รอ Instructor รับรอง |
| **OQ-2** | ใช้ `M × (group_component + individual_component)` กับ **คะแนนส่วนตัว** ของผู้ประเมินเท่านั้น | ตรงสูตรหัวข้อ 9.4; ไม่เปลี่ยนคะแนนกลุ่มต้นทางหรือคะแนนเพื่อน; ต้องแจ้งนักศึกษาก่อนเริ่มงาน | เลือกใช้พัฒนา; รอ Instructor/Academic affairs รับรอง |
| **OQ-3** | หลัง deadline สุดท้าย 14 วัน ให้ auto-finalize **ทั้ง Assignment** เฉพาะเมื่อไม่มี `LOW_CONFIDENCE`, appeal ค้าง หรือ validation error | ไม่มีการ finalize บาง item; ถ้าไม่ผ่านเงื่อนไขคง `CLOSED` และแจ้ง Owner; audit ระบุ actor เป็นระบบ | เลือกใช้พัฒนา |
| **OQ-4** | กำหนดสมาชิกเป็น `WITHDRAWN` พร้อมเวลา; หยุดมอบหมายคู่ใหม่, ยกเลิก/จัดสรรคู่ค้างใหม่, ตัด item และคำตอบของผู้ถอนจาก **การคำนวณปัจจุบัน** แต่เก็บประวัติ | ตรง default “ตัดออกจากการคำนวณ”; recompute โดยไม่แก้ Final snapshot เดิม เว้นแต่ Owner Reopen ตาม audit | เลือกใช้พัฒนา; รอ Registrar รับรองวิธีรับสถานะถอน |
| **OQ-5** | v1.0 ใช้ CSV/XLSX Export; ไม่มีปุ่มหรือการเชื่อม LMS/LTI 1.3 | LMS อยู่นอก scope หัวข้อ 2.2; ไม่สมมติว่าระบบปลายทางรองรับรูปแบบใด | เลือกใช้พัฒนา |
| **OQ-6** | Staging ใช้เวลาสังเคราะห์เพื่อทดสอบ QS-05; **ไม่เก็บ time-on-task ของคนจริง** จนกว่า Privacy Officer กำหนดฐาน/notice/consent และระยะเก็บ | AI ไม่อาจรับรองฐานทางกฎหมายแทนหน่วยงาน; หากไม่อนุมัติ ต้องปรับ QS-05 และ PRD ก่อน production | มีเงื่อนไข; production gate |
| **OQ-7** | Co-teacher เห็นเฉพาะ pseudonym ที่คงที่ใน Assignment; Owner ดูตัวตนจริงเมื่อจำเป็นและทุกครั้งต้อง audit | ใช้สิทธิ์เท่าที่จำเป็นตามหัวข้อ 14.2; ห้ามส่ง mapping/personal identifiers ผ่าน API/export ของ Co-teacher | เลือกใช้พัฒนา; รอ Instructor รับรอง |
| **OQ-8** | ห้องที่มี 2 กลุ่ม **ไม่เปิด Group Evaluation ที่ใช้นักศึกษาเป็นผู้ประเมิน** และบล็อก Publish เมื่อ Group side ยังต้องได้คะแนน | ผู้ประเมินนักศึกษาทุกคนอยู่ในหนึ่งในสองกลุ่ม จึงไม่มีใครผ่าน `INV-G1`; warning อย่างเดียวตาม default ไม่ทำให้มีผู้มีสิทธิ์ | เลือกใช้พัฒนา; **ต้องแก้ PRD** ร่วม DQ-10 |

### รายละเอียดที่มีผลต่อการทดสอบ OQ

- **OQ-1/2:** golden test จาก PRD หัวข้อ 9.5, floor/ceiling ขอบเขต และ `M` ของแต่ละคน; group component ของคนอื่นต้องไม่เปลี่ยน. UI ต้องแสดงนโยบายก่อนรับคำตอบ
- **OQ-3:** scheduler/job ต้อง idempotent; ทดสอบวัน 13/14, flag แต่ละชนิด, appeal เปิด, validation error, audit และ notification. `LOW_CONFIDENCE` เพียง item เดียวต้องขวางการ finalize **ทั้งงาน**
- **OQ-4:** เก็บ submitted revisions/generation เดิมเพื่อ audit แต่ไม่นับใน recompute ใหม่; pair ที่ได้รับมอบหมายแต่ยังไม่ส่งต้องจัดสรรใหม่ภายใต้กฎ eligibility/coverage; Final snapshot เดิม immutable. การถอนไม่ใช่การลบข้อมูลทันที
- **OQ-6:** การจับเวลาต้องไม่เก็บข้อมูลจริงใน production จนกว่าจะมีคำตอบ; “แจ้งใน privacy notice” อย่างเดียว **ไม่ใช่คำตัดสินทางกฎหมาย**
- **OQ-7:** pseudonym ต้องเป็นค่า opaque ที่เดาย้อนเป็น user ID/email ไม่ได้และคงเดิมเฉพาะขอบเขตที่กำหนด; ตรวจ response/export/log ทุกบทบาท
- **OQ-8:** ถ้ามีเพียงสองกลุ่มและ Group side ยังเปิดอยู่ ผล feasibility ต้องบอกว่า eligible student evaluator = 0 และไม่สร้างคู่/คะแนน Group. อย่าผ่อน `INV-G1` หรือเพิ่มคะแนนผู้สอนอัตโนมัติ. ทางเลือก instructor-only ต้องออกแบบ coverage/คะแนนและรับรองเป็นกรณีใหม่ก่อนใช้

## B. Design Questions ที่ค้นพบจาก PRD v2.1

**สำคัญ:** รหัส DQ-09–14 ด้านล่างคงความหมายเดิมของชุดเอกสารออกแบบ. เนื้อหาที่เคยต่อท้ายไฟล์นี้และนำรหัสเหล่านี้ไปแทน “เลือก SQLite/Jinja2/mock auth/notification/scheduler/seed” รวมทั้งอ้าง PRD v2.0 **ถูกยกเลิก**; โค้ดปัจจุบันเป็น Next.js + SQLite Demo และไม่มีเหตุให้เปลี่ยน stack จากการตัดสินประเด็นเหล่านี้

| ID | ข้อสรุปเพื่อพัฒนา | เหตุผลหลัก / เงื่อนไข | สถานะ |
|---|---|---|---|
| **DQ-09** | Unpublish ปิด `generation` ปัจจุบันแบบ soft-invalidate; ไม่ลบ pair, submitted revisions หรือ snapshot. แก้ DRAFT แล้ว Publish สร้าง generation ใหม่แบบ transaction พร้อม audit/แจ้งผู้ได้รับผลกระทบ | สอดคล้อง DR-02/03 และป้องกันคะแนนปนรุ่น; ข้อความ “ลบ pairs ทั้งหมด” ใน FR-ASSIGN-03/State Diagram ต้องแก้ให้หมายถึง “ถอดจากชุดที่มีผลปัจจุบัน” | เลือกใช้พัฒนา; **ต้องแก้ PRD** |
| **DQ-10** | กรณี 2 กลุ่มไม่มี student evaluator ที่ผ่าน `INV-G1`; feasibility คืน `eligible=0`, `R_actual=0` และไม่ Publish Group side ที่ต้องคิดคะแนน | ไม่ใช้ผลลัพธ์ binary ที่ไม่มีคำตอบจริง; ไม่ผ่อน self-group rule. หากต้องการ instructor-only ให้เสนอ policy ใหม่ | เลือกใช้พัฒนา; **ต้องแก้ PRD** ร่วม OQ-8 |
| **DQ-11** | ใช้ error shape ตาม PRD หัวข้อ 12; ร่าง [API Contract](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) ระบุ `data`/`meta`, cursor, field allowlist, request/response ราย route และ export schema ขั้นต้น | PRD มีเพียงรายชื่อ route; contract นี้ยังต้อง review สิทธิ์/field, เพิ่ม route ที่ขาด และทดสอบ 200/4xx/ไฟล์จริงก่อนให้ client/server ทำคู่ขนานอย่างมั่นใจ | มีเงื่อนไข; ร่าง contract แล้ว แต่ยังไม่ผ่าน review/tests |
| **DQ-12** | เมื่อ `assigned_group + assigned_individual = 0` ให้ `p = N/A`, `M = 1` แบบ neutral และ **ไม่สร้างคะแนนจากข้อมูลว่าง**; ถ้ามีงานเพียง side เดียวให้หารเฉพาะจำนวนคู่ที่มอบหมายจริง | ไม่หารศูนย์และไม่ลงโทษคนที่ไม่มีงาน; ถ้า side ที่ต้องมีคะแนนกลับไม่มีคู่เพราะ infeasible ให้ flag `NO_DATA` และห้าม Finalize โดยอัตโนมัติ | เลือกใช้พัฒนา |
| **DQ-13** | Publish เปิดรับประเมินทันทีเมื่อ transaction สร้างคู่สำเร็จ; `PUBLISHED` เป็นสถานะช่วงเปลี่ยนผ่าน, `OPEN` เป็นสถานะหลัง commit. แต่ละ side ปิดตาม deadline ของตน; Assignment `CLOSED` เมื่อทั้งสอง side ที่เปิดใช้อยู่ปิดแล้ว | PRD ไม่มี `opens_at`; ไม่สร้าง field/เวลารอที่ไม่มีข้อกำหนด. งาน scheduled transition ต้อง idempotent และเก็บ UTC | เลือกใช้พัฒนา; State/API ต้องระบุให้ตรงกัน |
| **DQ-14** | เก็บ URL HTTPS ของผลงาน **ราย item/side** และตรวจ classroom/assignment scope; ผู้ใช้เปิดผ่านปุ่มหลังตรวจสิทธิ์ใน PairEval. Staging ใช้ผลงานสังเคราะห์; ถ้าลิงก์ขาด/เปิดไม่ได้ต้องแจ้งและไม่แสร้งว่าได้ประเมินผลงาน | แก้ A5 และ FR-ASSIGN-08 ในระดับข้อมูล/หน้าได้ แต่สิทธิ์ในระบบเก็บไฟล์ภายนอกต้องยืนยันกับ IT/Privacy. ห้ามใส่ token หรือข้อมูลส่วนตัวใน URL/log | มีเงื่อนไข; รอ approved storage/access policy |

### เกณฑ์ตรวจ DQ ที่ต้องไม่ตกหล่น

| ID | การตรวจขั้นต่ำ |
|---|---|
| DQ-09 | Unpublish หลังมี submission ไม่ลบข้อมูล; current score ใช้ generation ใหม่เท่านั้น; rollback แล้วไม่เหลือคู่ครึ่งชุด; audit/notification ถูกคน |
| DQ-10 | ห้อง 2 กลุ่มคืน eligible 0; ไม่มี self-group evaluation แม้ลด coverage; API ไม่รับ Publish ผิดเงื่อนไข |
| DQ-11 | ตรวจร่าง field contract และเพิ่มตัวอย่าง 400/401/403/404/409/422/429, pagination, identity allowlist, CSV/XLSX จริง และ contract tests ต่อ endpoint |
| DQ-12 | `assigned=0` ไม่หารศูนย์; side ปิดตาม FR-ASSIGN-07 ไม่ลด M; side ที่ควรมีคู่แต่จัดไม่ได้ได้ `NO_DATA` |
| DQ-13 | Publish→OPEN ทันที, deadline Group/Individual แยก, ปิดงานหลัง side สุดท้าย, extend deadline และ job รันซ้ำไม่เปลี่ยนผล |
| DQ-14 | ลิงก์ซ้าย/ขวาตรง item, ผู้ไม่มีสิทธิ์เปิดผ่านแอปไม่ได้, URL ผิด/ขาดแสดงสถานะ, ไม่รั่ว token/PII |

## C. ไฟล์ที่ต้องปรับตามคำตอบ

| ไฟล์ | ต้องปรับอะไร | ID |
|---|---|---|
| [PRD v2.1](pairwise_evaluation_prd%201.md), [Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md) | นำ E-01–E-07 ไปตรวจและออก PRD version ถัดไป: Unpublish ไม่ลบประวัติ, ห้อง 2 กลุ่ม, `assigned=0`, เวลาเปิดงาน, auto-finalize, WITHDRAWN และตาราง Markdown | OQ-3/4/8, DQ-09/10/12/13 |
| [09 Pairing](09_Pairing%20Algorithm%20Example.md), [11 State](11_State%20Diagram%20สถานะ.md) | eligibility 2 กลุ่ม, generation, Publish→OPEN, Finalize ทั้งงาน | OQ-3/8, DQ-09/10/13 |
| [10 Scoring](10_Scoring%20Specification.md), [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | floor/M, withdrawal, `assigned=0`, time-on-task gate และ quality | OQ-1/2/4/6, DQ-12 |
| [04 ER](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md), [05 Sequence](05_Sequence%20Diagram_ระบบคุยกัน.md) | `WITHDRAWN`, generation ที่ไม่ลบประวัติ, timestamp/transition และ notification | OQ-3/4, DQ-09/13 |
| [07 API](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md), [06 UI](06_Wireframe%20UI_หน้าตาใช้งาน.md) | schema/pagination/error/export, pseudonym/identity, artifact access และข้อความเมื่อไม่มีผลงาน | OQ-7, DQ-11/14 |
| [03 Architecture](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md), [02 Use Case](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | Export แทน LMS, ขอบเขต Co-teacher/Owner, approved artifact provider | OQ-5/7, DQ-14 |
| [01 User Flow](01_User%20Flow_ผู้ใช้กดอะไร.md), [00 Overview](00_Overview_ภาพรวมระบบ.md) | ปรับคำอธิบายว่ามีข้อสรุปสำหรับพัฒนา แต่ยังไม่ผ่านการรับรองจริง | OQ/DQ ทั้งชุด |
| [Document Readme](Document%20Readme.md), [14 Coverage](14_PRD%20Section%20Coverage.md), [12 Matrix](12_Traceability%20Matrix.md), [Work Plan](Work%20Plan%20_%20Full%20System.md) | สถานะและลำดับงานให้ตรง ไม่เรียกทุกข้อว่า “รอตัดสินใจ” หรือ “ทดสอบแล้ว” | OQ/DQ ทั้งชุด |

## D. การใช้ข้อสรุปนี้ทำงานต่อ

1. ใช้กติกา **เลือกใช้พัฒนา** เพื่อทำ design/API/schema/tests ด้วยข้อมูลสังเคราะห์ต่อได้ทันที โดยต้องอ้าง ID ของข้อตัดสินใจใน commit/งานที่เกี่ยว
2. เรื่อง **มีเงื่อนไข** ให้ทำเฉพาะส่วน staging ที่ไม่แตะข้อมูลจริง; DQ-11 มีร่าง contract แล้วแต่ต้อง review/ทดสอบก่อนแยกพัฒนา UI/API; DQ-14 ต้องมีผู้ให้บริการและสิทธิ์ไฟล์จริงก่อนทดสอบกับผู้ใช้จริง
3. บันทึกผู้รับรองจริง วันที่ เหตุผลและหลักฐานในตารางด้านล่างเมื่อมีคำตอบ; อย่าเปลี่ยนสถานะจาก “ข้อสรุปเพื่อพัฒนา” เป็น “อนุมัติ” โดยไม่มีหลักฐาน. หากเปลี่ยน policy ให้แก้ PRD เวอร์ชันใหม่และ acceptance tests ก่อน

| ID | ผู้รับรอง / หน่วยงาน | วันที่ | หลักฐาน | ผลต่อข้อสรุป |
|---|---|---|---|---|
| — | ยังไม่มีการรับรองภายนอก | — | — | ใช้พัฒนา/ทดสอบด้วยข้อมูลสังเคราะห์เท่านั้น |

**ข้อควรระวัง:** ตารางนี้เป็นเอกสารตัดสินใจ ไม่ใช่หลักฐานว่า PairEval Full System ทำงานแล้ว. ห้ามใช้ข้อมูลจริงหรือประกาศ production ready จนกว่า gates ใน [แผน 7 วัน](Work%20Plan%20_%20Full%20System.md) และ PRD หัวข้อ 19 จะผ่านจริง
