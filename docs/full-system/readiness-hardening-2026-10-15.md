# PairEval: แก้ dependency และทดสอบความพร้อมซ้ำ

วันที่: 15 ตุลาคม 2026 (Asia/Bangkok)

**พร้อมสาธิตฟังก์ชันหลักบนโน้ตบุ๊กเครื่องนี้แล้ว** ผลด้านล่างมาจากโค้ดที่แก้จริงและสคริปต์ใน `scripts/` โดยตรง เว็บ staging ออนไลน์ยังไม่ได้ deploy การแก้รอบนี้ และการซ้อม Google login ด้วยบัญชีที่จะใช้จริงยังเป็นขั้นตอนก่อนนำเสนอออนไลน์

## สถานะ P0 / P1

- P0 รอบนี้เสร็จ: แก้ High สองรายการใน production dependencies, แก้ selector ที่ตาม UI ภาษาไทยไม่ทัน, แก้ migration rehearsal และทดสอบซ้ำ
- เรื่องค้างที่แยกติดตาม: High 5 รายการใน dependency chain ของเครื่องมือ lint และ Moderate 2 รายการใน ExcelJS/uuid; ขอบเขต production/PRD เต็มและบัญชีจริงไม่ได้รับรองจาก smoke tests

## สิ่งที่เปลี่ยน

- อัปเดตและ pin `next` กับ `eslint-config-next` เป็น **16.3.8** พร้อม lockfile
- อัปเดต `source-map-js` ใน lockfile เป็น **1.2.2** และ dependency ย่อยที่แก้ได้ภายในช่วงรุ่นเดิม โดยไม่ใช้ `npm audit fix --force`
- แก้ `day3-assignment-smoke.mjs`: เลือกงานพร้อมตรวจสถานะฉบับร่าง เปิดแผงจัดการรายชื่อที่พับไว้ แล้วใช้ชื่อ CSV/ปุ่มตรวจข้อมูลปัจจุบัน
- แก้ `day5-score-smoke.mjs`: ชื่อแท็บและสถานะภาษาไทย รวมถึง UI ถอนสมาชิกใน conditional smoke; ยังตรวจ snapshot รุ่นเดิม สูตรคะแนน สิทธิ์ และประวัติครบ
- แก้ `day7-instructor-smoke.mjs`: เลือกงานพร้อมตรวจสถานะกำลังเปิดรับ
- แก้ `staging-demo-notice-smoke.mjs` และ `post-day7-quality-smoke.mjs`: ใช้ heading/ปุ่ม/แท็บปัจจุบัน
- แก้ `day7-migration-rehearsal.mjs`: อ่าน migration ที่มีจริงทั้งหมด และตรวจลำดับต่อเนื่องเริ่มจาก 001 แทนการจำกัดไว้ 9 ไฟล์

ไม่ได้แก้สูตรคะแนนหรือหน้าจอของแอป ไม่ได้ลด assertion เพื่อให้ทดสอบผ่าน และไม่ได้แก้ root submodule, Lab หรือข้อมูล staging

## ผลหลังติดตั้งจาก lockfile ใหม่

| การตรวจ | ผลจริง |
|---|---|
| `npm ci` | ผ่าน |
| `npm audit --omit=dev --audit-level=high` | ผ่าน, exit 0; **0 High / 0 Critical**, ยังมี Moderate 2 packages |
| Audit รวม development dependencies | **5 High / 2 Moderate / 0 Critical**, ลดจาก 10 High ก่อนแก้ |
| `npm test` | **82/82 ผ่าน**, 20 files |
| Vitest `scripts/audit-integrity-core.test.mjs` | **2/2 ผ่าน** |
| `npm run typecheck` / `npm run lint` / `npm run build` | ผ่านทั้งสาม; production build ใช้ Next.js 16.3.8 |
| `npm run test:main-flow` จาก seed ใหม่ | **32/32 ผ่าน** |
| `npm run test:ui-audit` | **36/36 ผ่าน** |
| Full System สคริปต์จริง 10 ชุดด้านล่าง | **10/10 ชุด exit 0** |
| `git diff --check` | ผ่าน |

Full System ทดสอบแบบเรียงลำดับบน PostgreSQL แยกในเครื่อง ด้วยข้อมูลสังเคราะห์:

```text
node scripts/day3-assignment-smoke.mjs development
node scripts/day4-evaluation-smoke.mjs development
node scripts/day5-score-smoke.mjs development
node scripts/post-day7-withdrawal-smoke.mjs development
node scripts/day7-instructor-smoke.mjs development
node scripts/staging-demo-notice-smoke.mjs development
node scripts/post-day7-quality-smoke.mjs development
node scripts/day7-migration-rehearsal.mjs development
node scripts/audit-smoke.mjs development
node scripts/day2-audit-outcome-verify.mjs development
```

ผลครอบคลุม publish/เปลี่ยนกลุ่ม/ลด coverage, autosave/refresh/ส่งซ้ำ, คะแนน/CSV/XLSX, override/Finalize/Reopen/อุทธรณ์, การตัดและคืนคำตอบ, การถอนสมาชิกและรักษาประวัติ, extra evaluator/น้ำหนักผู้สอน, notice gate และ QS-05–07 โดยสคริปต์ที่เดิมติดชื่อปุ่มสามารถทำงานจากไฟล์จริงได้แล้ว

Migration rehearsal ใช้ **12 migrations / 30 tables**, rollback schema ทดสอบแล้วไม่เหลือ schema นั้น Audit ตรวจท้ายชุดพบ 157 committed / 2 rejected ที่เก็บไว้เป็นประวัติ / **0 pending** และไม่มี fixture ที่ verifier ตรวจนับค้างอยู่ ค่าเหล่านี้เป็นยอดสะสมของฐานตรวจในเครื่อง ไม่ใช่ยอด staging และไม่ใช่ full backup/restore acceptance

## ข้อจำกัดของผล audit

High ที่คงเหลือเป็น `braces` และ dependency chain `micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next` ใน development dependencies รายงานปัจจุบันครอบคลุม braces ถึง 3.0.3 และเสนอ downgrade `eslint-config-next` แบบข้าม major ผ่าน `--force` จึงไม่ทำในขอบเขตแก้ runtime dependencies รอบนี้

Moderate สอง packages คือ `uuid` และ `exceljs` จาก advisory เดียวกัน วิธีแก้ที่ npm เสนอคือ downgrade ExcelJS ข้าม major ไม่ได้ทำในรอบนี้ ผลจึงไม่ใช่ “ปลอด advisory ทั้งหมด” แต่ด่าน audit สำหรับ High/Critical ของ production ผ่านแล้ว

## ชุดนำเสนอและการส่งกลับเครื่องพัฒนา

- ทำงานบน branch `codex/readiness-hardening-20261015` ของสำเนาแยก `D:\PairEval-Review-20261015`, เริ่มจาก staging commit `1befe03`
- เก็บฐาน Demo ก่อนทดสอบ แล้วคืนชุดนั้นหลัง Main Flow จึงยังมีห้องเริ่มต้นพร้อม 345 คู่และคำตอบเพื่อน 39 revisions / 328 answers โดยเว้น `student-01@demo.invalid` ให้ผู้สาธิตกดเอง
- ใช้ `Open-PairEval-Demo.cmd` หรือ <http://localhost:3100> สำหรับ Demo สำรอง ฟีเจอร์ Full System ที่เพิ่มจาก Demo ต้องแสดงผ่านสภาพแวดล้อม Full System ที่ตั้งค่าไว้
- ผลและ log รอบนี้อยู่ใน `.verification/hardening-20261015/`; มี audit ก่อน/หลังและผล Full System ทุกสคริปต์
- Patch สำหรับย้ายการแก้ source กลับเครื่องพัฒนา: `delivery/PairEval-readiness-hardening-20261015.patch` (ไม่รวม secrets, DB หรือ dependencies ที่ติดตั้ง)
- ยังไม่ได้ commit, push หรือ deploy การแก้เหล่านี้ เว็บออนไลน์จึงยังใช้ release เดิมจนกว่าจะนำการแก้นี้ไป deploy

ก่อนแสดงออนไลน์: ซ้อมบัญชี Google ของผู้สอน/นักศึกษาจริงบนโน้ตบุ๊กหนึ่งรอบ และเตรียมลิงก์ผลงาน A/B หากต้องการเปิดเอกสารให้ดู การผ่าน fixture ในเครื่องไม่ได้แทนการตรวจบัญชีหรือไฟล์จริงนั้น
