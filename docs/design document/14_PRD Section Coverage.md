# 14 — PRD Section Coverage Audit

**ตรวจเทียบ:** [pairwise_evaluation_prd 1.md](pairwise_evaluation_prd%201.md) v2.1 กับเอกสารออกแบบในโฟลเดอร์นี้ ณ 29 กันยายน 2026  
**ความหมาย:** “ครอบคลุม” หมายถึงมีไฟล์เจ้าของหัวข้อและสรุปกติกาสำคัญพร้อมอ้าง PRD; **ไม่ได้หมายถึงคัดทุกบรรทัดหรือมี implementation/test ผ่าน** รายละเอียด exact field, acceptance criterion และค่าตัวเลขต้นฉบับให้ยึด PRD จนกว่า design review จะอนุมัติเอกสารแยก

| ส่วนใน PRD | ไฟล์ที่รับผิดชอบ | ผลตรวจเนื้อหา |
|---|---|---|
| หัวข้อ 1.1–1.2 ปัญหาและ Goals G1–G5 | [00 Overview](00_Overview_ภาพรวมระบบ.md) | สรุปปัญหา 3 ข้อและเป้าหมาย 5 ข้อ |
| หัวข้อ 1.3–1.4 Non-goals และ Success Metrics M1–M6 | [00 Overview](00_Overview_ภาพรวมระบบ.md) | ระบุขอบเขตที่ไม่ทำและเป้าตัวเลข; วิธีวัดละเอียดอยู่ใน PRD หัวข้อ 1.4 |
| หัวข้อ 2.1–2.4 Scope, A1–A5, C1–C3 | [00 Overview](00_Overview_ภาพรวมระบบ.md) | สรุปสมมติฐาน/ข้อจำกัด; DQ-14 มีแนวทาง staging แต่การเข้าถึงผลงานจริงยังรอ IT/Privacy |
| หัวข้อ 3 Users, Personas, Role matrix | [02 Use Case](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | บทบาท/สิทธิ์หลักครบ; OQ-7 เลือก pseudonym ให้ Co-teacher เพื่อพัฒนา |
| หัวข้อ 4 Glossary | [Glossary in System](Glossary%20in%20System.md) | แยกศัพท์ PRD v2.1 กับ Demo; ใช้ครอบคลุมศัพท์โดเมนในไฟล์ 00–15 |
| หัวข้อ 5 D1–D10 Key Design Decisions | [03 Architecture](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md), [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md), [09 Pairing](09_Pairing%20Algorithm%20Example.md), [10 Scoring](10_Scoring%20Specification.md) | มีเจ้าของทุก D ID ใน [Matrix](12_Traceability%20Matrix.md) |
| หัวข้อ 6 Architecture, AR-01–03 | [03 Architecture](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ระบุส่วนประกอบและ boundary; deployment topology/secrets เป็นงานออกแบบรายละเอียดต่อ |
| หัวข้อ 7.1 Auth/AuthZ | [02 Use Case](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md), [07 API](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | กติกาหลักครบ; API มีร่าง field contract แต่ OIDC callback/session และสิทธิ์ราย route ยังต้อง review/test |
| หัวข้อ 7.2 Classroom/Roster | [01 User Flow](01_User%20Flow_ผู้ใช้กดอะไร.md), [04 ER](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | กติกาหลักครบ; schema CSV รายละเอียดให้ยึด FR-CLASS-01 |
| หัวข้อ 7.3 Assignment Lifecycle | [11 State](11_State%20Diagram%20สถานะ.md), [01 User Flow](01_User%20Flow_ผู้ใช้กดอะไร.md) | DQ-09/13 มีข้อสรุปเพื่อพัฒนา; PRD ยังต้อง erratum เรื่องลบคู่เก่า |
| หัวข้อ 7.4 Pairing Engine | [09 Pairing](09_Pairing%20Algorithm%20Example.md) | สูตร/ตัวอย่าง/invariants สรุปครบ; OQ-8/DQ-10 เลือกปิด Group eval ของห้อง 2 กลุ่มเพื่อพัฒนา; PRD ต้องแก้ default |
| หัวข้อ 7.5 Evaluation UI | [06 Wireframe](06_Wireframe%20UI_หน้าตาใช้งาน.md), [11 State](11_State%20Diagram%20สถานะ.md) | มีบัญชีหน้าจอ Demo/ระบบเต็มและปลายทางปุ่ม; prototype และ a11y evidence ยังไม่มี |
| หัวข้อ 7.6 Scoring Engine | [10 Scoring](10_Scoring%20Specification.md) | สูตรและตัวอย่างหลักครบ; OQ-1/2, DQ-12 มีข้อสรุปเพื่อพัฒนา แต่นโยบายคะแนนจริงยังต้องรับรอง |
| หัวข้อ 7.7 Reports | [06 Wireframe](06_Wireframe%20UI_หน้าตาใช้งาน.md), [07 API](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | รายงาน 4 ประเภท/สิทธิ์นักศึกษาและปุ่มไปหน้าหรือ API มีที่อยู่; field contract ร่างแล้วแต่ต้อง review/test |
| หัวข้อ 7.8 Export | [07 API](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md), [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | รูปแบบ/สิทธิ์หลักครบ; มี schema คอลัมน์ขั้นต้น แต่ยังไม่มีไฟล์ตัวอย่างหรือ test CSV/XLSX 4 sheet |
| หัวข้อ 7.9 Notifications | [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md), [05 Sequence](05_Sequence%20Diagram_ระบบคุยกัน.md) | เหตุการณ์และข้อห้ามข้อมูลส่วนตัวอ้าง PRD; channel/retry/delivery contract ยังไม่ได้ออกแบบละเอียด |
| หัวข้อ 7.10 Appeals/Audit | [01 User Flow](01_User%20Flow_ผู้ใช้กดอะไร.md), [04 ER](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md), [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | ขอบเขตหลักครบ; หน้า/กระบวนการอนุมัติจริงยังไม่ได้ทดสอบ |
| หัวข้อ 8.1–8.4 Pairing specification | [09 Pairing](09_Pairing%20Algorithm%20Example.md) | ตัวแปร, feasibility, individual bound, ตัวอย่างและ INV-G1/INV-I1/INV-2–6 ครบในระดับแบบ |
| หัวข้อ 9.1–9.5 Scoring specification/worked example | [10 Scoring](10_Scoring%20Specification.md) | ตาราง 1–6, `q`, band mapping, `p/M`, worked example หลักครบ |
| หัวข้อ 9.6 วิธีที่ไม่เลือก | [10 Scoring](10_Scoring%20Specification.md) | สรุป Bradley–Terry, Elo/TrueSkill และ z-score/percentile พร้อมเหตุผลที่ยังไม่เลือก |
| หัวข้อ 10 QS-01–07 / FR-QS-01–03 | [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | เกณฑ์ตัวเลขและการกระทำครบ; ไม่มีการทดสอบ signal |
| หัวข้อ 11.1–11.2 Data model / DR-01–09 | [04 ER](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ความสัมพันธ์และกฎข้อมูลสำคัญครบ; **รายการ field ทั้งหมดไม่ได้คัดซ้ำ** ให้ใช้ PRD หัวข้อ 11.1 เป็น data dictionary |
| หัวข้อ 12 API Surface / FR-API | [07 API](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | Endpoint และ field contract ร่างครบตามรายการ PRD; route ที่ PRD ยังขาด, error catalog/ตัวอย่างครบทุกสถานะ และ contract tests ยังเปิดตาม DQ-11 |
| หัวข้อ 13 NFR ทั้งหมด | [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | เป้าตัวเลข/ID สรุปครบ; ยังไม่มีผล performance/availability จริง |
| หัวข้อ 14 Privacy/Security/Anonymity | [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md), [02 Use Case](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ระยะเก็บ สิทธิ์และมาตรการหลักครบ; OQ-7 มีข้อสรุปเพื่อพัฒนา, OQ-6 รอ Privacy Officer ก่อนข้อมูลจริง |
| หัวข้อ 15 Accessibility | [06 Wireframe](06_Wireframe%20UI_หน้าตาใช้งาน.md) | FR-A11Y-01–07 มีที่อยู่; ยังไม่มี mockup/a11y test evidence |
| หัวข้อ 16 Risks R1–R9 | [08 Rules](08_Rules%20เงื่อนไขสำคัญ.md) | สรุปทุกความเสี่ยงและแนวรับมือ |
| หัวข้อ 17 OQ-1–8 | [13 Decisions Needed](13_Decisions%20Needed.md) | ทุกข้อมีแนวทางพัฒนา; บางข้อยังรอการรับรองภายนอก, DQ-09–14 คงรหัสเดิมและระบุ gate |
| หัวข้อ 18 Traceability/testing | [12 Traceability Matrix](12_Traceability%20Matrix.md) | 188 รหัสนิยามใน หัวข้อ 1–19 มีเจ้าของไฟล์; test evidence ระบบเต็มยังไม่มี |
| หัวข้อ 19 Release Plan M1–M4 | [00 Overview](00_Overview_ภาพรวมระบบ.md) | สรุป scope/Definition of Done ระดับหลัก; ยังไม่ใช่สถานะ deploy จริง |
| หัวข้อ 20 References | [PRD ต้นฉบับ](pairwise_evaluation_prd%201.md) | คงลิงก์มาตรฐาน/กฎหมายที่ PRD ต้นฉบับเพื่อไม่ทำสำเนาที่อาจล้าสมัย |
| หัวข้อ 21 Change Log | [PRD ต้นฉบับ](pairwise_evaluation_prd%201.md) | คงประวัติเวอร์ชันที่ต้นฉบับ; v2.1 เป็นฐานของชุดเอกสารนี้ |

## ผลตรวจ

**ทุกหัวข้อมีปลายทางให้อ่านต่อ** แต่ **ยังไม่ใช่การแตกเนื้อหาทุกบรรทัดเป็นไฟล์ใหม่** โดยตั้งใจไม่คัดซ้ำ data dictionary, acceptance criteria รายข้อ, external references และ change log เพราะ PRD v2.1 เป็นแหล่งต้นฉบับที่ต้องควบคุมเวอร์ชันร่วมกับ Matrix ข้อสรุปที่ยังรอการรับรองอยู่ใน [Decisions Needed](13_Decisions%20Needed.md), ข้อเสนอแก้ข้อความต้นฉบับอยู่ใน [Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md), และข้อที่ยังออกแบบไม่ละเอียด/ไม่มีผลทดสอบถูกระบุไว้ในตารางนี้
