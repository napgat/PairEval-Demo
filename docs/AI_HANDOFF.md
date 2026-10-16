# ให้ AI ช่วยติดตั้งและตรวจ PairEval

ให้เพื่อน clone **main** หรือแตก source ZIP ก่อน จากนั้นเปิดโฟลเดอร์โปรเจกต์ในเครื่องมือ AI และใช้ข้อความนี้:

รีโปเป็น Private เพื่อนต้องได้รับสิทธิ์ด้วยบัญชีตนเองก่อน หากยังเข้าถึงไม่ได้ ให้เจ้าของจัด source ZIP ไม่ขอ token ของเจ้าของมาใส่ใน AI

```text
Work in this standalone PairEval checkout only. Read AGENTS.md, README.md,
docs/PROJECT_STATUS.md, docs/GETTING_STARTED.md, and docs/TRY_IT.md first.

Goal: help me run and test the student prototype locally using synthetic data.
Do not touch parent/sibling/Lab repositories, submodules, remote databases,
hosting, or production data. Do not push changes or delete branches unless
I separately request that action. Preserve any existing local work and data.

1. Check Git status, Windows architecture, Node 24, and an ASCII-only path.
   Verify ports 3101, 3103 and 55432 are free or owned by this checkout's launcher.
   If another application owns them, explain the conflict; do not kill it.
2. Run npm ci, npm run build, then on Windows:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File
   .\Open-PairEval-FullSystem.ps1 -NoOpen
   (Run the launcher command on one line.)
   Wait for http://localhost:3103 and choose a synthetic role there.
   Do not request Google/Neon secrets or copy someone else's .env.
3. Verify the existing room has 16 synthetic students in 4 groups.
   Follow docs/TRY_IT.md for Owner, Co-teacher, TA and Student checks.
   If browser tools are available, actually click Group AND Individual draft,
   submit and re-submit. Report browser and API evidence separately.
4. Prepare the separate Final demo with npm run demo:prepare-final while the
   app is running. Wait its real five-minute deadline, then test Final,
   student appeal, Owner Reopen/Override/Final and appeal resolution via GUI.
   Do not edit the database clock or treat the old 16.94 example as fixed.
5. For automated checks run npm test, npm run typecheck, npm run lint.
   Install Chromium with npx playwright install chromium, then run
   npm run test:demo-ui. Report any explicitly skipped Final checks.
   This read-only browser harness does not replace the mutation workflow.
6. Stop using this checkout's Stop-PairEval-Demo.ps1, reopen and verify data
   persists. Leave the local demo open if I want to try it.
7. Return a short Thai report: tested commit/environment, actual PASS/FAIL,
   skipped steps, reproducible issues, files changed, and remaining limits.
   If you cannot control a browser, say so; never claim GUI was tested.

Fix concrete local setup or UX bugs if needed, with focused verification.
Keep secrets/session/runtime/DB/backup files out of Git and the report.
Do not broaden this into production certification or the historical Lab plan.
```

## สิ่งที่ AI ต้องรู้

- หากเพื่อนกำลังตรวจสองปัญหาที่เคยรายงาน ให้ใช้ `docs/PEER_RETEST.md` บันทึก commit และทดสอบผลจริง ห้ามล้างฐานเดิมเพื่อให้ง่ายต่อการทดสอบ
- `README.md` เป็นจุดเริ่มปัจจุบัน ไม่เริ่มจากเอกสาร SQLite หรือบันทึก v2.1 เก่า
- Full System อยู่ที่ `src/app/full-system/`, API ที่ `src/app/api/`, งานหลักที่ `src/lib/full-system-*` และ migration ที่ `db/migrations/`
- `scripts/local-database-helper.mjs` เตรียมฐาน local; `local-demo-portal.mjs` สร้างชุดสาธิตและตัวเลือกบทบาท; `prepare-final-demo.mjs` เตรียมงานปิดรับ
- แผนที่ 132 IDs คือการเชื่อมหลักฐาน ไม่ใช่ 132/132 ผ่าน และไม่ใช้จำนวน tests คิดเปอร์เซ็นต์ความครบ
- รุ่นนี้ไม่มี credential/ฐานข้อมูล/session จากผู้พัฒนาติดไปด้วย ผลการติดตั้งใหม่ต้องบันทึกเป็นหลักฐานใหม่
