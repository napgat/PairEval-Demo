# Full System — Day 01 Baseline, Gap Matrix, and Decisions

วันที่: 28 กันยายน 2026

ขอบเขต: วันที่ 1 ของ `Work Plan _ Full System.md` เท่านั้น

Project Description: `Pairwise Evaluation - Project Description 1.md`

Baseline commit: `3280f46389280ffc13e33a6add12853f0eb6e57d`

## สถานะ Git และจุดย้อนกลับ

- ก่อนเริ่ม `PairEval-Demo` สะอาดบน branch `main` และไม่มี remote
- root repository มีไฟล์แก้ค้างและ submodule status เปลี่ยนอยู่ก่อนเริ่ม งานเหล่านั้นถูกเก็บไว้ตามเดิม
- สร้าง annotated tag `demo-baseline-20260928` ที่ baseline commit
- สร้าง branch `codex/full-system-day-01` ภายใน `PairEval-Demo` เท่านั้น
- สร้าง ZIP ที่ `../tmp/PairEval-Demo-baseline-20260928-3280f46.zip`
  - 71 entries
  - มี `README.md`
  - มี `data/demo.sqlite` ที่สร้างด้วย SQLite online backup
  - SHA-256: `C4482FD06AE24FEAAADCA1412DA1615DCBADB61F674AC117341ACBF02612BD30`
- ไม่แก้ Lab 07, PR, deployment, `SDPX-AI`, `SPDX-Lab/koencontrol-sdpx_lab` หรือ submodule pointer ของ root repository

## ฐานข้อมูล Demo เดิมที่รักษาไว้

ตรวจแบบ read-only หลังจบ baseline:

| รายการ | จำนวน |
|---|---:|
| users | 26 |
| classrooms | 2 |
| groups | 5 |
| memberships | 25 |
| assignments | 2 |
| criteria | 6 |
| pair assignments | 345 |
| drafts | 0 |
| submission revisions | 39 |
| submission answers | 328 |

- `PRAGMA quick_check`: `ok`
- SHA-256 ของ `data/demo.sqlite`: `80A09A94891252DB86A62C01550B2264CCB2622336E6EAB0E17578FBA7B2B6C7`
- Last write time ของไฟล์ยังเป็น `2026-09-28 21:12:11` ตามข้อมูลก่อนงาน Full System
- ไม่รัน `seed:reset`, `demo:prepare`, `demo:answers` หรือ Main Flow ใน working Demo

## สภาพแวดล้อมทดสอบที่แยกออกมา

- detached Git worktree: `../tmp/PairEval-Demo-day1-baseline-test`
- checkout จาก tag `demo-baseline-20260928`
- ใช้ฐาน `data/demo.sqlite` ของ worktree นี้เท่านั้น
- server ทดสอบใช้ `http://localhost:3210`
- Node `v24.18.0`, npm `11.16.0`, Git `2.55.0.windows.2`

การเตรียมครั้งแรกใช้ junction ไปยัง `node_modules` ของ Demo; unit/typecheck/lint ผ่าน แต่ `next build` ปฏิเสธ symlink ที่ชี้ออกนอก project root การแก้คือถอด junction และรัน `npm ci` ใน worktree แยก จากนั้น build และ Main Flow ผ่าน ข้อผิดพลาดรอบแรกเป็นข้อจำกัดของการแยก dependency ไม่ใช่ source failure

## ผล baseline จริง

| การตรวจ | ผล |
|---|---|
| `npm test` | ผ่าน 4 files, 20/20 tests |
| `npm run typecheck` | ผ่าน |
| `npm run lint` | ผ่าน |
| `npm run build` หลังติดตั้ง dependency ภายใน worktree | ผ่าน; Next.js 16.2.10 สร้าง routes สำเร็จ |
| `npm run seed:reset` ใน worktree แยก | ผ่าน; 2 classrooms, 5 groups, 25 synthetic students, 2 assignments |
| `npm run test:main-flow` | ผ่าน 32/32 |
| `npm run test:ui-audit` | ผ่าน 36/36 |

Main Flow รอบนี้สร้างห้อง 21 คนและ pair assignments 345 รายการในฐานทดสอบ คะแนนที่สังเกตได้คือ Group `0 → 2.3800 → 4.7600` และ total หลัง Individual Submit/Re-submit `4.8030 → 4.8462` ตัวเลขเป็นผลจากข้อมูลสังเคราะห์ของรอบนี้ ไม่ใช่ค่าคงที่ใน UI

UI audit ตรวจ navigation, error/empty states, role/scope, student score isolation, CSV permission และ viewport 390px ผ่านทั้งหมด

## สิ่งที่ทำเสร็จในวันที่ 1

1. อ่าน Work Plan, Project Description 1, README, `docs/day-07.md`, `docs/demo-guide.md`, Plan - Demo และตรวจ source/API/schema/test จริง
2. สร้าง rollback tag และ ZIP ที่รวม snapshot ฐานข้อมูลเดโม
3. สร้าง branch Full System โดยไม่แตะ repository อื่น
4. สร้าง [requirements-gap-matrix.md](./requirements-gap-matrix.md) ครบ 99 IDs จากเอกสารต้นทาง:
   - มีแล้ว 53
   - ต้องแก้ 22
   - ยังไม่มี 24
   - ตรวจอัตโนมัติแล้วไม่มี ID ขาดหรือเกิน
5. เพิ่ม Non-functional requirements และกฎที่ไม่มี ID เพื่อไม่ให้ตกจากแผน
6. สร้าง [decisions.md](./decisions.md) สำหรับข้อขัดกัน 9 เรื่อง
7. สร้าง [external-dependencies.md](./external-dependencies.md) สำหรับ Google OAuth, PostgreSQL, email/notification, staging HTTPS, scheduler และ monitoring
8. รัน baseline ทั้ง unit, typecheck, lint, build, Main Flow และ UI audit ใน checkout/DB แยก

## ข้อค้นพบสำคัญ

- ฐานที่ใช้ต่อได้ดี: CSV transaction, Assignment validation, pairing coverage แบบ feasibility-first, draft/immutable revisions, latest-submission scoring, partial credit, report พื้นฐาน, student score isolation และ CSV summary
- Authentication ยังเป็น Demo account picker จึงยังใช้ข้อมูลจริงไม่ได้
- Pairing ให้ทุก combination coverage 5 เมื่อ feasible แต่ไม่ได้ให้ผู้ประเมินทุกคน 5 คู่ต่อ criterion; สองเงื่อนไขไม่สอดคล้องกันในหลายขนาดห้อง
- UI และ scoring ใช้ 6 ระดับตามตาราง §4.6.1 ขณะที่ FR-EVAL-03 เขียน 5 ระดับ
- Instructor direct score, instructor weight/vote, supplemental evaluator, re-assignment/generation/history, notification, Raw Pairs และ Excel ยังไม่มี
- Pair Coverage Report มีจำนวนตอบ/มอบหมาย แต่ยังไม่มีคะแนนสะสมต่อ pair
- Individual score ปัจจุบัน normalize ภายในแต่ละกลุ่ม ต้องให้อาจารย์รับรอง

## คำถามที่ต้องให้อาจารย์ตัดสิน

รายการเต็มพร้อมผลกระทบอยู่ใน [decisions.md](./decisions.md) หัวข้อที่เป็น gate ก่อนเขียนกติกาเต็มคือ:

1. ใช้ 5 หรือ 6 ระดับ และตารางแปลงคะแนนใด
2. ให้ coverage ≥5 หรือ workload คนละ 5 คู่ต่อ criterion มาก่อนเมื่อทำพร้อมกันไม่ได้
3. คะแนนตรงของอาจารย์รวมกับ pairwise อย่างไร
4. Instructor เห็นชื่อ evaluator ที่ใดบ้าง และ Raw Pairs ใดต้อง anonymous
5. ยืนยัน immutable revision + Re-submit revision ใหม่
6. policy ห้อง 2 กลุ่มและการเปลี่ยนกลุ่มหลัง deadline
7. เวลาเผยแพร่ Group score และขอบเขต normalization ของ Individual score

## งานวันที่ 2 ที่พร้อมเริ่ม แต่ยังไม่ได้ทำ

เมื่อเริ่มวันที่ 2 ให้ใช้ branch ปัจจุบันและทำเฉพาะ schema/migration ตาม Work Plan:

- เลือก PostgreSQL และ migration runner
- ออกแบบ User, Classroom/instructor membership, roster/group, Assignment, pair generation, draft, immutable revisions, instructor vote, notification, score projection และ history
- รองรับ migration/seed ด้วยข้อมูลสังเคราะห์บนฐานว่างและฐานที่มีข้อมูล
- เพิ่ม constraints, transaction rollback และ config แยก local/staging โดยไม่ commit secret
- เก็บ `data/demo.sqlite` และ rollback ZIP เดิมไว้สำหรับเปิด Demo baseline

ยังไม่เริ่ม schema, migration หรือ implementation ของวันที่ 2 ในงานรอบนี้

## ไฟล์ที่เปลี่ยน

- `docs/full-system/requirements-gap-matrix.md`
- `docs/full-system/decisions.md`
- `docs/full-system/external-dependencies.md`
- `docs/full-system/day-01.md`
