# PairEval — แผนทำ Full System ให้พร้อมตรวจรับภายใน 7 วัน

**สถานะ:** แผนดำเนินงาน ยังไม่ใช่รายงานว่าระบบเต็มทำเสร็จแล้ว  
**แหล่งข้อกำหนดหลัก:** [PRD v2.1](pairwise_evaluation_prd%201.md) และ [Traceability Matrix](12_Traceability%20Matrix.md) ซึ่งติดตามรหัส 188 รายการ; [หน้า UI และปลายทางปุ่ม](06_Wireframe%20UI_หน้าตาใช้งาน.md) ใช้กำหนดหน้าที่ต้องเปิดได้  
**ฐานที่นำมาต่อยอด:** [PairEval-Demo](../../README.md) มี Main Flow สำหรับข้อมูลสังเคราะห์ แต่การเลือกบัญชีตัวอย่าง, สูตรและสถานะคะแนน, การจัดคู่, รายงาน และ CSV ยังไม่เท่าระบบเต็มตาม PRD. [gap matrix รุ่นเก่า](../full-system/requirements-gap-matrix.md) อ้าง Project Description 1 จึงใช้เป็นข้อมูลสำรวจเท่านั้น ไม่ใช้ตัดสินว่า PRD v2.1 ผ่านแล้ว  
**สถาปัตยกรรม staging ที่เลือก (29 กันยายน 2026):** พัฒนาใน Git repo `PairEval-Demo` → เก็บ source ใน GitHub private repository → deploy ไป Vercel project สำหรับ staging ที่มี URL คงที่ → ใช้ Neon PostgreSQL สำหรับข้อมูล staging ที่เป็นข้อมูลสังเคราะห์. แยกฐานข้อมูล development กับ staging และแยก audit storage ตาม PRD. SQLite เดิมเก็บเป็น Demo baseline สำหรับทดสอบบนเครื่องเท่านั้น; ระบบเต็มและ Vercel staging ต้องใช้ PostgreSQL ตั้งแต่เริ่มย้ายฟีเจอร์  
**เหตุผลของทางเลือก:** PRD v2.1 หัวข้อ 6 วาง PostgreSQL ไว้ในสถาปัตยกรรม และ [Vercel ระบุว่าไฟล์ SQLite ใน Functions ไม่ใช่ที่เก็บข้อมูลถาวร](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel). การเชื่อม GitHub กับ Vercel ช่วยให้ deploy จาก branch staging และทดสอบบน URL ที่กำหนดได้ตาม [Vercel Git integration](https://vercel.com/docs/git)  
**กรอบเวลา:** 7 วันทำงานต่อเนื่องนับวันเริ่มงานเป็นวันที่ 1. เป้าหมายวันที่ 7 คือ **release candidate บน staging ที่ทดสอบได้ครบตาม PRD v2.1 ในขอบเขต v1.0** พร้อมหลักฐานรายข้อ. การนำข้อมูลจริงไปใช้หรือประกาศ production ready ต้องผ่านการอนุมัติหน่วยงานและ Definition of Done ใน PRD หัวข้อ 19 ด้วย; ระยะอนุมัติจากภายนอกไม่อาจรับประกันภายใน 7 วัน

## 1. เงื่อนไขที่ทำให้แผน 7 วันเป็นไปได้

1. **กำลังคน:** ต้องมีผู้ลงมือ 4–6 คนตามสมมติฐาน C3 ของ PRD แบ่งงานคู่ขนานเป็น (A) identity/ข้อมูล/สิทธิ์, (B) pairing/evaluation/scoring, (C) UI/report/export, (D) QA/security/integration; ผู้สอนหรือ Product, IT และผู้ดูแลความเป็นส่วนตัวต้องตอบประเด็นที่เกี่ยวภายในวัน 1–2. หากมีผู้พัฒนาคนเดียวหรือ AI หนึ่งงานตามลำดับ แผนนี้เป็นเป้าหมายเร่งรัด ไม่ใช่ประมาณการที่รับประกันได้
2. **สิ่งที่ต้องพร้อมในวัน 1:** สิทธิ์สร้าง/เชื่อม GitHub private repository, Vercel project สำหรับ staging, Neon PostgreSQL development/staging และ audit storage แยก, บัญชีทดสอบ Google OIDC, ช่องทางส่ง notification และนโยบายเปิด artifact ให้ผู้ประเมิน. ต้องกำหนด URL staging ที่คงที่ก่อนเพิ่ม Google redirect URI; URI ใน Google ต้องตรงกับ callback route ที่พัฒนาจริง (PRD เสนอ `/api/auth/oidc/callback` แต่ OAuth client เดิมใน Google อาจใช้ `/api/auth/callback/google`). ใช้ client/secret สำหรับ PairEval แยกจาก Lab. [Decisions Needed](13_Decisions%20Needed.md) มีข้อสรุปสำหรับพัฒนา OQ-1–8/DQ-09–14 แล้ว; ต้อง review ร่าง DQ-11 ใน [API Contract](07_API%20Contract_ส่วนใดเรียกส่งข้อมูล.md), นำ [Errata Proposal](15_PRD%20v2.1%20Errata%20Proposal.md) ไปทบทวน และระบุผู้รับผิดชอบ gates ภายนอก. ใช้เฉพาะข้อมูลสังเคราะห์จนกว่า privacy/security review และการอนุมัติข้อมูลจริงจะผ่าน
3. **ขอบเขตไม่เปลี่ยนเงียบ ๆ:** ข้อที่ PRD v2.1 ระบุว่า in scope ต้องเข้าตารางติดตาม แม้มี priority M/S/C. LMS/LTI, native app, UI หลายภาษา และโมเดล Bradley–Terry/Elo อยู่นอก v1.0 ตาม PRD หัวข้อ 2.2; OQ-5 เลือก Export สำหรับพัฒนา v1.0 แล้ว หากผู้สอนต้องการ LMS ภายหลังให้เปลี่ยน scope/PRD อย่างเป็นทางการ
4. **ห้ามอ้างว่าเสร็จเมื่อยังติด gate:** หากข้อกำหนดใดไม่มี implementation และหลักฐานทดสอบ, decision ยังไม่ปิด, integration ภายนอกยังไม่ผ่าน หรือ security/privacy review ไม่ผ่าน ให้ลงสถานะจริงและระบุว่า **Full System ยังไม่เสร็จใน 7 วัน**. ห้ามแทนด้วย mock, UI placeholder หรือผลทดสอบ Demo เดิม
5. **ขอบเขต repository:** ทำงานใน Git repo `PairEval-Demo` ที่เป็นอิสระ เก็บ Demo baseline ที่ย้อนกลับได้; ไม่แก้ submodule หรือ pointer ของ root repo โดยเฉพาะ `SPDX-Lab/koencontrol-sdpx_lab` และไม่ใช้ข้อมูล/secret ของ Lab 07
6. **ตำแหน่ง secret:** เครื่องพัฒนาเก็บค่าใน `.env.local` ที่ไม่เข้า Git; Vercel staging เก็บ `DATABASE_URL`, ค่า Google OIDC, session secret และค่า audit/notification ที่เกี่ยวใน Environment Variables ของ staging project. GitHub เก็บ source/CI; ไม่ใส่ credential หรือ SQLite database ใน commit และไม่คัดลอก secret ของ Lab. GitHub Actions Secrets ใช้เฉพาะ workflow ที่จำเป็นต้องเรียกบริการนั้น; ไม่ใช่ที่เก็บค่า runtime ของ Vercel
7. **ข้อจำกัดฐานข้อมูล:** โค้ด Demo ปัจจุบันใช้ `node:sqlite` และไฟล์ `data/demo.sqlite`; การตั้ง `DATABASE_URL` อย่างเดียวไม่ใช่การย้ายฐานข้อมูล. ต้องมี PostgreSQL schema/migration, data-access layer, seed สังเคราะห์และ tests ที่ยืนยัน transaction/สิทธิ์ก่อนนับว่าแต่ละฟีเจอร์ทำงานบน staging. ห้าม deploy SQLite file เป็นฐานข้อมูลเขียนจริงของ Vercel

## 2. กติกาการทำงานรายวันและหลักฐาน

- วัน 1 สร้าง `docs/full-system/prd-v2.1-execution-matrix.md` จาก [Traceability Matrix](12_Traceability%20Matrix.md): ทุก PRD ID มี owner, priority, สถานะ `not started / in progress / implemented / tested / blocked`, commit/หน้า/API, test evidence และ decision ที่พึ่งพา. ห้ามคัดสถานะ “มีแล้ว” จาก gap matrix รุ่นเก่ามาเป็น “tested” โดยไม่ตรวจโค้ดและรันจริง
- ใช้ [Decisions Needed](13_Decisions%20Needed.md) เป็นข้อสรุปเพื่อพัฒนาและรายการ gates ที่ยังต้องรับรอง. บันทึกคำตอบจากผู้รับผิดชอบพร้อมผู้ตัดสิน/วันที่/เหตุผลในไฟล์นั้น แล้วปรับ PRD/แบบออกแบบ/acceptance test หากคำตอบเปลี่ยนกติกา. ประเด็นที่กระทบคะแนน สิทธิ์ หรือความเป็นส่วนตัวต้องรับรองก่อนใช้กับข้อมูลจริง
- วัน 1 ผูก GitHub กับ Vercel staging project และ Neon staging database โดยใช้ข้อมูลสังเคราะห์; แยก environment/credential ของ local, staging และ production ในอนาคต. ต้องทดสอบ deploy/health และการอ่านเขียนฐานข้อมูลจริงก่อนเรียก staging ว่า "พร้อมใช้"; หน้า Demo ที่ยังอ่าน SQLite ต้องระบุว่ายังไม่ย้ายและห้ามอ้างว่าทำงานบน Vercel แล้ว
- รวมงานลง branch ของ PairEval-Demo เท่านั้น. ทุกวันรัน unit, integration, E2E ที่เกี่ยว, lint/build และตรวจ security regression ก่อนรวมงาน; ใช้ migration/seed ที่ทำซ้ำได้. ห้ามแก้ database มือเพื่อทำผลสาธิต
- บันทึก `docs/full-system/day-01.md` ถึง `day-07.md` ตามรูปแบบ: **วัน/ช่วงงาน; สถานะราย PRD ID; สิ่งที่เปลี่ยน; วิธีตรวจและผลจริง; test ผ่าน/ไม่ผ่าน; decision/ข้อจำกัด; งาน P0 ถัดไป 1–3 ข้อ**. หากวันใดไม่ผ่าน gate ให้แก้สิ่งนั้นก่อนเพิ่มฟีเจอร์ถัดไป

## 3. แผน 7 วัน

งานในแต่ละวันทำคู่ขนานตามสาย A–D และรวมผลตอนสิ้นวัน. ตาราง “ผ่านเมื่อ” เป็นเกณฑ์ตรวจจริง ไม่ใช่รายการที่คาดว่าเสร็จโดยอัตโนมัติ

| วัน | งานหลักและงานคู่ขนาน | สิ่งส่งมอบก่อนจบวัน | ผ่านเมื่อ / PRD หลัก |
|---|---|---|---|
| **1 — ตั้ง GitHub/Vercel/Neon และตรวจข้อสรุป** | ตรวจ Demo/PRD/188 IDs และ baseline; สร้าง GitHub private remote/branch สำหรับ staging โดยไม่แตะ root/submodule; เชื่อม Vercel project เฉพาะ staging กับ branch ที่เลือกและกำหนด URL คงที่; เตรียม Neon PostgreSQL development/staging แยกกันและ audit storage; สร้าง migration/schema ขั้นต้น, data-access path และ seed สังเคราะห์; เตรียม `.env.local` กับ Vercel Environment Variables โดยไม่ลง secret ใน Git; ยืนยัน callback route ที่จะใช้จริงและลงทะเบียน local/staging URI ใน Google; review OQ/DQ, API contract และ errata | Demo baseline ย้อนกลับได้, execution matrix 188 IDs, decision record, schema/API contract รุ่นแรก, GitHub/CI, Vercel staging URL, Neon staging และ test fixture | unit/lint/build/Main Flow ของ Demo ผ่านบน local ตามผลจริง; CI ผ่าน; staging deploy แล้ว health และ DB smoke ที่อ่าน/เขียน PostgreSQL ด้วยข้อมูลสังเคราะห์ผ่านจริงโดยไม่เปิด endpoint เขียนข้อมูลสาธารณะ; ไม่มี secret/ข้อมูลจริงใน Git; FR-AUTHZ, FR-ANON-01, FR-AUDIT-01 มีแบบและ test plan |
| **2 — ย้ายข้อมูล ตัวตน ห้องเรียน และสิทธิ์** | A: ย้าย data access ที่ระบบเต็มใช้จาก SQLite ไป PostgreSQL, ทำ migration/seed ซ้ำได้, audit append-only; ทำ Google OIDC, session, FACULTY/SYSTEM_ADMIN และ server-side role/scope. C: dashboard, CSV atomic/upsert, roster, Co-teacher/TA, privacy notice, FS-19 และ SYSTEM_ADMIN สร้างห้องแทน FACULTY owner. D: ทดสอบสิทธิ์ข้ามห้อง/บทบาท, import rollback และ callback บน local/staging | FS-00–FS-04/FS-19 ใช้ PostgreSQL บน staging, schema/seed/migration, entitlement, audit และ privacy notice | login/callback/logout ด้วยบัญชีทดสอบบน URL staging; token/domain/email ผิดถูกปฏิเสธ; CSV atomic; student อ่านข้อมูลคนอื่นไม่ได้; audit/role change มีหลักฐาน; ไม่พึ่ง SQLite ใน flow ระบบเต็ม. FR-AUTH, FR-AUTHZ, FR-CLASS, FR-PRIV-01, FR-AUDIT |
| **3 — Assignment และ Pairing** | B: DRAFT→Publish, feasibility, Group/Individual eligibility, balanced/deterministic pairing, generation และ workload บน PostgreSQL. A: transaction, artifact ราย item, unpublish/re-publish history. C: FS-05–FS-07, clone assignment และคำเตือนผลกระทบ. D: property tests/กรณี infeasible | สร้างงาน, ตรวจ feasibility และ publish ให้ได้คู่ที่บันทึกจริงบน staging; มีทางแก้/ย้ายกลุ่มตามคำตัดสิน | criteria 100%, deadline/timezone, `individual_max_score=0` ไม่สร้างฝั่ง Individual, ไม่มี self-evaluation, seed เดิมให้ผลเดิม, coverage/workload ตรง DB, infeasible ไม่บันทึกครึ่งชุด; history/audit ไม่ถูกลบ. FR-ASSIGN, FR-PAIR, INV-G1/INV-I1/INV-2–6, DR-02/03 |
| **4 — Evaluation และ Scoring** | B: Group/Individual/instructor evaluations, autosave ≤2 วินาที, immutable revisions, partial Submit/Re-submit, deadline server-side, สูตร PRD หัวข้อ 9, participation และ `NO_DATA` บน PostgreSQL. C: FS-08–FS-10, artifact links, k-anonymity/Interim. D: golden tests และ negative access | Main Flow จาก Google login ถึงคะแนนของตนเดินได้บน Vercel staging จากข้อมูลสังเคราะห์ ไม่ใช้คะแนนฝังไว้ | refresh แล้ว draft อยู่, latest submission เท่านั้นที่คำนวณ, 1–6 ตรงสูตร, กลุ่มสมาชิก ≤2 ไม่เปิด Individual, ข้อมูลไม่พอไม่เปิดคะแนน Individual, ไม่มี evaluator identity/delta, student ไม่เห็นคู่หรือคะแนนคนอื่น; คนนอกทีมลอง flow M1 ได้. FR-EVAL, FR-SCORE, FR-ANON, FR-API-01/02/06/07 |
| **5 — รายงานและการตัดสินคะแนน** | C: FS-11–FS-18, Group/Individual/Pair Coverage/Quality พร้อม distribution chart, CSV/XLSX 4 sheet, pseudonymous/identity export, async export เมื่อไฟล์ใหญ่ และ appeals. B: quality signals, เพิ่ม evaluator, recompute, override, finalize snapshot/reopen. A: audit viewer, data-subject access และ retention/anonymize job. D: ตรวจรายงาน/ไฟล์/score ตรงกัน | ผู้สอนตรวจเหตุผลคะแนน, ส่งออก, override/finalize และดู audit ได้บน staging; นักศึกษายื่นอุทธรณ์ตามสิทธิ์ | golden score และรายงานตรงกัน, XLSX 4 sheet/CSV ภาษาไทยเปิดได้, identity export Owner + ยืนยัน + audit, override มีเหตุผล, snapshot ไม่ถูกแก้ย้อนหลัง, retention/DSAR มี workflow ทดสอบ. FR-REPORT, FR-EXPORT, FR-QS, FR-APPEAL, FR-AUDIT, FR-PRIV |
| **6 — แจ้งเตือน ความปลอดภัย และคุณภาพใช้งาน** | A/C: notification เปิดงาน/48 ชม./regenerate/finalize/เพิ่ม evaluator พร้อม deep link และ retry; privacy/security hardening, ไม่มี seed/reset ใน production, secret scan ใน CI, requestId/log/alert. C: ไทย, mobile ≥320 px, keyboard, radio/contrast/target/aria-live. D: security, accessibility, cross-browser และ load/restore บน Vercel staging/Neon | FS-00–FS-19 เปิดตามสิทธิ์, notification ส่งได้ตาม channel ที่อนุมัติ, test report ด้าน security/a11y/performance | notification ไม่ใส่คะแนน/PII, IDOR/CSRF/session/CSV formula ผ่าน, screen reader ตรวจอย่างน้อยหนึ่งตัว, p95/p99 ตาม NFR, 200 concurrent/10× spike และ restore test มีผลจริง. FR-NOTIF, FR-SEC, FR-A11Y, NFR ทั้งหมด |
| **7 — รวมระบบ ตรวจรับ และ release candidate** | รัน migration บน Neon staging database ใหม่จากศูนย์, E2E ทั้งชุด, regression, load, backup/restore, privacy/security review, UAT โดยคนที่ไม่ใช่ผู้เขียน; แก้ blocker; ตรวจ execution matrix ทุก ID; เขียนคู่มือใช้งาน/deploy/rollback และ known issues; ตรึง version ที่ย้อนกลับได้ | Release candidate บน Vercel staging, คู่มือ, test/evidence report, matrix สถานะจริง, รายการ decision/approval คงค้าง | **ผ่านเฉพาะเมื่อ** ข้อ in-scope ที่อ้างว่าเสร็จมีหลักฐาน, ไม่มี blocker เรื่องสิทธิ์/คะแนน/ความเป็นส่วนตัว, E2E S1–S10 ผ่าน, NFR มีผลวัด, เจ้าของงานยอมรับ. หากไม่ผ่านให้ส่งสถานะตามจริง ไม่ประกาศ Full System เสร็จ |

**ลำดับภายใน 7 วัน:** วัน 4 ตั้งเป้า M1 Walking Skeleton บน staging จนเห็นคะแนน, วัน 5 ปิดฟังก์ชันของ M2 Core Complete, วัน 5–6 ปิดฟังก์ชันของ M3 Trustworthy, วัน 6–7 ตรวจ M4 Production Ready ตาม PRD หัวข้อ 19. แต่การนับ milestone **ผ่านจริง** ยังต้องได้ Definition of Done ของ PRD: pilot กับห้องจริง ≤30 คน, security/privacy review และการใช้กับห้อง 200 คนจริงตามลำดับ. ให้นับเฉพาะเมื่อได้รับอนุญาตและเกิดขึ้นจริงในช่วงนี้; การจำลองด้วยข้อมูลสังเคราะห์เป็นหลักฐานทางเทคนิค แต่ไม่แทน acceptance ของผู้ใช้จริง

## 4. เส้นทาง E2E ที่ต้องผ่านก่อนเรียกว่าเสร็จ

| ID | เส้นทาง | เกณฑ์ผ่าน |
|---|---|---|
| S1 | Google login → roster pending → privacy notice → ห้องของตน | domain/token ผิดหรือไม่มีสิทธิ์ไม่เห็นข้อมูล; session/logout ถูกต้อง |
| S2 | FACULTY สร้างห้อง → CSV atomic/upsert → เพิ่ม/ลบ Co-teacher/TA | diff/rollback ถูก; owner คนสุดท้ายลบไม่ได้; SYSTEM_ADMIN ไม่เห็นคะแนนโดยปริยาย |
| S3 | สร้างงาน/เกณฑ์/artifact → feasibility → Publish | deadline/weight ถูก; คู่ Group/Individual ไม่มี self; infeasible อธิบายเป็นตัวเลขและไม่บันทึกบางส่วน |
| S4 | นักศึกษาเปิดผลงาน → autosave → Submit บางส่วน → Re-submit → ปิดเมื่อ deadline | draft/revision เก่าคงอยู่, latest ใช้คำนวณ, cross-user pair อ่าน/เขียนไม่ได้ |
| S5 | Instructor ประเมิน → เพิ่ม evaluator → unpublish/เปลี่ยนกลุ่ม/publish ใหม่ | weight/coverage ถูก; generation เดิมไม่ปนคะแนน; audit/notification ถึงผู้ได้รับผลกระทบ |
| S6 | คำนวณ q/band/p/M → Interim → k-anonymity → My Score | golden example ตรง, ไม่มีหารศูนย์, ไม่มีข้อมูลรายผู้ประเมินหรือกราฟ delta |
| S7 | Group/Individual/Pair Coverage/Quality → CSV/XLSX | คะแนน/flags/จำนวนคู่ตรงกัน; 4 sheet; Thai/CSV formula protection และสิทธิ์ export ผ่าน |
| S8 | Override พร้อมเหตุผล → Finalize snapshot → Reopen → อุทธรณ์ | snapshot/ประวัติไม่ถูกแก้, role และเวลาอุทธรณ์ถูกตรวจ, audit ครบ |
| S9 | Notification เปิดงาน/48 ชม./regenerate/finalize → กด deep link | ไปหน้าที่ต้องทำตามบทบาท; ข้อความไม่ใส่คะแนน/PII; retry ไม่ส่งซ้ำผิด |
| S10 | ผู้ไม่มีสิทธิ์ยิง URL/API/export/identity ข้ามห้อง → load/restore/mobile/a11y | 403/404 ตาม contract โดยไม่รั่วข้อมูล; NFR-PERF/AVAIL/SCALE/COMPAT/A11Y มีหลักฐานวัดจริง |

## 5. นิยาม “เสร็จใน 7 วัน” และแผนเมื่อไม่ผ่าน

- **Feature complete:** ทุกข้อใน scope ของ PRD v2.1 มีหน้า/API/กติกาที่ใช้งานได้ตาม acceptance criteria และมีหลักฐานทดสอบราย ID ใน execution matrix; ข้อ M/S/C ที่ยังค้างต้องแสดงเป็น `blocked` หรือ `not implemented` และห้ามเรียกว่าครบ PRD
- **Technical release candidate:** test, security, privacy, accessibility และ NFR ที่เกี่ยวผ่านบน staging ด้วยข้อมูลสังเคราะห์; backup/restore, log/alert, คู่มือ deploy/rollback ตรวจจริง. ตัวเลข availability 99.5% ต่อเดือนและ 99.9% ช่วง 48 ชั่วโมงก่อน deadline ต้องติดตามตามช่วงเวลา จึงยืนยันจากการรัน 7 วันไม่ได้
- **Production acceptance:** ต้องมีอนุมัติ infrastructure/Google/notification, นโยบายข้อมูลและ privacy, pilot ตาม M2, security/privacy review ตาม M3 และการทดสอบใช้งานจริงตาม M4. หากสิ่งเหล่านี้ยังไม่เกิด ให้ส่ง release candidate พร้อมรายการค้าง ห้ามใส่ข้อมูลจริงหรือประกาศว่า production ready
- **เมื่อเวลาไม่พอ:** คง Demo baseline ที่ใช้งานได้, ปิดงานที่กระทบความปลอดภัยและคะแนนก่อน, ไม่ลด FR-AUTHZ-01/02, FR-ANON-01 หรือ FR-AUDIT-01, ไม่ merge งานที่ทำให้ Main Flow เสีย. ส่ง matrix ที่บอกสิ่งที่เสร็จ/ไม่เสร็จ, ผลทดสอบจริง, เหตุผลติดขัด และวันที่คาดว่าจะปิดแต่ละข้อ แทนการเลื่อนงานไปเงียบ ๆ

## 6. รูปแบบรายงานเมื่อจบแต่ละวัน

```text
วัน/ช่วงงาน:
PRD IDs และ milestone: implemented / tested / blocked / not implemented
สิ่งที่เปลี่ยน: หน้า, API, schema, migration และ commit ที่เกี่ยวข้อง
วิธีตรวจจริง: ขั้นตอน/ข้อมูลสังเคราะห์/สภาพแวดล้อม
ผลทดสอบ: ชุดทดสอบ, ผ่าน/ไม่ผ่าน, ตัวเลขที่วัดได้, defect ที่ยังเปิด
คำตัดสิน/approval ที่รอ: ID, ผู้รับผิดชอบ, ผลต่อกำหนด 7 วัน
ความเสี่ยงและข้อจำกัด: mock, placeholder, integration หรือผลที่ยังไม่ยืนยัน
งาน P0 ถัดไป: 1–3 ข้อ
```

**หมายเหตุ:** แผนนี้จัดลำดับให้มีโอกาสส่งมอบภายใน 7 วัน แต่ไม่ได้เปลี่ยนข้อเท็จจริงว่าระบบเต็มยังต้องพัฒนาและทดสอบ. วันที่ 7 ต้องรายงานผลจริงตาม gate ข้างต้น

