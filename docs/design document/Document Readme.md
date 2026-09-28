# คู่มือชุดเอกสารออกแบบ PairEval

**แหล่งข้อกำหนดระบบเต็ม:** [pairwise_evaluation_prd 1.md](pairwise_evaluation_prd%201.md) **v2.1**  
**ระบบที่มีอยู่จริง:** [PairEval-Demo](../../README.md) ใช้ข้อมูลสังเคราะห์และสูตร/ขอบเขตเฉพาะเดโม  
**ลำดับการอ้างอิง:** ใช้ PRD v2.1 สำหรับระบบเต็ม; ใช้ README และแผน Demo เฉพาะเมื่ออธิบายเดโม

## วิธี Traceability

เริ่มจากรหัส requirement หรือคำถามใน PRD → ค้นรหัสเดียวกันใน [Traceability Matrix](12_Traceability%20Matrix.md) → เปิดไฟล์ออกแบบหลัก → ตรวจ [Decisions](13_Decisions%20Needed.md) ว่ามีข้อสรุปเพื่อพัฒนาหรือยังรอรับรอง → เมื่อพัฒนาแล้วเพิ่ม test/CI evidence ให้รหัสนั้น **เอกสารออกแบบไม่ใช่หลักฐานว่าฟีเจอร์ทำงานแล้ว**

| ไฟล์ | ตอบคำถามหลัก | PRD v2.1 ที่รับผิดชอบ |
|---|---|---|
| [00 Overview](00_Overview_ภาพรวมระบบ.md) | ระบบทำอะไร เดโมต่างจากระบบเต็มอย่างไร | หัวข้อ 1–2, หัวข้อ 19 |
| [01 User Flow](01_User%20Flow_ผู้ใช้กดอะไร.md) | ผู้ใช้เดินงานตั้งแต่เข้าใช้ถึงคะแนนอย่างไร | หัวข้อ 3, FR-CLASS, FR-ASSIGN, FR-APPEAL |
| [02 Use Case](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ใครมีสิทธิ์ทำอะไร | หัวข้อ 3, FR-AUTH, FR-AUTHZ |
| [03 Architecture](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | บริการและขอบเขตความปลอดภัยเชื่อมกันอย่างไร | หัวข้อ 6, AR-01–03 |
| [04 ER Diagram](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ข้อมูลสัมพันธ์และรักษาความถูกต้องอย่างไร | หัวข้อ 11, DR-01–09 |
| [05 Sequence](05_Sequence%20Diagram_ระบบคุยกัน.md) | ลำดับ login, publish, submit, finalize | หัวข้อ 7–12 |
| [06 Wireframe](06_Wireframe%20UI_หน้าตาใช้งาน.md) | หน้าจอ/ข้อความ/การเข้าถึงเป็นอย่างไร | FR-EVAL, FR-REPORT, FR-A11Y |
| [07 API Contract](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ใครเรียก endpoint ใด, field ของ request/response และขอบเขตข้อมูล | หัวข้อ 12, FR-API, FR-EXPORT |
| [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | กติกา privacy, security, quality, NFR คืออะไร | หัวข้อ 10, หัวข้อ 13–15 |
| [09 Pairing](09_Pairing%20Algorithm%20Example.md) | คู่/coverage/workload คำนวณอย่างไร | หัวข้อ 8, FR-PAIR, INV-* |
| [10 Scoring](10_Scoring%20Specification.md) | สูตรคะแนน v2.1 คำนวณอย่างไร | หัวข้อ 9, FR-SCORE |
| [11 State](11_State%20Diagram%20สถานะ.md) | งาน/คำตอบ/คะแนนเปลี่ยนสถานะอย่างไร | หัวข้อ 7.3, หัวข้อ 7.5, หัวข้อ 9, หัวข้อ 11 |
| [12 Traceability Matrix](12_Traceability%20Matrix.md) | PRD ID ไปอยู่เอกสารใด และตรวจด้วยอะไร | หัวข้อ 18; ID ที่นิยามใน หัวข้อ 1–19 |
| [13 Decisions Needed](13_Decisions%20Needed.md) | เรื่องใดมีข้อสรุปเพื่อพัฒนา และเรื่องใดยังต้องรับรองหรือทำ contract ต่อ | หัวข้อ 17 และช่องว่างที่พบ |
| [14 PRD Section Coverage](14_PRD%20Section%20Coverage.md) | หัวข้อ หัวข้อ 1–21 ไปอยู่ไฟล์ใด และส่วนไหนยังสรุป/รอรายละเอียด | หัวข้อ 1–21 |
| [15 PRD v2.1 Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md) | ข้อใดใน PRD ต้องเสนอแก้หลังเลือกแนวทางพัฒนา และจะนำเข้าเวอร์ชันใหม่อย่างไร | OQ-3/4/8, DQ-09/10/12/13 และรูปแบบตาราง |
| [Glossary](Glossary%20in%20System.md) | ศัพท์ v2.1 กับศัพท์เดโมต่างกันอย่างไร | หัวข้อ 4 และศัพท์ในเอกสารชุดนี้ |

## ขอบเขตคำตอบ ณ วันที่ทำเอกสาร

ชุดนี้ระบุไฟล์เจ้าของครบทุกหัวข้อใน PRD หัวข้อ 1–21 และชี้ตำแหน่งครบทุก **188 รหัสที่นิยามใน หัวข้อ 1–19** แต่เป็น **เอกสารออกแบบที่สรุปและอ้างกลับ PRD ไม่ใช่สำเนาทุกบรรทัด**; ดู [ผลตรวจรายหัวข้อ](14_PRD%20Section%20Coverage.md). `OQ-1` ถึง `OQ-8` และ `DQ-09` ถึง `DQ-14` มีข้อสรุปสำหรับพัฒนาด้วยข้อมูลสังเคราะห์แล้ว แต่ OQ-6, DQ-11, DQ-14 ยังมี gate สำคัญ และนโยบายคะแนน/ทะเบียนบางข้อยังต้องผู้รับผิดชอบรับรอง. [Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md) แยกข้อความ PRD ที่ต้องเสนอแก้โดยคง PRD v2.1 และเลขบรรทัดใน Matrix ไว้; API มีร่าง field contract แต่ยังไม่ผ่าน review/contract tests สถานะจึงเป็น **design draft พร้อม traceability** ไม่ใช่ implementation ที่อนุมัติแล้ว
