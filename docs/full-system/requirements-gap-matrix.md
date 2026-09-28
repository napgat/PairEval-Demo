# Project Description 1 — Demo Gap Matrix

ตรวจ ณ commit `3280f46389280ffc13e33a6add12853f0eb6e57d` วันที่ 28 กันยายน 2026 โดยเทียบ [Project Description 1](../../../SPDX-Lab/Project%20Plan/Pairwise%20Evaluation%20-%20Project%20Description%201.md) กับโค้ดและการทดสอบจริงของ PairEval-Demo

สถานะใช้ความหมายดังนี้

- **มีแล้ว** — มีเส้นทางใช้งานและกติกาหลักใน Demo พร้อมหลักฐานจากโค้ด/การทดสอบ
- **ต้องแก้** — มีบางส่วน แต่ยังไม่ครบข้อกำหนด Full System, ขัดกับข้ออื่น หรือยังผูกกับข้อจำกัด Demo
- **ยังไม่มี** — ไม่มี implementation; อาจมีเพียง placeholder หรือโครงตาราง

## User stories — Instructor

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| I-01 | ต้องแก้ | สร้างห้องและ import `email,groupname` แบบ transaction ได้ แต่ parser รับเฉพาะโดเมน `.invalid` | [classroom-input.ts](../../src/lib/classroom-input.ts#L44), [classrooms API](../../src/app/api/classrooms/route.ts#L9) |
| I-02 | ยังไม่มี | schema รองรับหลาย instructor แต่ไม่มี API/UI เพิ่มหรือลบอาจารย์ร่วม | [seed.mjs](../../scripts/seed.mjs#L20), placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| I-03 | มีแล้ว | สร้าง Assignment และ criteria แยก Group/Individual ได้ | [assignment-form.tsx](../../src/app/demo/components/assignment-form.tsx#L41), [assignments API](../../src/app/api/assignments/route.ts#L9) |
| I-04 | มีแล้ว | กำหนดคะแนนรวมและตรวจว่า Group + Individual เท่ากับคะแนนรวม | [assignment-input.ts](../../src/lib/assignment-input.ts#L23) |
| I-05 | มีแล้ว | กำหนดน้ำหนักแต่ละ criterion และบังคับรวม 100% แยกสองส่วน | [assignment-input.ts](../../src/lib/assignment-input.ts#L33) |
| I-06 | มีแล้ว | กำหนด deadline Group/Individual แยกกัน | [assignment-input.ts](../../src/lib/assignment-input.ts#L26), [assignment-form.tsx](../../src/app/demo/components/assignment-form.tsx#L62) |
| I-07 | ยังไม่มี | ไม่มีคะแนนตรงของอาจารย์และยังไม่มีสูตรรวมกับ pairwise | ไม่มี field/route ใน [schema](../../scripts/seed.mjs#L38); ดู DEC-03 |
| I-08 | ยังไม่มี | ไม่มีคำสั่งส่งคู่ที่เลือกให้ evaluator เพิ่ม X คน | placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| I-09 | มีแล้ว | รายงานแสดงคะแนนทุกกลุ่มและทุกคนใน Assignment | [Demo report](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L84) |
| I-10 | ต้องแก้ | มี pair coverage และคะแนนต่อ item/criterion แต่ยังไม่มีคะแนนสะสมแยกต่อ pair | [score-store.ts](../../src/lib/score-store.ts#L7), [Demo report](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L96) |
| I-11 | ยังไม่มี | ไม่มี `instructor_weight` ใน Assignment และไม่มี instructor vote | [schema](../../scripts/seed.mjs#L38) |
| I-12 | ต้องแก้ | มี CSV summary หนึ่งแบบ; ยังไม่มี Excel และรายงาน 3 ระดับ | [export route](../../src/app/api/assignments/%5Bid%5D/export/route.ts#L9), [score-store.ts](../../src/lib/score-store.ts#L61) |
| I-13 | ยังไม่มี | ไม่มีเปลี่ยนกลุ่ม, generation, invalidate, notification หรือ history | placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |

## User stories — Student

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| S-01 | ต้องแก้ | เห็นเฉพาะห้องตาม membership ได้ แต่ login เป็น account picker ไม่มี Google OAuth | [home page](../../src/app/page.tsx#L16), [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L61) |
| S-02 | มีแล้ว | ประเมินกลุ่มอื่นผ่าน pairwise ตามคู่ที่ได้รับมอบหมาย | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L43), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L32) |
| S-03 | มีแล้ว | ประเมินเพื่อนในกลุ่มผ่าน pairwise และไม่เห็นคู่ของคนอื่น | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L50), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L32) |
| S-04 | มีแล้ว | Save draft แล้วโหลดกลับได้ | [evaluation-store.ts](../../src/lib/evaluation-store.ts#L60), [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L37) |
| S-05 | ต้องแก้ | เห็นคะแนนกลุ่มตนแบบ rolling พร้อม Interim แต่ยังไม่มี policy ให้ Instructor เลือกเวลาเผยแพร่ | [Demo score page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L113), ดู DEC-08 |
| S-06 | มีแล้ว | คะแนนบุคคลตนคำนวณเมื่อเรียกหน้า/API และอัปเดตจาก submission ล่าสุด | [scores API](../../src/app/api/assignments/%5Bid%5D/scores/route.ts#L20), [score-store.ts](../../src/lib/score-store.ts#L25) |
| S-07 | มีแล้ว | ไม่ submit แล้วคะแนนส่วนนั้นเป็น 0 เมื่อมีคู่ที่ได้รับมอบหมาย | [score-engine.ts](../../src/lib/score-engine.ts#L20) |
| S-08 | มีแล้ว | Re-submit ก่อน deadline ได้; เก็บทุก revision และใช้ล่าสุด | [evaluation-store.ts](../../src/lib/evaluation-store.ts#L94), [score-engine.ts](../../src/lib/score-engine.ts#L28) |
| S-09 | มีแล้ว | Student API ส่งเฉพาะ score ของตนและหน้าจอไม่ส่ง identity ของ evaluator | [scores API](../../src/app/api/assignments/%5Bid%5D/scores/route.ts#L21), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L5) |

## FR-AUTH — Authentication

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-AUTH-01 | ยังไม่มี | ไม่มี Google OAuth 2.0; เลือกบัญชีสังเคราะห์จากหน้าแรกได้ | [home page](../../src/app/page.tsx#L16), [demo session route](../../src/app/api/demo/session/route.ts#L9) |
| FR-AUTH-02 | ต้องแก้ | membership ผูกด้วย email ตอน import ได้ แต่ไม่มี verified Google identity/pending activation | [classrooms API](../../src/app/api/classrooms/route.ts#L28) |
| FR-AUTH-03 | ต้องแก้ | API ตรวจ role และ scope ฝั่ง server แต่ identity ของ Demo เลือกได้โดยไม่ยืนยันตัวตน | [evaluation API](../../src/app/api/assignments/%5Bid%5D/evaluation/%5Bkind%5D/route.ts#L10), [home page](../../src/app/page.tsx#L20) |
| FR-AUTH-04 | มีแล้ว | instructor คนเดียวอยู่ใน `classroom_instructors` ของหลายห้องได้ และ seed ใช้จริงสองห้อง | [schema/seed](../../scripts/seed.mjs#L20) |

## FR-CLASS — Classroom Management

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-CLASS-01 | ต้องแก้ | สร้างห้องพร้อม CSV ได้ แต่บังคับข้อมูลสังเคราะห์ `.invalid` | [classroom-form.tsx](../../src/app/demo/components/classroom-form.tsx#L40), [classroom-input.ts](../../src/lib/classroom-input.ts#L60) |
| FR-CLASS-02 | มีแล้ว | parse CSV, สร้างกลุ่ม และผูกสมาชิกตาม `groupname` ใน transaction | [classrooms API](../../src/app/api/classrooms/route.ts#L23) |
| FR-CLASS-03 | ยังไม่มี | ไม่มีเพิ่ม/ลบ co-instructor | [schema](../../scripts/seed.mjs#L20), placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| FR-CLASS-04 | ต้องแก้ | Demo filter ห้องด้วย membership แล้ว แต่ยังอาศัย account picker | [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L61), [home page](../../src/app/page.tsx#L18) |

## FR-ASSIGN — Assignment Management

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-ASSIGN-01 | มีแล้ว | ชื่อ, คะแนน Group/Individual และ deadline แยกสองส่วนครบ | [AssignmentInput](../../src/lib/assignment-input.ts#L2), [assignment form](../../src/app/demo/components/assignment-form.tsx#L62) |
| FR-ASSIGN-02 | มีแล้ว | Group criteria หลายข้อและตรวจผลรวม 100% | [assignment-input.ts](../../src/lib/assignment-input.ts#L33) |
| FR-ASSIGN-03 | มีแล้ว | Individual criteria หลายข้อและตรวจผลรวม 100% | [assignment-input.ts](../../src/lib/assignment-input.ts#L33) |
| FR-ASSIGN-04 | ยังไม่มี | มีเฉพาะ POST สร้างงาน ไม่มี edit route/UI หรือ policy เมื่อมี pair/submission | [assignments API](../../src/app/api/assignments/route.ts#L9) |

## FR-PAIR — Pairing Engine

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-PAIR-01 | มีแล้ว | สร้างทุก group combination และเลือก evaluator 5 คนต่อคู่เมื่อ feasible | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L43), [day3 pairing test](../../tests/day3-pairing.test.ts#L15) |
| FR-PAIR-02 | ต้องแก้ | ไม่ได้บังคับนักศึกษาแต่ละคน 5 คู่ต่อ criterion; engine กระจายงานตาม coverage | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L73), ดู DEC-02 |
| FR-PAIR-03 | มีแล้ว | coverage เท่ากันที่ target 5 และเลือกคนภาระต่ำก่อนแบบ deterministic | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L75), [pairing-store.ts](../../src/lib/pairing-store.ts#L43) |
| FR-PAIR-04 | มีแล้ว | Group evaluator ถูกตัดออกเมื่ออยู่ใน item A หรือ B | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L59) |
| FR-PAIR-05 | มีแล้ว | Individual pair และ evaluator จำกัดอยู่ในกลุ่มเดียวกัน | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L50) |
| FR-PAIR-06 | ต้องแก้ | สร้างคู่ภายในกลุ่มได้ แต่จำนวนต่อ evaluator ไม่ใช่ 5 ต่อ criterion | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L50), ดู DEC-02 |
| FR-PAIR-07 | มีแล้ว | evaluator ถูกตัดออกจากคู่ที่มีตนเอง | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L61) |
| FR-PAIR-08 | มีแล้ว | ทุก individual combination ได้ evaluator 5 คนเมื่อ feasible; ทั้งงานถูกปฏิเสธเมื่อไม่พอ | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L63), [pairing-store.ts](../../src/lib/pairing-store.ts#L54) |
| FR-PAIR-09 | ยังไม่มี | ไม่มีเปลี่ยนกลุ่ม | placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| FR-PAIR-10 | ยังไม่มี | ไม่มี regenerate generation ใหม่ | schema มี pair ชุดเดียวใน [seed.mjs](../../scripts/seed.mjs#L48) |
| FR-PAIR-11 | ยังไม่มี | ไม่มี invalidation flag/generation สำหรับ submissions เก่า | [submission schema](../../scripts/seed.mjs#L61) |
| FR-PAIR-12 | ยังไม่มี | ไม่มี warning flow ก่อน regenerate | ไม่มี route/UI; ดู placeholder [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| FR-PAIR-13 | ยังไม่มี | ไม่มี notification model/provider | [schema](../../scripts/seed.mjs#L13) |
| FR-PAIR-14 | ยังไม่มี | ไม่มี regenerate history, actor หรือ timestamp | [schema](../../scripts/seed.mjs#L48) |

## FR-EVAL — Evaluation UI

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-EVAL-01 | มีแล้ว | หน้า Group เดียววนแสดงทุก criterion ที่ได้รับมอบหมาย | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L35) |
| FR-EVAL-02 | ต้องแก้ | จัดกลุ่มคู่ตาม criterion ได้ แต่จำนวนคู่ต่อ criterion ขึ้นกับ pairing engine และไม่รับประกัน 5 ต่อคน | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L59), ดู DEC-02 |
| FR-EVAL-03 | ต้องแก้ | Demo ใช้ radio 6 ระดับ ขณะที่บรรทัดนี้ระบุ 5 ระดับ | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L7), ดู DEC-01 |
| FR-EVAL-04 | มีแล้ว | Save draft ก่อน deadline และเปิดกลับมาได้ | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L37), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L114) |
| FR-EVAL-05 | ต้องแก้ | revision เดิม immutable แต่ผู้ใช้แก้คำตอบแล้ว Re-submit ได้ตาม FR-EVAL-14; ต้องยืนยันการตีความ | [evaluation-store.ts](../../src/lib/evaluation-store.ts#L118), ดู DEC-05 |
| FR-EVAL-06 | มีแล้ว | แจ้งจำนวนคู่ที่ยังไม่ตอบก่อน submit | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L64) |
| FR-EVAL-07 | มีแล้ว | Group/Individual เป็น route และ view แยกกัน | [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L106) |
| FR-EVAL-08 | มีแล้ว | Individual pair ถูกสร้างและโหลดเฉพาะภายในกลุ่ม | [pairing-engine.ts](../../src/lib/pairing-engine.ts#L50), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L32) |
| FR-EVAL-09 | ต้องแก้ | UI รูปแบบเดียวกับ Group แต่ไม่รับประกัน 5 คู่ต่อ criterion | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L59) |
| FR-EVAL-10 | มีแล้ว | Draft/submission แยกด้วย `kind` และคนละ route | [evaluation API](../../src/app/api/assignments/%5Bid%5D/evaluation/%5Bkind%5D/route.ts#L27), [revision query](../../src/lib/evaluation-store.ts#L54) |
| FR-EVAL-11 | มีแล้ว | UI และ server ปิด Save/Submit หลัง deadline | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L33), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L99) |
| FR-EVAL-12 | มีแล้ว | draft ไม่อยู่ใน submission revisions และไม่ถูก score; ผู้ไม่ submit ได้ 0 | [evaluation-store.ts](../../src/lib/evaluation-store.ts#L114), [score-engine.ts](../../src/lib/score-engine.ts#L28) |
| FR-EVAL-13 | มีแล้ว | แสดง deadline และ countdown | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L12) |
| FR-EVAL-14 | มีแล้ว | Re-submit ได้ไม่จำกัดก่อน deadlineด้วย revision ใหม่ | [evaluation-store.ts](../../src/lib/evaluation-store.ts#L119) |
| FR-EVAL-15 | มีแล้ว | เก็บทุก revision และ scoring เลือก revision number ล่าสุด | [submission schema](../../scripts/seed.mjs#L61), [score-engine.ts](../../src/lib/score-engine.ts#L28) |
| FR-EVAL-16 | มีแล้ว | หน้า Evaluation แสดง revision และเวลาส่งล่าสุด | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L58) |
| FR-EVAL-17 | มีแล้ว | revision แยก Group/Individual ด้วย `kind` | [submission schema](../../scripts/seed.mjs#L61), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L54) |

## FR-SCORE — Scoring Engine

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-SCORE-01 | มีแล้ว | รวม point แล้วหารจำนวนคำตอบจริงต่อ item | [score-engine.ts](../../src/lib/score-engine.ts#L49) |
| FR-SCORE-02 | ต้องแก้ | normalize Group ทั้งห้องและ Individual ภายในแต่ละกลุ่ม; ต้องให้อาจารย์รับรองขอบเขต normalization | [score-engine.ts](../../src/lib/score-engine.ts#L42), ดู DEC-09 |
| FR-SCORE-03 | มีแล้ว | normalized average × weight% × max score | [score-engine.ts](../../src/lib/score-engine.ts#L61) |
| FR-SCORE-04 | มีแล้ว | ไม่ submit ในส่วนที่ได้รับมอบหมายทำให้ส่วนนั้นเป็น 0 | [score-engine.ts](../../src/lib/score-engine.ts#L20) |
| FR-SCORE-05 | มีแล้ว | Save draft อย่างเดียวไม่ถูกนับและได้ 0 | [score-engine.ts](../../src/lib/score-engine.ts#L28), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L114) |
| FR-SCORE-06 | ยังไม่มี | ไม่มี `instructor_weight` ใน Assignment | [assignment schema](../../scripts/seed.mjs#L38) |
| FR-SCORE-07 | ยังไม่มี | ไม่มี instructor evaluation/vote ใน scoring input | [ScoreInput](../../src/lib/score-engine.ts#L2) |
| FR-SCORE-08 | ยังไม่มี | ไม่มี weight สำหรับ Group หรือ Individual | [assignment schema](../../scripts/seed.mjs#L38) |
| FR-SCORE-09 | ยังไม่มี | Report ไม่มี effective instructor vote count | [Demo report](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L91) |
| FR-SCORE-10 | ต้องแก้ | คะแนนเปลี่ยนเมื่อเปิดหน้า/API แต่ยังไม่มี scheduled daily projection หรือ `computed_at` | [getAssignmentScore](../../src/lib/score-store.ts#L25), dependency scheduler ใน `external-dependencies.md` |
| FR-SCORE-11 | มีแล้ว | เปิดหน้าแก้และ Re-submit ได้จนถึง deadline | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L33), [evaluation-store.ts](../../src/lib/evaluation-store.ts#L94) |
| FR-SCORE-12 | มีแล้ว | Student score API ส่งเฉพาะ record ของผู้เรียก | [scores API](../../src/app/api/assignments/%5Bid%5D/scores/route.ts#L21) |
| FR-SCORE-13 | มีแล้ว | หน้า My Score แสดง Interim และคำเตือนว่าเปลี่ยนได้ | [Demo score page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L120) |
| FR-SCORE-14 | มีแล้ว | หลัง deadline แสดง Final เมื่อข้อมูลครบ และคำนวณจาก submitted latest revisions | [scoreStatus](../../src/lib/score-store.ts#L49), [score-engine.ts](../../src/lib/score-engine.ts#L28) |
| FR-SCORE-15 | มีแล้ว | คูณคะแนนฐานด้วย answered/assigned ของผู้ส่ง | [applyCompletion](../../src/lib/score-engine.ts#L20) |
| FR-SCORE-16 | มีแล้ว | นับ completion แยก Group/Individual | [score-engine.ts](../../src/lib/score-engine.ts#L78) |
| FR-SCORE-17 | มีแล้ว | แสดง answered/total รวมและแยกแต่ละ criterion | [evaluation-panel.tsx](../../src/app/demo/components/evaluation-panel.tsx#L57) |
| FR-SCORE-18 | มีแล้ว | ไม่มี submission แล้ว score เป็น 0 เมื่อมี assigned pairs | [applyCompletion](../../src/lib/score-engine.ts#L20) |
| FR-SCORE-19 | มีแล้ว | หน้าและ API นักศึกษาแสดงเฉพาะคะแนนรวมของตน | [scores API](../../src/app/api/assignments/%5Bid%5D/scores/route.ts#L22), [Demo score page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L113) |
| FR-SCORE-20 | ยังไม่มี | Instructor ไม่มี Raw Pairs report จึงยังดู evaluator ไม่ได้ | placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127), ดู DEC-04 |
| FR-SCORE-21 | ยังไม่มี | ไม่มี Raw Pairs export หรือ shareable anonymized mode | [export route](../../src/app/api/assignments/%5Bid%5D/export/route.ts#L9), ดู DEC-04 |

## FR-REPORT — Report & Visibility

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-REPORT-01 | มีแล้ว | รายงานแสดงคะแนน Group ทุกกลุ่มใน Assignment | [Demo report](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L94) |
| FR-REPORT-02 | มีแล้ว | รายงานแสดง Group, Individual และ total ทุกคนในห้อง | [Demo report](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L95) |
| FR-REPORT-03 | ต้องแก้ | แสดงคู่ทั้งหมดและ answered/assigned แล้ว แต่ยังไม่มีคะแนนสะสมแยกต่อ pair/criterion | [getPairAnswerCoverage](../../src/lib/score-store.ts#L7), [Demo report](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L97) |
| FR-REPORT-04 | ยังไม่มี | ไม่มีปุ่ม/route ส่งคู่ให้ X คนเพิ่ม | placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| FR-REPORT-05 | ยังไม่มี | ไม่มีหน้า instructor pairwise evaluation | placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| FR-REPORT-06 | ต้องแก้ | นักศึกษาเห็นคะแนนกลุ่มตนแบบ rolling แต่ยังไม่มี release policy ต่อ Assignment | [Demo score page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L113), ดู DEC-08 |
| FR-REPORT-07 | มีแล้ว | เห็น Individual score ของตนพร้อม Interim | [Demo score page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L120) |
| FR-REPORT-08 | มีแล้ว | Student API เลือกเฉพาะ record ตนและตรวจ membership | [scores API](../../src/app/api/assignments/%5Bid%5D/scores/route.ts#L16) |

## FR-EXPORT — Export

| ID | สถานะ | เทียบกับ Demo ปัจจุบัน | หลักฐานจากโค้ด |
|---|---|---|---|
| FR-EXPORT-01 | ต้องแก้ | CSV ใช้งานได้; Excel `.xlsx` ยังไม่มี | [export route](../../src/app/api/assignments/%5Bid%5D/export/route.ts#L18) |
| FR-EXPORT-02 | ต้องแก้ | มี combined student score summary เพียงแบบเดียว; ไม่มี Group Summary, Individual Summary และ Raw Pairs แยก | [makeScoreCsv](../../src/lib/score-store.ts#L61) |
| FR-EXPORT-03 | ยังไม่มี | ไม่มี Excel workbook/3 sheets | ไม่มี dependency/route; placeholder ใน [Demo page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L127) |
| FR-EXPORT-04 | ยังไม่มี | ไม่มีตัวเลือกชนิด CSV | [export page](../../src/app/demo/%5Brole%5D/%5B%5B...slug%5D%5D/page.tsx#L101) |
| FR-EXPORT-05 | ต้องแก้ | filename ปัจจุบันคือ `paireval-{id}-scores.csv` ไม่ตรงรูปแบบที่กำหนด | [export route](../../src/app/api/assignments/%5Bid%5D/export/route.ts#L18) |

## Non-functional requirements ที่ไม่มี ID

| Requirement | สถานะ | หลักฐาน/ช่องว่าง |
|---|---|---|
| Evaluation page ภายใน 2 วินาที | ต้องแก้ | Main Flow ผ่านบนเครื่อง local แต่ยังไม่มี performance budget, load test หรือผล p95 |
| Availability 99.5% ก่อน deadline | ยังไม่มี | ยังไม่มี staging/production monitoring, SLO หรือ runbook |
| Google OAuth, HTTPS, data isolation | ต้องแก้ | scope checks มีใน API แต่ไม่มี Google OAuth/HTTPS environment; ดู FR-AUTH |
| 1 Classroom = 200 นักศึกษา, 10 กลุ่ม | ต้องแก้ | CSV จำกัด 200 คนใน [classroom-input.ts](../../src/lib/classroom-input.ts#L67) แต่ยังไม่มี load/property test สำหรับ 200 คน 10 กลุ่ม |
| Responsive mobile | มีแล้ว | UI audit ผ่าน viewport 390px และ CSS มี table scroll/touch layout; ดู baseline ใน `day-01.md` |
| เก็บ evaluation data ≥1 ปีการศึกษา | ยังไม่มี | ไม่มี retention, backup/restore policy หรือ production database |

## ข้อกำหนดเชิงกฎที่ไม่มี ID

| กฎ | สถานะ | หมายเหตุ |
|---|---|---|
| กลุ่มสมาชิกคนเดียวไม่มี Individual Evaluation | มีแล้ว | pairing engine สร้าง combination เฉพาะเมื่อมีอย่างน้อย 2 คน |
| ห้อง 2 กลุ่มให้คู่เดิมซ้ำได้ | ต้องแก้ | ขัดกับกฎห้ามประเมินกลุ่มตนเอง; Demo ปฏิเสธว่า infeasible ดู DEC-06 |
| เพิ่ม evaluator เลือกจากคนที่ยังไม่เคยประเมินคู่นั้น | ยังไม่มี | ไม่มี supplemental assignment flow |
| CSV email ที่ยังไม่มี user เป็น pending | ต้องแก้ | Demo สร้าง user ทันที ไม่มี pending/activation state |
| Re-assignment ก่อนและหลัง deadline | ยังไม่มี | ไม่มี generation/history; ดู DEC-07 |

## สรุปช่องว่างที่กำหนดลำดับงานถัดไป

1. Authentication และ identity จริงยังขาดทั้งหมด จึงห้ามใช้ข้อมูลนักศึกษาจริง
2. Database เป็น SQLite Demo ไม่มี migration, generation, audit, notification, instructor vote หรือ retention
3. Pairing ปัจจุบันให้ coverage 5 ได้เมื่อ feasible แต่ไม่เป็นไปตาม “5 คู่ต่อคนต่อ criterion” ต้องตัดสิน policy ก่อนแก้ algorithm
4. Scoring หลัก, draft/revision, partial credit และการแยกสิทธิ์นักศึกษามีฐานที่ใช้ต่อได้
5. Instructor direct score, instructor weight, supplemental evaluator, re-assignment และ Raw Pairs ยังไม่มี
6. Export มีเพียง CSV summary; Excel และ export 3 ระดับยังไม่มี
