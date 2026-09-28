# 15 — ข้อเสนอแก้ PRD v2.1 หลังตัดสินใจเชิงออกแบบ

**สถานะ:** ร่างข้อเสนอสำหรับ PRD เวอร์ชันถัดไป ยังไม่ได้รวมเข้า [PRD v2.1](pairwise_evaluation_prd%201.md) และยังไม่ใช่คำอนุมัติจากผู้สอน/หน่วยงาน  \
**เหตุผลที่แยกไฟล์:** PRD v2.1 เป็นฐานหมายเลขบรรทัดของ [Traceability Matrix](12_Traceability%20Matrix.md); การแก้ต้นฉบับทันทีจะทำให้ตำแหน่งอ้างอิงเปลี่ยนโดยไม่มีการควบคุมเวอร์ชัน

| ID | ตำแหน่งใน PRD v2.1 | ข้อความ/พฤติกรรมปัจจุบัน | ข้อเสนอสำหรับเวอร์ชันถัดไป | เหตุผลและการตรวจ |
|---|---|---|---|---|
| **E-01 / DQ-09** | หัวข้อ 7.3 State Diagram และ FR-ASSIGN-03; เทียบ DR-02/03 หัวข้อ 11.2 | Unpublish “ลบ pairs ทั้งหมด” แต่ห้ามลบ pair ที่มี submitted comparison และ final snapshot ต้อง immutable | เปลี่ยนเป็น “ปิด generation ปัจจุบันจากการใช้งาน/คะแนน แล้วกลับ DRAFT; เก็บ pair, submission และ snapshot รุ่นเก่าเพื่อ audit; Publish ใหม่สร้าง generation ใหม่แบบ transaction” | ไม่มีการลบหลักฐานและไม่ปนคะแนนระหว่างรุ่น; ทดสอบ Unpublish หลัง Submit, rollback และ re-publish |
| **E-02 / OQ-8 + DQ-10** | หัวข้อ 17 OQ-8 default และหัวข้อ 8.2; เทียบ FR-PAIR-02/INV-G1 | ห้องสองกลุ่มให้ “เตือนแต่ยังทำได้” ทั้งที่ student evaluator ทุกคนอยู่ในหนึ่งในสองกลุ่มของคู่ | ระบุว่าเมื่อ Group side ต้องได้คะแนนและมีเพียงสองกลุ่ม ให้ feasibility คืน eligible student evaluator = 0, R_actual = 0 และปฏิเสธ Publish ฝั่ง Group; อย่าผ่อนกฎห้ามประเมินกลุ่มตนเอง | พิสูจน์จากจำนวนกลุ่มและ eligibility graph; property test N=2 ทุกขนาดกลุ่ม |
| **E-03 / DQ-12** | หัวข้อ 9.4 Participation และ FR-ASSIGN-07 | สูตร p ไม่กำหนดกรณีไม่มี pair ที่ได้รับมอบหมาย | ถ้า assigned ทั้งสอง side = 0 ให้ p=N/A และ M=1 แบบ neutral โดยไม่สร้างคะแนนจากข้อมูลว่าง; ถ้ามีงานเพียง side เดียวให้หารจากงาน side นั้น; side ที่ควรมีคู่แต่ infeasible ต้องเป็น NO_DATA | กันหารศูนย์และไม่ลดคะแนนเพราะไม่ได้รับงาน; ทดสอบ no assignment/side disabled/infeasible |
| **E-04 / DQ-13** | หัวข้อ 7.3 State Diagram, assignment schema หัวข้อ 11.1 | PUBLISHED→OPEN “ถึงเวลาเปิด” แต่ไม่มี opens_at หรือเงื่อนไขเปิด | เมื่อ Publish transaction สำเร็จ ให้ OPEN ทันที; แต่ละ side ปิดตาม deadline ของตน; Assignment CLOSED หลัง side สุดท้ายปิด | ไม่สร้างเวลาเปิดที่ไม่มี schema; ทดสอบ clock boundary/extend deadline/job idempotency |
| **E-05 / OQ-3** | หัวข้อ 17 OQ-3 และหัวข้อ 7.3 | Default auto-finalize 14 วันยังไม่เชื่อมกับ State Diagram | เพิ่ม transition CLOSED→FINALIZED โดยระบบได้หลัง deadline สุดท้าย 14 วัน **เฉพาะทั้งงาน** ที่ไม่มี LOW_CONFIDENCE, appeal เปิด หรือ validation error; มิฉะนั้นคง CLOSED และแจ้ง Owner | ไม่เกิด final snapshot บางส่วน; ทดสอบ gate ทุกตัวและ audit actor ของระบบ |
| **E-06 / OQ-4** | หัวข้อ 17 OQ-4 และ classroom_member หัวข้อ 11.1 | ระบุ WITHDRAWN แต่ schema และผลต่อ revision/generation ยังไม่ครบ | เพิ่มสถานะ/เวลามีผลของ WITHDRAWN; หยุดมอบหมายใหม่, จัดสรรคู่ค้างใหม่, ตัดข้อมูลผู้ถอนจากการคำนวณปัจจุบัน แต่เก็บประวัติ immutable; Final snapshot เดิมเปลี่ยนได้เฉพาะกระบวนการ Reopen | ป้องกันคะแนนเปลี่ยนโดยไม่มีประวัติ; ทดสอบถอนก่อน/หลัง Submit และหลัง Finalize |
| **E-07 / Editorial** | หัวข้อ 7.3 FR-ASSIGN-08, หัวข้อ 7.5 FR-EVAL-07–13 และหัวข้อ 7.9 FR-NOTIF-06 | แถว Markdown มีจำนวนคอลัมน์ไม่ตรงหัวตาราง ทำให้ acceptance criterion หรือช่องว่างท้ายแถวแสดงผิด | จัด FR-ASSIGN-08 ให้ acceptance criterion อยู่ในคอลัมน์ที่มีหัวรองรับ; เติมช่อง `—` ที่ขาดใน FR-EVAL/FR-NOTIF โดยคงถ้อยคำ requirement; เมื่อแก้ต้นฉบับให้ปรับเลขบรรทัดใน Matrix ตามจริง | ตรวจ render Markdown และจำนวนคอลัมน์ทุกตารางของ PRD หลังออกเวอร์ชันใหม่ |

## วิธีนำเข้า PRD

1. ให้ผู้ดูแล PRD ตรวจ E-01–E-07 กับ [Decisions Needed](13_Decisions%20Needed.md), owner และ acceptance criteria ของแต่ละ FR/DR/INV
2. ออก PRD เวอร์ชันใหม่พร้อม Change Log ที่ระบุ ID เหล่านี้; คง PRD v2.1 เป็นหลักฐานอ้างอิงเดิม
3. อัปเดตเลขบรรทัดและสถานะใน [Traceability Matrix](12_Traceability%20Matrix.md), [PRD Section Coverage](14_PRD%20Section%20Coverage.md), API/schema, UI และ tests ให้ตรง PRD เวอร์ชันใหม่
4. จนกว่าจะเกิดขั้นตอน 1–3 ให้ใช้ข้อสรุปนี้เฉพาะพัฒนา/ทดสอบด้วยข้อมูลสังเคราะห์ และระบุความต่างจาก PRD v2.1 ในผลตรวจ

**API contract ราย endpoint** มีร่างใน [07 API Contract](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) แต่ยังต้อง review และทำ contract tests ตาม DQ-11; **สิทธิ์เข้าถึงผลงานภายนอก** เป็น gate ของ DQ-14 ใน [Decisions Needed](13_Decisions%20Needed.md)
