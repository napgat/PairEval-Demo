# 12 — Traceability Matrix: PRD v2.1 → Design → Verification

**Source of truth:** [pairwise_evaluation_prd 1.md](pairwise_evaluation_prd%201.md), version 2.1. ตารางนี้ครอบคลุมรหัสที่นิยามในเนื้อหาหลัก หัวข้อ 1–19 ของ PRD ได้แก่ requirements, invariants, data/architecture rules, quality signals, assumptions, constraints, design decisions และ open questions; ไม่ดึงรหัสเก่าที่กล่าวในภาคประวัติท้ายไฟล์

**วิธีอ่าน:** รหัสแต่ละแถวชี้ไฟล์ออกแบบหลักหนึ่งไฟล์; หัวข้อหนึ่งอาจมีไฟล์รองเชื่อมต่อกันด้วยลิงก์ภายในไฟล์หลัก บรรทัด PRD ใช้ค้นข้อความต้นทาง สถานะ “ร่าง” หมายถึงมีคำอธิบายออกแบบ แต่ **ยังไม่มีหลักฐานว่าระบบเต็มพัฒนา/ทดสอบผ่าน**. OQ/DQ มีข้อสรุปเพื่อพัฒนาใน [Decisions Needed](13_Decisions%20Needed.md); เรื่องที่ขัดกับ PRD v2.1 อยู่ใน [Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md) และยังต้องออก PRD เวอร์ชันใหม่ก่อนเปลี่ยนฐานการอ้างอิง

| PRD ID | บรรทัดใน PRD | ไฟล์ออกแบบหลัก | สถานะ | ประเด็นค้าง |
|---|---:|---|---|---|
| `A1` | 123 | [03](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `A2` | 124 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `A3` | 125 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `A4` | 126 | [11](11_State%20Diagram%20สถานะ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `A5` | 127 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-14 |
| `C1` | 134 | [03](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `C2` | 135 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `C3` | 136 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D1` | 195 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D2` | 196 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D3` | 197 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D4` | 198 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D5` | 199 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D6` | 200 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D7` | 201 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D8` | 202 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D9` | 203 | [03](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `D10` | 204 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `AR-01` | 232 | [03](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `AR-02` | 234 | [03](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `AR-03` | 235 | [03](03_System%20Architecture%20Diagram_Application%20เชื่อมต่อกับอะไรบ้าง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTH-01` | 247 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTH-02` | 248 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTH-03` | 249 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTH-04` | 250 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTHZ-01` | 251 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTHZ-02` | 252 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTHZ-03` | 253 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUTHZ-04` | 254 | [02](02_Use%20Case%20Diagram_ผู้ใช้ทำอะไรได้บาง.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-01` | 260 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-02` | 261 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-03` | 262 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-04` | 263 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-05` | 264 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-06` | 265 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-CLASS-07` | 266 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ASSIGN-01` | 285 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-13 |
| `FR-ASSIGN-02` | 286 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ASSIGN-03` | 287 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-09, DQ-13 |
| `FR-ASSIGN-04` | 288 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-13 |
| `FR-ASSIGN-05` | 289 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-13 |
| `FR-ASSIGN-06` | 290 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ASSIGN-07` | 291 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-12 |
| `FR-ASSIGN-08` | 292 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-14 |
| `FR-PAIR-01` | 300 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-02` | 301 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-8, DQ-10 |
| `FR-PAIR-03` | 302 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-04` | 303 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-05` | 304 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-8, DQ-10 |
| `FR-PAIR-06` | 305 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-07` | 306 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-08` | 307 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-09` | 308 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-10` | 309 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-11` | 310 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-4, DQ-09 |
| `FR-EVAL-01` | 316 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-02` | 317 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-14 |
| `FR-EVAL-03` | 318 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-04` | 319 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-05` | 320 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-06` | 321 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-07` | 322 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-08` | 323 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-09` | 324 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-10` | 325 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-11` | 326 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-12` | 327 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EVAL-13` | 328 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-01` | 355 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-02` | 356 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-1 |
| `FR-SCORE-03` | 357 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-04` | 358 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-2, DQ-12 |
| `FR-SCORE-05` | 359 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-06` | 360 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-07` | 361 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-08` | 362 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-09` | 363 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-3 |
| `FR-SCORE-10` | 364 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-REPORT-01` | 370 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-REPORT-02` | 371 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-REPORT-03` | 372 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-REPORT-04` | 373 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-REPORT-05` | 374 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-REPORT-06` | 375 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-EXPORT-01` | 381 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-EXPORT-02` | 382 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-EXPORT-03` | 383 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-EXPORT-04` | 384 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-7 |
| `FR-EXPORT-05` | 385 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-EXPORT-06` | 386 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-NOTIF-01` | 392 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-NOTIF-02` | 393 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-NOTIF-03` | 394 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-NOTIF-04` | 395 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-NOTIF-05` | 396 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-NOTIF-06` | 397 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-APPEAL-01` | 403 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-APPEAL-02` | 404 | [01](01_User%20Flow_ผู้ใช้กดอะไร.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUDIT-01` | 405 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUDIT-02` | 406 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-AUDIT-03` | 407 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-12` | 505 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-12 |
| `FR-PAIR-13` | 506 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-14` | 507 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PAIR-15` | 509 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `INV-G1` | 553 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-8, DQ-10 |
| `INV-I1` | 554 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `INV-2` | 555 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `INV-3` | 556 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `INV-4` | 557 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `INV-5` | 558 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `INV-6` | 559 | [09](09_Pairing%20Algorithm%20Example.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SCORE-11` | 652 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-2, DQ-12 |
| `FR-SCORE-12` | 654 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-2 |
| `FR-SCORE-13` | 655 | [10](10_Scoring%20Specification.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-2, DQ-12 |
| `QS-01` | 726 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `QS-02` | 727 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `QS-03` | 728 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `QS-04` | 729 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `QS-05` | 730 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-6 |
| `QS-06` | 731 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `QS-07` | 732 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-QS-01` | 734 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-QS-02` | 735 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-QS-03` | 736 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `DR-01` | 906 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `DR-02` | 907 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-09 |
| `DR-03` | 908 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-09 |
| `DR-04` | 909 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `DR-05` | 910 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `DR-06` | 911 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `DR-07` | 912 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `DR-08` | 913 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-14 |
| `DR-09` | 914 | [04](04_ER%20Diagram_ฐานข้อมูลสัมพันธ์.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-API-01` | 977 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-API-02` | 978 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-API-03` | 979 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-API-04` | 980 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-API-05` | 981 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-API-06` | 982 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `FR-API-07` | 983 | [07](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md) | ร่าง; ยังไม่ยืนยัน implementation | DQ-11 |
| `NFR-PERF-01` | 991 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-PERF-02` | 992 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-PERF-03` | 993 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-PERF-04` | 994 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-PERF-05` | 995 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-AVAIL-01` | 996 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-AVAIL-02` | 997 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-SCALE-01` | 998 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-SCALE-02` | 999 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-COMPAT-01` | 1000 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-COMPAT-02` | 1001 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-OBS-01` | 1002 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-OBS-02` | 1003 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-MAINT-01` | 1004 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-MAINT-02` | 1005 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `NFR-I18N-01` | 1006 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PRIV-01` | 1026 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-6 |
| `FR-PRIV-02` | 1027 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-6 |
| `FR-PRIV-03` | 1028 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-PRIV-04` | 1029 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ANON-01` | 1044 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ANON-02` | 1045 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ANON-03` | 1046 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ANON-04` | 1047 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-ANON-05` | 1048 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | OQ-7 |
| `FR-SEC-01` | 1061 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SEC-02` | 1062 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SEC-03` | 1063 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SEC-04` | 1064 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SEC-05` | 1065 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SEC-06` | 1066 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-SEC-07` | 1067 | [08](08_Rules%20เงื่อนไขสำคัญ.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-01` | 1077 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-02` | 1078 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-03` | 1079 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-04` | 1080 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-05` | 1081 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-06` | 1082 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `FR-A11Y-07` | 1083 | [06](06_Wireframe%20UI_หน้าตาใช้งาน.md) | ร่าง; ยังไม่ยืนยัน implementation | — |
| `OQ-1` | 1110 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | รอ Instructor รับรองคะแนนจริง |
| `OQ-2` | 1111 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | รอ Instructor/Academic affairs รับรอง |
| `OQ-3` | 1112 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | ยังไม่ใช่ผลทดสอบ |
| `OQ-4` | 1113 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | รอ Registrar รับรองกระบวนการถอน |
| `OQ-5` | 1114 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | v1.0 ใช้ Export |
| `OQ-6` | 1115 | [13](13_Decisions%20Needed.md) | มีเงื่อนไข | รอ Privacy Officer ก่อนเก็บข้อมูลจริง |
| `OQ-7` | 1116 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | รอ Instructor รับรอง |
| `OQ-8` | 1117 | [13](13_Decisions%20Needed.md) | ข้อสรุปเพื่อพัฒนา | ต้องแก้ PRD ร่วม DQ-10 |

## หลักฐานที่ต้องเพิ่มก่อนปิด requirement

| กลุ่ม | วิธีตรวจขั้นต่ำตาม PRD หัวข้อ 18 | หลักฐานระบบเต็ม ณ วันที่ทำตาราง |
|---|---|---|
| Auth/AuthZ/Anonymity | Integration และ security negative tests ที่เรียก API โดยตรง | ยังไม่มี |
| Classroom/Evaluation | Unit + integration + E2E autosave/re-submit/deadline | ยังไม่มี |
| Pairing/INV | Property-based tests สำหรับ eligibility, balance, determinism และจำนวนที่สร้าง | ยังไม่มี |
| Scoring/DR | Unit + golden test จาก หัวข้อ 9.5 และ snapshot/reproducibility tests | ยังไม่มี |
| A11Y/Performance | Automated + manual accessibility, load test ตาม NFR | ยังไม่มี |

**หมายเหตุ:** การทดสอบ PairEval-Demo ที่มีอยู่ยืนยันพฤติกรรม **เดโม** เท่านั้น สูตร/สถาปัตยกรรม v2.1 ต่างจากเดโม จึงไม่ใช้เป็นหลักฐานผ่าน requirement v2.1 โดยอัตโนมัติ หลังพัฒนาระบบเต็มให้เพิ่ม test ID/URL ผล CI และสถานะผ่าน/ไม่ผ่านต่อ PRD ID ในตารางนี้
