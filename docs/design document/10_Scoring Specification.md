# 10 — Scoring Specification และตัวอย่างคำนวณ

**ฐานอ้างอิง:** [PRD v2.1](pairwise_evaluation_prd%201.md) หัวข้อ 5 D1/D2/D5/D6, หัวข้อ 9–10 · **สถานะ:** สูตรเป้าหมายของระบบเต็ม **ห้ามใช้แทนสูตรเดโมปัจจุบัน**

## 1. แปลง Choice เป็น Point

| Choice | ซ้าย | ขว |
|:---:|---:|---:|
| 1 | 1.0 | 0.0 |
| 2 | 0.8 | 0.2 |
| 3 | 0.6 | 0.4 |
| 4 | 0.4 | 0.6 |
| 5 | 0.2 | 0.8 |
| 6 | 0.0 | 1.0 |

ต้องใช้ `display_left` ที่บันทึกไว้แปลงกลับเป็น item A/B ที่ถูกต้อง (FR-PAIR-08) และใช้คำตอบจาก `comparison_revision` ของ submission ล่าสุดของ evaluator/side เท่านั้น Draft และ revision เก่าไม่นับ (DR-01)

## 2. Quality index และ Band mapping

สำหรับ item `i` และ criterion `c`:

```text
q(i,c) = Σ(w_e × point_i,e) / Σ(w_e)
w_student = 1.0; w_instructor = instructor_weight
score_ratio(i,c) = floor + (ceiling − floor) × q(i,c)
weighted(i,c) = score_ratio(i,c) × criterion_weight × max_score_side
component(i) = Σ weighted(i,c)
```

ค่าเริ่มต้น `floor=0.60`, `ceiling=1.00`; ไม่ normalize ให้คะแนน item ทั้งหมดรวมเป็น 1 ตาม D2 การใช้ `instructor_weight` เป็น weighted mean ไม่ใช่การคัดลอก vote (D6) [OQ-1](13_Decisions%20Needed.md) เลือกค่าเริ่มต้นนี้สำหรับพัฒนา แต่ยังรอผู้สอนรับรองก่อนใช้กับคะแนนจริง

**ตัวอย่าง PRD หัวข้อ 9.5:** กลุ่ม Aurora มี `q` ของ UX/Completeness/Innovation = `0.72/0.55/0.61`, น้ำหนัก `40/35/25%`, คะแนนเต็ม Group 15 ได้ `5.328 + 4.305 + 3.165 = 12.798` คะแนน นกได้ Individual `4.130/5`; ถ้าประเมินครบ `p=1, M=1` ผลรวม `16.928 ≈ 16.93/20`

## 3. Participation multiplier

```text
p_side = submitted_comparisons / assigned_comparisons
p = (answered_group + answered_individual) / (assigned_group + assigned_individual)
M = min(1, p / completion_threshold)   # default threshold = 0.90
personal_score = (group_component + individual_component) × M
```

`M` กระทบเฉพาะคะแนนส่วนตัวของผู้ประเมิน ไม่เปลี่ยน group component ต้นทางหรือคะแนนเพื่อน (FR-SCORE-11) UI ต้องแสดง `p` และ `M` (FR-SCORE-12/13) [OQ-2](13_Decisions%20Needed.md) เลือกคูณทั้งก้อนเพื่อพัฒนา แต่ยังรอการรับรองนโยบายคะแนนจริง

**DQ-12:** ถ้า `assigned_group + assigned_individual = 0` ให้แสดง `p = N/A`, ใช้ `M = 1` แบบ neutral และไม่สร้างคะแนนจากข้อมูลว่าง; ถ้ามีงานเพียง side เดียว ให้นับเฉพาะคู่ที่มอบหมายจริง. หาก side ที่ต้องมีคะแนนจัดคู่ไม่ได้ ให้ `NO_DATA` และห้าม Finalize อัตโนมัติ ไม่ตีความว่า “ไม่มีงาน” เพื่อให้ผ่านเกณฑ์โดยปริยาย

## 4. ความเชื่อมั่นและ Finalize

Item ที่มี comparison น้อยกว่า `min_comparisons` (default 3) ต้อง flag `LOW_CONFIDENCE` และไม่ finalize อัตโนมัติ; quality signals QS-01–07 ช่วยให้ผู้สอนตรวจ ไม่ลดน้ำหนักคำตอบอัตโนมัติ (FR-SCORE-05, FR-QS-01) Interim คำนวณรายวันและเมื่อผู้สอนสั่ง; Finalize สร้าง immutable input/output snapshot พร้อม formula version และ override ต้องมีเหตุผล (FR-SCORE-06–10, DR-03)

**ความต่างจากเดโม:** เดโม normalize ค่าเฉลี่ย Group ทั้งห้องและ Individual ภายในกลุ่มให้รวม 1 แล้วปรับตาม completion ratio แยก side; PRD v2.1 ใช้ band mapping + participation multiplier ข้ามสอง side จึงให้ตัวเลขคนละชุด ห้ามอ้างผลทดสอบเดโมว่าตรวจสูตรนี้แล้ว

## 5. วิธีที่ PRD หัวข้อ 9.6 พิจารณาแต่ไม่เลือกในรุ่นแรก

| วิธี | เหตุผลที่ยังไม่ใช้ตาม PRD |
|---|---|
| Bradley–Terry | อธิบายและตรวจสอบเหตุผลของคะแนนกับนักศึกษาได้ยากกว่า |
| Elo / TrueSkill | ผลขึ้นกับลำดับที่คำตอบเข้ามา ซึ่งไม่เหมาะกับการให้คะแนนรายวิชา |
| z-score / percentile rank | บังคับให้มีคะแนนต่ำบางส่วน แม้งานทุกกลุ่มมีคุณภาพดี |

PRD เสนอให้พิจารณาวิธีเหล่านี้อีกในรุ่นหลัง โดยเก็บคำตอบดิบและ snapshot ให้คำนวณย้อนกลับได้
