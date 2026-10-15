> บันทึกประวัติจากรอบก่อนแก้: โปรดใช้ [ผลล่าสุดตาม PRD v2.0](prd-v2.0-readiness-2026-10-15.md) สำหรับการนำเสนอครั้งนี้

# PairEval: เทียบกับ PRD ในลิงก์อาจารย์

วันที่ตรวจ: 15 ตุลาคม 2026 (Asia/Bangkok)

**ผล: ตรงบางส่วน แต่ยังไม่ผ่าน PRD ครบ และ Demo สำรองที่ localhost:3100 มีสูตรคะแนนต่างจาก PRD อย่างมีนัยสำคัญ** ความพร้อมสาธิตที่สรุปก่อนหน้านี้เป็นผลของเส้นทางต้นแบบและ smoke tests

## แหล่งอ้างอิง

- [PRD ที่ผู้ใช้ระบุ](https://github.com/CE-SDPX/SDPX-AI/blob/main/project-ideas/pairwise_evaluation_prd.md) แสดง **v2.0**, อัปเดต 3 สิงหาคม 2026
- File commit ล่าสุดที่ API ของ GitHub รายงาน: `f0b8b3cd7ad58a6c6401eeb4f0954b2271fa31b0`
- SHA-256 ของไฟล์ที่อ่านรอบนี้: `4D4D2E7FAC0BFA30C3F16F313AEE0ADC58D30BD3F634ACFDEB38DA368B51567A`
- เอกสารออกแบบในโปรเจกต์อ้างไฟล์ `docs/design document/pairwise_evaluation_prd 1.md` ซึ่งระบุ **v2.1**, อัปเดต 23 สิงหาคม 2026 จึงใช้ matrix ของ v2.1 เป็นหลักฐานผ่านลิงก์ v2.0 โดยอัตโนมัติไม่ได้
- ตรวจโค้ดบน branch `codex/readiness-hardening-20261015`, baseline `1befe03` พร้อม dependency/script fixes ในเครื่อง ไม่ได้เปลี่ยน source แอปจากการเทียบรอบนี้

## ส่วนที่มีพฤติกรรมและหลักฐานทดสอบสอดคล้อง

Full System มีหลักฐานเฉพาะกรณีจากรอบ hardening สำหรับ atomic CSV, pairing/feasibility, การห้ามประเมินตนเอง, การเปลี่ยนกลุ่มผ่าน generation ใหม่, 6 ตัวเลือก, autosave/ส่งซ้ำ, weighted score, CSV/XLSX, override/Finalize/Reopen, อุทธรณ์ และการปฏิเสธสิทธิ์บางกรณี ตัวอย่างคำนวณใน `src/lib/full-system-scoring.test.ts` สอดคล้องกับ §9.5 ของลิงก์นี้

ข้อความนี้ไม่เท่ากับรับรองทุก requirement ในหมวดเหล่านั้น ส่วน Demo สำรองและ Full System มี implementation คนละชุด

## ความต่างที่ยืนยันจากโค้ด

| PRD ID / ส่วน | สิ่งที่พบจริง | ผลประเมิน |
|---|---|---|
| FR-SCORE-02/04, §9.3–9.4 | `src/lib/score-engine.ts:61` ของ Demo หารคะแนนด้วยผลรวมเฉลี่ยของทุก item; `applyCompletion` ลดคะแนนตามสัดส่วนที่ตอบโดยตรง ส่วน `src/lib/full-system-scoring.ts:17` ใช้ band mapping และ threshold 0.90 | **Demo ไม่ตรง**; Full System ตรงในกรณีสูตรที่ตรวจ |
| §3, FR-AUTHZ-01: สิทธิ์จัดการ roster | `src/app/api/full-system/classrooms/[id]/roster/import/route.ts:16` เปิดให้ OWNER/CO_TEACHER และตอบ 403 สำหรับ TA; `scripts/day3-assignment-smoke.mjs` ยังทดสอบให้ TA ถูกปฏิเสธ | **Full System ไม่ตรง role matrix** ของลิงก์นี้ |
| FR-AUTH-03 | `src/lib/full-system-auth.ts:18` ทำเพียง trim/lowercase ไม่มีการตัดจุดหรือ +tag ตามเงื่อนไขใน v2.0 | **ไม่ตรงข้อความใน v2.0**; แนวทาง exact email ของโปรเจกต์ต้องได้รับการยืนยันเป็นข้อยกเว้นหรือฉบับใหม่ ห้ามเปลี่ยนการจับคู่อีเมลโดยไม่พิจารณานโยบาย |
| FR-EXPORT-04 และสิทธิ์ Owner ใน §3 | `src/lib/full-system-score-export.ts:100` และ raw export route ปฏิเสธ identity export; ปัจจุบันมี pseudonymous export | **Owner confirmation/reveal workflow ยังไม่เสร็จ** การปิดไว้เป็นขอบเขตความเป็นส่วนตัวของต้นแบบ ไม่ใช่หลักฐานผ่าน requirement นี้ |
| FR-AUDIT-02 | `src/lib/full-system-audit.ts:77` ไม่มี IP ในข้อมูลรับเข้า และ INSERT ที่บรรทัด 88/106 ไม่ส่งค่า `ip_address` | **Audit ยังไม่ครบ field ที่กำหนด** แม้ append-only role และ intent/outcome ที่ทดสอบจะผ่าน |
| FR-SCORE-06 | `src/lib/full-system-score-job.ts:55` จำกัด environment และบรรทัด 75–77 เลือกเฉพาะห้องนักศึกษาสังเคราะห์; `vercel.json` เรียกตามตารางรายวัน UTC | **ยังไม่ผ่านครบสำหรับห้องจริง/เวลาแต่ละ classroom** การกดหรือเรียก smoke ไม่ได้พิสูจน์ automatic schedule ทั้งหมด |
| FR-PRIV-01/02/03 | หน้า staging มี acknowledgement แต่ยังระบุว่าไม่มีการลบอัตโนมัติ; ไม่พบ workflow retention/anonymization/DSAR ที่ครบตามข้อกำหนดในส่วนที่ตรวจ | **ยังไม่ครบ** notice สาธิตไม่แทน lifecycle ข้อมูลจริง |
| FR-EVAL-13 (Should) | หน้า evaluation มี autosave แต่ไม่พบ persistent client queue หรือกลไก sync หลังกลับ online | **ยังไม่มีหลักฐานรองรับ offline queue**; Demo ที่รันใน localhost ได้โดยไม่ใช้อินเทอร์เน็ตเป็นคนละความสามารถ |
| NFR-PERF / AVAIL / SCALE / COMPAT และ FR-A11Y | รอบก่อนตรวจ happy path, keyboard/radio บางกรณี และจอบางขนาด | **ยังไม่พิสูจน์ครบ** load 200 concurrent, restore/RPO/RTO, browser matrix และ a11y acceptance |

## ตัวอย่างที่ทดลองกับ scoring code จริง

ใช้ 5 กลุ่ม เกณฑ์เดียว คะแนนเต็ม 15 และทำให้ทุกกลุ่มได้ q=0.5 เท่ากัน:

| ตัวคำนวณ | คะแนนของแต่ละกลุ่ม |
|---|---:|
| Demo: `score-engine.ts` | 3/15 |
| Full System: `full-system-scoring.ts` | 12/15 |

ใช้คะแนนตั้งต้นเดียวกัน 12 และตอบ 9 จาก 10 คู่: Demo ได้ 10.8 ส่วน Full System ได้ 12 เพราะถึง threshold 90% แล้ว ทั้งสองข้อเป็นผลคำนวณจากฟังก์ชันจริง ไม่ใช่การประมาณ UI หลักฐานอยู่ที่ `.verification/prd-alignment-20261015/scoring-comparison.json`

## ประเด็นใน PRD ที่ต้องตกลงเพิ่มเติม

- OQ-8 ของ v2.0 ให้ดำเนินต่อในห้องสองกลุ่ม แต่ FR-PAIR-02 ทำให้ไม่มีนักศึกษาที่อยู่นอกคู่กลุ่มมาเป็น evaluator ระบบปัจจุบันจึงบล็อกการ publish กรณีนั้น ควรยืนยันวิธีจัดการกับอาจารย์
- State diagram ระบุการลบ pair ตอน unpublish แต่โค้ดเก็บ generation/ประวัติและตัดออกจากคะแนนปัจจุบัน แนวทางนี้มีเหตุผลด้านตรวจย้อนหลัง แต่เป็นความต่างที่ควรรับรอง
- OQ-3 กล่าวถึง auto-finalize; ยังไม่มีหลักฐานการทำงานครบในโค้ด/ผลทดสอบรอบนี้

## ข้อสรุปสำหรับการนำเสนอ

นำเสนอได้ว่า **“ต้นแบบที่ทำฟังก์ชันหลักและผ่านการทดสอบตามขอบเขตที่รายงานแล้ว”** พร้อมแสดงรายการส่วนที่ยังขาด หากอ้างอิงโจทย์ในลิงก์นี้ ควรใช้ Full System แสดงสูตรคะแนน และแจ้งชัดว่า Demo สำรองใช้สูตรอีกชุดหนึ่ง ยังไม่ควรอ้างว่า “ทำครบตาม PRD แล้ว”

ลำดับแก้ที่กระทบความตรงโจทย์มากที่สุด: (1) ตกลง baseline v2.0/v2.1 กับอาจารย์และแก้ traceability ให้ตรง, (2) ทำเส้นทางนำเสนอให้ใช้สูตร PRD ชุดเดียว, (3) ปิดช่องว่างสิทธิ์ TA/identity workflow/audit fields, (4) ทำงานอัตโนมัติและ privacy lifecycle, (5) เก็บหลักฐาน NFR/a11y ที่ยังขาด ไม่ควรให้เปอร์เซ็นต์ completion จากจำนวน smoke tests ที่ผ่าน
