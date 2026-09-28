# 08 — Rules: กติกาและข้อจำกัดข้ามส่วน

**ฐานอ้างอิง:** [PRD v2.1](pairwise_evaluation_prd%201.md) หัวข้อ 2, หัวข้อ 7–15 · **สถานะ:** กติกาเป้าหมายของระบบเต็ม

| กลุ่มกติกา | สิ่งที่ต้องรักษา | Trace |
|---|---|---|
| ตัวตน/สิทธิ์ | OIDC verified email เชื่อม roster ครั้งแรก จากนั้นใช้ `sub`; API ตรวจ role, classroom และ owner ทุกครั้ง | FR-AUTH-01–04, FR-AUTHZ-01–04, D9 |
| Roster/งาน | CSV atomic, อีเมลซ้ำ/ผิดและกลุ่มเล็กมีผลตรวจ; น้ำหนักเกณฑ์รวม 100% ต่อ side; แก้ roster/criteria เฉพาะ DRAFT | FR-CLASS-01–07, FR-ASSIGN-01–08 |
| Pairing | ไม่ประเมินคู่ที่เกี่ยวกับตน, ไม่ซ้ำคู่เดิม, coverage/workload สมดุล, seed เดิมให้ผลเดิม; ลด target พร้อมตัวเลขเมื่อจำเป็น | FR-PAIR-01–15, INV-G1/INV-I1/INV-2–6 |
| Submission | Draft ไม่นับคะแนน; ส่งไม่ครบและส่งใหม่ก่อน deadline ได้; revision ที่ส่งแล้วคงเดิม | FR-EVAL-04–09, DR-01/06 |
| คะแนน | 6 choices → weighted quality index → band mapping; participation multiplier แยกจากคุณภาพ; low confidence ไม่ finalize อัตโนมัติ | FR-SCORE-01–13, D1/2/5/6 |
| การเปิดเผย | นักศึกษาไม่เห็น evaluator identity; คะแนน individual ต้องถึง `k_min` ก่อนแสดง; ไม่แสดง delta รายวัน | FR-ANON-01–05, D7 |
| Audit/Privacy | บันทึกเหตุการณ์สำคัญแบบ append-only, ระยะเก็บตามชนิดข้อมูล, แจ้ง privacy notice และไม่ใส่คะแนนใน notification | FR-AUDIT-01–03, FR-PRIV-01–04, DR-09 |
| คุณภาพ | QS-01–07 เป็นสัญญาณให้ผู้สอนพิจารณา ไม่ลงโทษอัตโนมัติ; การ exclude ต้องมีเหตุผล | FR-QS-01–03, QS-01–07 |

## เงื่อนไขที่วัดได้

| หมวด | เป้าตาม PRD | ID |
|---|---|---|
| ความเร็ว | Evaluation p95 ≤ 2s ที่ 200 concurrent; autosave p95 ≤ 300ms; Submit p95 ≤ 800ms; pairing ≤ 10s; recompute ≤ 30s | NFR-PERF-01–05 |
| ความพร้อมใช้/กู้คืน | 99.5% ต่อเดือน, 99.9% ช่วง 48 ชม. ก่อน deadline; RPO ≤ 15 นาที, RTO ≤ 4 ชม. | NFR-AVAIL-01–02 |
| ขนาด | 50 classrooms, 200 นักศึกษา/ห้อง, 40 กลุ่ม/ห้อง, spike 10× | NFR-SCALE-01–02 |
| อุปกรณ์/ภาษา | Browser 2 รุ่นล่าสุด, จอ ≥ 320px, UI ภาษาไทย, timezone ห้องเรียน, export ไทยอ่านใน Excel | NFR-COMPAT-01–02, NFR-I18N-01 |
| เฝ้าระวัง/ทดสอบ | requestId/structured log/alert; unit และ property-based tests สำหรับ scoring/pairing | NFR-OBS-01–02, NFR-MAINT-01–02 |
| การเข้าถึง | WCAG 2.2 AA, radio ใช้ keyboard ได้, label/contrast/target/focus/aria-live | FR-A11Y-01–07 |

**ข้อสรุปเพื่อพัฒนา:** [OQ-1/2/4/6/7 และ DQ-12](13_Decisions%20Needed.md) กำหนด floor เริ่มต้น 0.60, `M` คูณคะแนนส่วนตัวทั้งก้อน, `WITHDRAWN` ไม่เข้าการคำนวณปัจจุบัน, Co-teacher เห็น pseudonym และกรณีไม่มีคู่ที่ได้รับให้ `p=N/A`, `M=1` โดยไม่สร้างคะแนนจากข้อมูลว่าง. Time-on-task ทดสอบได้ด้วยข้อมูลสังเคราะห์ แต่ข้อมูลคนจริงต้องรอ Privacy Officer; นโยบายคะแนน/ทะเบียนก็ยังต้องผู้รับผิดชอบรับรอง. ตารางนี้ไม่ใช่ผลทดสอบหรือคำวินิจฉัยทางกฎหมาย

## Quality Signals (หัวข้อ 10)

| ID | สัญญาณและเกณฑ์เริ่มต้น | ผู้สอนควรทำ |
|---|---|---|
| QS-01 | Item มี comparison < 3 | ส่งประเมินเพิ่ม |
| QS-02 | ผู้ประเมินเลือกค่าเดิม > 80% | ตรวจคำตอบด้วยตา |
| QS-03 | เลือกฝั่งเดียว > 80% | ตรวจ position bias |
| QS-04 | วง A>B, B>C, C>A > 20% ของ triple ที่ตรวจได้ | ตรวจความสมเหตุสมผล |
| QS-05 | เวลาเฉลี่ยต่อ comparison < 3 วินาที | ตรวจ time-on-task |
| QS-06 | Self-group favoritism `z > 2` | ตรวจความเอนเอียง |
| QS-07 | Agreement `Kendall's W < 0.2` | ทบทวนความชัดของ criterion |

FR-QS-01 ห้ามตัดหรือลดน้ำหนักคำตอบอัตโนมัติเพียงเพราะมีสัญญาณ; FR-QS-02 ให้ผู้สอนทำเครื่องหมาย `EXCLUDED` พร้อมเหตุผล; FR-QS-03 ให้ใช้ QS-07 ที่เกิดซ้ำเป็น feedback ต่อคุณภาพเกณฑ์

## เหตุการณ์แจ้งเตือน (หัวข้อ 7.9)

| ID | เหตุการณ์ | ผู้รับ |
|---|---|---|
| FR-NOTIF-01 | เปิด Assignment ให้ประเมิน | นักศึกษาทุกคนที่เกี่ยวข้อง |
| FR-NOTIF-02 | เหลือ 48 ชั่วโมงและยังส่งไม่ครบ | นักศึกษาที่เกี่ยวข้อง |
| FR-NOTIF-03 | สร้างคู่ใหม่หลังเปลี่ยนข้อมูล | นักศึกษาที่ได้รับผลกระทบ |
| FR-NOTIF-04 | Finalize คะแนนแล้ว | นักศึกษาทุกคนที่เกี่ยวข้อง |
| FR-NOTIF-05 | ได้รับคู่เพิ่มเติม | นักศึกษาที่ถูกเลือก |
| FR-NOTIF-06 | ทุกข้อความมีลิงก์ตรงไปหน้าที่ต้องทำ | ห้ามมีคะแนนหรือข้อมูลระบุตัวตนผู้อื่นในเนื้อความ |

ช่องทางส่ง, นโยบายส่งซ้ำ และการจัดการส่งไม่สำเร็จยังไม่ระบุใน PRD ให้กำหนดเป็น technical contract แยกก่อนลงมือทำบริการแจ้งเตือน; **ห้ามนำ DQ-12 ไปใช้เป็นรหัสเรื่อง notification** เพราะ DQ-12 หมายถึงกรณี `assigned=0`

## Privacy, Security และระยะเก็บ (หัวข้อ 14)

| ข้อมูลตาม PRD | ระยะเก็บเป้าหมาย |
|---|---|
| อีเมลมหาวิทยาลัย, ชื่อ, รหัสนักศึกษา (ถ้ามี), ผลประเมินและตัวตนผู้ประเมิน | 2 ปีการศึกษา |
| Time-on-task | 1 ปีการศึกษา |

ต้องมี privacy notice ก่อนใช้งาน, กระบวนการขอสำเนาข้อมูลภายใน 30 วัน, การแทนที่ตัวตนด้วย pseudonym เมื่อพ้นระยะเก็บ, และ notification ที่ไม่บรรจุคะแนน/ตัวตน (FR-PRIV-01–04) [OQ-6](13_Decisions%20Needed.md) อนุญาตเฉพาะการทดสอบ time-on-task ด้วยข้อมูลสังเคราะห์; การเก็บข้อมูลคนจริงรอคำตอบจาก Privacy Officer

การป้องกันขั้นต่ำตาม FR-SEC-01–07: HTTPS/HSTS/cookie ที่ปลอดภัย, ตรวจ ownership เพื่อกัน IDOR, parameterized queries, กัน CSV formula injection ทั้งนำเข้าและส่งออก, ไม่มี seed/reset endpoint ใน production, secret อยู่ใน secret manager, และเปิด dependency/secret scanning ใน CI เมื่อพร้อม ระบบต้องบันทึกการเข้าถึง evaluator identity, publish/unpublish, override, finalize/reopen, export ที่มีตัวตน และการเปลี่ยน role พร้อม actor, resource, เวลา UTC, IP และเหตุผลตาม FR-AUDIT-01–03

## ความเสี่ยงหลัก (หัวข้อ 16)

| PRD risk | ความเสี่ยง | แนวรับมือในแบบออกแบบ |
|---|---|---|
| R1–R2 | ตอบแบบสุ่มหรือสมคบ | แสดง artifact, quality signals, anonymity และผู้สอนตรวจรายงาน |
| R3 | เดาตัวตนผู้ประเมินในกลุ่มเล็ก | k-anonymity และไม่แสดง delta รายวัน |
| R4 | คะแนนไม่สอดคล้องกับการตัดสินของอาจารย์ | Report, band mapping ที่อธิบายได้ และ override พร้อมเหตุผล |
| R5 | ผู้ใช้จำนวนมากเข้าชั่วโมงสุดท้าย | load test, capacity ตาม NFR และ autosave |
| R6 | เกณฑ์กำกวม | ตัวอย่างการเขียนเกณฑ์และ QS-07 |
| R7 | ข้อพิพาทเรื่องคะแนน | Appeal, audit และ immutable snapshot |
| R8 | ย้ายกลุ่มแล้วคำตอบเดิมใช้ไม่ได้ | เตือนก่อนเปลี่ยน, generation ใหม่, audit และปิด DQ-09 |
| R9 | ทีมทำไม่ทันภาคเรียน | ส่งมอบตาม Milestone M1 → M4 และไม่ตัด AuthZ/Anonymity/Audit ขั้นบังคับ |
