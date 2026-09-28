# Full System — Day 01 execution record

**วัน/ช่วงงาน:** 28–29 กันยายน 2026; งานในแผน Full System เฉพาะ Day 1  
**ผลรวม:** **Day 1 ไม่ผ่านครบทุก gate** เพราะยังไม่มี Google OAuth staging client ที่ลงทะเบียน redirect URI/secret แยก และยังไม่มี audit storage แยกที่ provision แล้ว. GitHub, CI, Vercel staging, Neon development/staging และ PostgreSQL smoke ผ่านจริง. ยังไม่ใช่ Full System หรือ production ready.

## ขอบเขตและสภาพก่อนแก้

อ่าน `AGENTS.md`, `README.md`, `docs/day-07.md` (log ล่าสุด), `Work Plan _ Full System.md`, PRD v2.1, `12_Traceability Matrix.md`, `13_Decisions Needed.md`, `07_API Contract_ส่วนใดเรียกส่งข้อมูล.md` และ `15_PRD v2.1 Errata Proposal.md`; ตรวจ source, tests, API, schema และ Git status ก่อนแก้. `PairEval-Demo` เป็น Git repo อิสระ. ก่อนงานรอบนี้มีไฟล์ที่แก้ค้าง `docs/day-07.md`, `docs/full-system/decisions.md`, `docs/full-system/requirements-gap-matrix.md` และ design documents ที่ยังไม่ tracked; เก็บการแก้ค้างสามไฟล์แรกไว้โดยไม่ stage หรือทับ. Design documents 20 ไฟล์ถูก commit verbatim เป็นแหล่ง PRD/traceability ของงานนี้. ไม่แก้/commit/push root repository, submodule หรือ Lab repository.

### SQLite Demo baseline ที่ย้อนกลับได้

- Tag `demo-baseline-20260928` ชี้ commit `3280f46`. ZIP `../tmp/PairEval-Demo-baseline-20260928-3280f46.zip` มี SQLite online backup; SHA-256 ของ ZIP `C4482FD06AE24FEAAADCA1412DA1615DCBADB61F674AC117341ACBF02612BD30`.
- `data/demo.sqlite` เดิม SHA-256 `80A09A94891252DB86A62C01550B2264CCB2622336E6AB0E17578FBA7B2B6C7` ทั้งก่อนและหลังตรวจ. ไม่ reset/overwrite ฐานเดิม. ใช้สำเนาใน `.verification/day1` (ignored) สำหรับ seed และ Main Flow.
- ข้อมูลเดิมตรวจแบบ read-only: users 26, classrooms 2, groups 5, memberships 25, assignments 2, criteria 6, pair assignments 345, revisions 39, answers 328; `PRAGMA quick_check=ok`.

| การตรวจ baseline ในสำเนา | ผลจริง |
|---|---|
| `npm ci --offline` | ผ่านในสำเนาแยก |
| `npm test` | ผ่าน 4 files, **20/20** tests |
| `npm run typecheck` | ผ่าน |
| `npm run lint` | ผ่าน |
| `npm run build` | ผ่าน, Next.js 16.2.10 |
| `npm run seed:reset` | ผ่านเฉพาะสำเนาฐานข้อมูลสังเคราะห์ |
| `npm run test:main-flow` บน `localhost:3211` | ผ่าน **32/32**; Group `0 → 2.9334 → 5.8400`, total `5.8812 → 5.9223` ใน fixture รอบนี้ |
| `npm run test:ui-audit` | ผ่าน **36/36** |

ผล Demo เป็นหลักฐาน baseline เท่านั้น; **ไม่ยกเป็นผลผ่าน PRD v2.1 ของ Full System**. SQLite pages ยังไม่ได้ย้ายไป PostgreSQL และยังไม่ได้ทดสอบบน Vercel.

## งานที่เปลี่ยนและ PRD IDs

| งาน / ID | สิ่งที่ทำและสถานะ |
|---|---|
| 188 PRD IDs | `prd-v2.1-execution-matrix.md` สร้างจาก Traceability Matrix ตรวจ unique IDs และบรรทัด PRD: **188/188**. ทุกแถวมี owner, priority, status, location, evidence, dependent decision. **185 not started, 3 in progress, 0 tested**; ไม่มี Demo behavior ที่นับผ่านอัตโนมัติ. |
| `DR-04`, `DR-05` | `db/migrations/001_initial.sql`, runner `scripts/full-system-db.mjs`, synthetic marker/DB probe และ `src/lib/full-system-postgres.ts`. Migration ขั้นต้น apply บน Neon dev/staging แล้ว; ยังไม่ใช่ schema/acceptance test ครบตาม DR. |
| `DR-09`, `FR-AUDIT-01` | `db/audit/001_audit.sql` และ `audit-storage-plan.md` วางแบบฐานแยก, runtime role `SELECT/INSERT` เท่านั้นและ integrity test. **ยังไม่ provision audit database/role และยังไม่ทดสอบสิทธิ์**. |
| `FR-AUTH*`, `FR-AUTHZ*` | ตกลง route ใน draft contract เป็น `GET /api/auth/oidc/callback`; บันทึก URI ใน `oauth-redirects.md`. ยังไม่มี implementation/login test. |
| API/decision/errata | ทบทวน OQ-1–8, DQ-09–14, DQ-11 field contract และ E-01–E-07. ยังคง PRD v2.1 ต้นฉบับและเลขอ้างอิงเดิม; ข้อเสนอไม่ได้กลายเป็น policy approval. |

เพิ่ม `.github/workflows/ci.yml`, `.env.example` ที่มีเฉพาะชื่อ placeholder/URI local ที่ไม่ลับ, ignored `.env.local` และ `.env.staging.local`, endpoint `POST /api/full-system/db-smoke` ที่ต้องมี bearer token และ `PAIR_EVAL_ENV=staging`. Endpoint เขียน/อ่าน/ลบ UUID ใน transaction และตรวจ synthetic seed marker โดยไม่แตะตาราง Demo. เพิ่ม host guard ให้ DB CLI เพื่อกันสลับ dev/staging. `.verification/` ถูก ignore ทั้ง Git และ ESLint.

Commits ของงานนี้บน repo อิสระ: `c86c132` (foundation) และ `9744e53` (host guard/evidence). Branch `staging` ที่ push ขณะตรวจ Vercel ชี้ `9744e53`; branch ทำงาน `codex/full-system-day-01`. ไฟล์ local เดิมที่แก้ค้างไม่ได้รวมใน commits เหล่านี้.

## GitHub, Vercel, Neon และหลักฐาน staging

- Private GitHub repository: <https://github.com/napgat/PairEval-Demo>. `main` เก็บ Demo baseline; `staging` เป็นแหล่ง Vercel production environment ของ **โปรเจ็กต์ staging เฉพาะนี้**. Vercel GitHub App ได้รับสิทธิ์กับ `napgat/PairEval-Demo` เพิ่ม โดยคงสองรีโปที่ App มีสิทธิ์ก่อนหน้าไว้ตามการอนุมัติของผู้ใช้; ไม่มีการแก้/ผลักไฟล์ในสองรีโปนั้น.
- GitHub CI: [run #1](https://github.com/napgat/PairEval-Demo/actions/runs/36461181892) ผ่าน 1m35s; [run #2](https://github.com/napgat/PairEval-Demo/actions/runs/36463444553) บน `staging` commit `9744e53` ผ่าน 1m32s. Workflow รัน test/typecheck/lint/build/matrix check/Main Flow/UI audit บน fixture CI.
- Vercel project: <https://vercel.com/npaha/paireval-full-staging>; stable URL: <https://paireval-full-staging.vercel.app>. การ import ครั้งแรก deploy `main` `3280f46` ตาม Vercel UI; หลังได้รับอนุมัติจึงเปลี่ยน branch tracking เป็น `staging` และ push commit ใหม่. หน้า Overview แสดง Production Deployment **Ready**, source `staging` `9744e53`. ไม่ถือว่า SQLite UI บน Vercel ใช้งานได้.
- Neon operational development: <https://console.neon.tech/app/projects/small-boat-41925790>; operational staging: <https://console.neon.tech/app/projects/twilight-thunder-82282882>. เป็น **คนละ project/endpoint**; ไม่ใช้ Neon/Lab project เดิม. Migration `001_initial` apply, synthetic seed upsert และ write/read/delete smoke ผ่านทั้งสองฐาน. ตอนรับ development URL รอบแรก browser clipboard ไม่ sync กับ OS clipboard; ตรวจพบ endpoint ผิดก่อนอ้างผล dev, แก้ `.env.local` ให้ใช้ endpoint dev จริงและเพิ่ม host guard แล้วจึงรัน migration/seed/smoke ใหม่. ไม่ใช้ข้อมูลจริง.
- Vercel Environment Variables (Production ของ staging project): `DATABASE_URL` (Neon staging), `PAIR_EVAL_ENV=staging`, `DB_SMOKE_TOKEN`, `GOOGLE_REDIRECT_URI` (เพิ่มหลัง deployment `9744e53`; ต้อง redeploy จึงมีผลต่อ runtime). ไม่พิมพ์ค่า secret ใน log หรือ Git.

| คำสั่ง/คำขอ | ผลจริง |
|---|---|
| `PAIR_EVAL_CONFIG=.env.staging.local; npm run db:migrate`, `db:seed`, `db:smoke` | ผ่าน; staging migration applied, synthetic marker และ write/read/delete ผ่าน |
| `npm run db:migrate`, `db:seed`, `db:smoke` ด้วย `.env.local` | ผ่าน; development migration applied, synthetic marker และ write/read/delete ผ่านหลังตรวจ endpoint |
| `GET https://paireval-full-staging.vercel.app/api/health` | `200`, `{"status":"ok"}` |
| `POST https://paireval-full-staging.vercel.app/api/full-system/db-smoke` พร้อม token | `200`, `{"status":"ok","database":"postgresql","writeReadDelete":true,"marker":"synthetic-day-01"}` |
| `POST` endpoint เดียวกันโดยไม่มี token | `404` |
| `npm test` ใน working repo | ผ่าน 8 files, **40/40** tests |
| `npm run typecheck`, `npm run lint` | ผ่านหลัง ignore `.verification/` ใน ESLint; lint รอบแรกพบไฟล์ dependency ของสำเนา baseline 3,990 problems ก่อนแก้ ignore |

`pg` แสดงคำเตือนว่า `sslmode=require` จะเปลี่ยน semantics ใน major version ถัดไป; การเชื่อมต่อปัจจุบันผ่าน. ก่อนอัปเกรด `pg` ต้องกำหนด SSL mode ที่รักษาการตรวจ certificate และทดสอบใหม่.

## OAuth และ decision/external gates ที่ค้าง

- **OAuth callback:** URI local ที่ Google Cloud `PairEval Local` client ลงทะเบียนแล้วคือ `http://localhost:3000/api/auth/oidc/callback` (origin `http://localhost:3000`). URI staging ที่ต้องลงทะเบียนกับ client แยกคือ `https://paireval-full-staging.vercel.app/api/auth/oidc/callback` (origin `https://paireval-full-staging.vercel.app`). Vercel เก็บ staging redirect URI แล้ว แต่ **ยังไม่มี dedicated staging Google client/secret และไม่ได้ทดสอบ login**. `.env.local` มี local client ID แต่ secret ยังว่าง. Client `PairEval Web` เดิมมี Lab redirect; ห้ามใช้ร่วม. การสร้าง/เปลี่ยน credential ใน browser ต้องให้เจ้าของบัญชีทำขั้นตอนสุดท้ายตามข้อกำหนด handoff ของเครื่องมือ.
- **Audit:** ต้อง provision audit storage แยก dev/staging, role ที่ไม่มี UPDATE/DELETE, integrity/retention/backup และทดสอบ denial จริงก่อนปิด `DR-09`.
- **Policy:** OQ-1/2/4/7 และ E-01–E-07 ต้องให้เจ้าของคะแนน/ทะเบียน/ผู้สอนรับรองก่อนใช้คะแนนจริง; OQ-6 ต้องให้ Privacy Officer ตัดสินการเก็บ time-on-task ของคนจริง. DQ-09/10/12/13 เป็นข้อสรุปเพื่อพัฒนาด้วยข้อมูลสังเคราะห์; ยังไม่เปลี่ยน PRD v2.1. DQ-11 ยังต้อง review field/permission, endpoint ที่ขาดและ contract tests. DQ-14 ต้องมีผู้ให้บริการ artifact และ access policy ที่อนุมัติ. ช่องทาง notification, test Google account, session secret และ privacy/security review ยังไม่พร้อมสำหรับ end-to-end/ข้อมูลจริง.
- **Milestone:** ไม่มี FR-AUTHZ, FR-ANON-01 หรือ FR-AUDIT-01 ที่ผ่าน acceptance test แล้ว. Main Flow ของ Demo และ database smoke พิสูจน์เพียงฐานและ connectivity; S1–S10 ของ Full System ยังไม่ผ่าน.

## Day 2: งาน P0 ถัดไป (1–3 ข้อ)

1. ให้เจ้าของ Google Cloud สร้าง **PairEval Staging OAuth client แยก** และลงทะเบียน origin/redirect URI ข้างต้น, เก็บ ID/secret ใน Vercel, เติม local secret ผ่านช่องทางปลอดภัย, redeploy แล้ว implement/test OIDC callback, session, domain/role/scope บน local และ staging ด้วยบัญชีทดสอบ.
2. ย้าย data access ของ identity/classroom/roster และ FS-00–FS-04/FS-19 จาก SQLite ไป PostgreSQL; เพิ่ม migration/seed ที่รันซ้ำได้, server-side authorization, privacy notice และ CSV atomic import พร้อม tests ข้ามห้อง/rollback. ห้ามอ้างว่า Demo UI ที่ Vercel ผ่านก่อนย้ายและทดสอบ.
3. Provision audit database แยกสำหรับ dev/staging, non-owner append-only runtime role และ `AUDIT_DATABASE_URL`; ทดสอบ denial ของ UPDATE/DELETE, integrity และ critical-action failure policy ด้วยข้อมูลสังเคราะห์. ขอ policy/ผู้รับรองที่ยังค้างใน Decisions Needed โดยไม่แก้ PRD v2.1 เงียบ ๆ.
