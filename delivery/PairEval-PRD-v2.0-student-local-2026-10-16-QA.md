# ผลตรวจชุดส่งมอบ PairEval — 16 ตุลาคม 2026

## ข้อสรุป

พร้อมนำเสนอเส้นทางหลักและ Final/อุทธรณ์ในระดับต้นแบบนักศึกษาบน local ด้วยข้อมูลสังเคราะห์ ทำงานตามแผนปิดชุดสาธิตแล้ว ไม่ใช่การรับรอง PRD/NFR ครบ 100% หรือ production readiness

- ชุดที่เปิดใช้อยู่: `E:\PairEval-Professor-Review-20261016`
- ทดลองเลือกบทบาท: <http://localhost:3103>
- คู่มือ: `docs/full-system/student-local-delivery-2026-10-16.md` ใน ZIP และสำเนาใน repo เดิม
- Base: `codex/prd-v2-implementation` commit `2df5420d0dc7d1a001c2e5726df4b61b27e9e97a` ตาม PRD v2.0/132 IDs
- Archive: `PairEval-PRD-v2.0-student-local-2026-10-16.zip` (333 files, 872485 bytes)
- SHA-256: `f710856e85419c44281851979e818a0a4f12971c01af11887e86d4421f007e37`

ณ checkpoint การตรวจ ZIP ยังไม่มีการ commit/push/deploy ไม่ merge โค้ด local v2.1 เดิม และไม่แตะ root repo, Lab, submodule, Neon หรือ SQLite Demo เดิม ZIP เก่าสองรายการยังอยู่ตามเดิม

## สิ่งที่เพิ่มจาก checkpoint ก่อนหน้า

1. `npm run demo:prepare-final` สร้างงานแยกชื่อ `ตัวอย่างปิดงาน · คะแนนและอุทธรณ์` โดย API จริงและข้อมูลสังเคราะห์ 16 คน กำหนด deadline เวลาปัจจุบัน +5 นาทีจริง ไม่แก้เวลาฐานข้อมูล
2. ใช้ advisory lock และ state marker; รันซ้ำแล้วไม่สร้างงาน/คำตอบ/snapshot เพิ่มหรือ reset งาน Final ตรวจทั้งฐานเดิมและฐานใหม่
3. ปฏิเสธ environment production และ database host ที่ไม่ใช่ local ก่อนเชื่อมต่อ ทดสอบการปฏิเสธผ่าน child process แล้ว
4. คู่มือ 15–20 นาทีแยกงานฝึกประเมินกับงาน Final ชัดเจน และ README เริ่มต้นที่ Full System โดยไม่สั่ง SQLite seed
5. Source ZIP มี base provenance, รายชื่อไฟล์แก้/เพิ่ม, SHA-256 รายไฟล์ และตัวอย่างหลักฐานปลอดรหัสลับ แยกไฟล์ที่ต่างเฉพาะ LF/CRLF ออกจากการแก้เนื้อหา

## ผลตรวจ

| หัวข้อ | ผล |
|---|---|
| Unit tests | 88/88 ผ่าน; lint และ typecheck ผ่าน |
| Final GUI | Owner Final หลัง deadline จริง → นักศึกษาเห็น 16.44 → ยื่นอุทธรณ์ → Owner Reopen พร้อมเหตุผล → Override รายบุคคล 4.50 → Final ฉบับใหม่ → ตอบอุทธรณ์ → นักศึกษาเห็น 16.94 และ RESOLVED |
| การยืนยันรอบแรก | Automation ค้างที่ confirm และผู้ใช้ช่วยปลดกล่อง; บันทึก Final สำเร็จหลัง deadline รอบ Final ฉบับใหม่ automation click/Enter เองสำเร็จ |
| สิทธิ์ | ผู้สอนร่วมไม่มีปุ่ม Final/Reopen ใน GUI; metadata Owner=true/co=false; TA อ่านรายงานไม่ได้ (404); Owner Final งานหลักก่อน deadline ได้ 409 และไม่สร้าง snapshot |
| คะแนน/CSV/XLSX | คำนวณอิสระจาก snapshot inputs ครบ 16 คน; ทุกแถวตรง CSV/XLSX, 4 sheets; 12.44+4.50=16.94, M=1, ส่ง 5/5 |
| ประวัติ | Snapshot 1 Interim → 2 Final → 3 Interim → 4 Final; ทุก field ของ Final #2 เหมือนก่อน Reopen; revision งานหลัก 1/2 ทั้งสองด้านยังอยู่ |
| Audit | ค้างส่ง 0 หลังตรวจและหลังเปิดใหม่ |
| ZIP ใหม่ | แตกไป `E:\PairEval-Delivery-Check-20261016` โดยไม่มี env/DB/node_modules เดิม; SHA-256 ทุกไฟล์ตรง; npm ci และ production build ผ่าน |
| ฐานใหม่ | ตัวเปิดสร้าง operational/audit ใหม่ migrations 001–019; 19 synthetic users; IDs ต่างจากฐานเดิม; prepare-final ได้ 32 submissions และ 1 Interim snapshot |
| GUI จาก ZIP | เปิด Owner/ห้อง/งาน/รายงานได้จริง; click/Enter Final ก่อน deadline แสดง `Wait until both deadlines have passed`; Final count ยัง 0 |
| กลับมาชุดเดิม | ปิดบริการ fresh ZIP แล้วเปิดชุดเดิม; ตรวจสูตร/ไฟล์/history ซ้ำผ่าน และ GUI นักศึกษายังแสดง Final 16.94/RESOLVED |

ชุดตรวจ API/browser PRD 41/41, Axe 7 หน้า และ backup/restore มีผลตาม checkpoint readiness เดิม ไม่ได้รันทั้งชุดซ้ำเพียงเพื่อสร้าง ZIP; รอบนี้เพิ่มการตรวจที่ปิดความเสี่ยง Final/อุทธรณ์ การเปิดจาก source ใหม่ และ persistence

ฐานใหม่สร้าง UUID ใหม่ ทำให้การกระจายคู่/คำตอบและคะแนนตัวอย่างอาจต่างจาก 16.94 ในฐานที่ซ้อมไว้ ตัวเลข 16.94 เป็นหลักฐานของ fixture ที่ตรวจบนเครื่องนี้ ไม่ใช่ค่าฝังในระบบ

## ข้อจำกัด

- `npm audit --omit=dev`: high 0, critical 0, moderate 2 (exceljs/uuid)
- ตรวจรวมเครื่องมือพัฒนา: high 5 จากสาย eslint-config-next/fast-glob/micromatch/braces, moderate 2 ไม่ได้อ้างว่าทุก dependency ปราศจากช่องโหว่ และไม่ใช้การ force-upgrade ข้ามรุ่นในชุดที่ตรึงแล้ว
- ไม่ได้ทดสอบ Google login จริง, staging/deployment, load ผู้ใช้จริง, screen reader ทุกหน้า หรือ recovery นอกเครื่อง รอบทดสอบโหลดเดิมมีเป้าหมายบางค่าไม่ผ่านตาม readiness
- ข้อมูลสังเคราะห์และตัวเลือกบทบาทใช้สาธิตบน loopback เท่านั้น ZIP ไม่มี `.env.local`, `.verification`, session state, database, backup/key, node_modules หรือ `.next`
- โค้ดใน working tree เดิมไม่ได้ถูกแทนที่ หากจะนำรุ่นนี้กลับเข้า branch เดิม ต้องจัดรวม migrations ที่เลขชนกันและงานค้างแยกต่างหาก

## หลักฐานในเครื่อง

`E:\PairEval-Professor-Review-20261016\.verification\review-20261016\`

- `final-numeric-results.json`, `final-role-guards.json`, `final-before.json`
- `final-individual.csv`, `final-report.xlsx`
- `delivery-fresh-install.json`, `delivery-production-audit.json`, `delivery-all-audit.json`
- `student-final-after-restart.png`, `fresh-install-deadline-guard.png`
- `numeric-results.json` ตรวจงานหลัก/revision เดิมหลัง restart

ไม่แชร์ `presentation-state.json` หรือ env เพราะมี credentials/session tokens
