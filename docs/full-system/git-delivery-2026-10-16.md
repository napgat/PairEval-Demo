# บันทึกจัดรุ่นส่งมอบเข้า Git — 16 ตุลาคม 2026

## รุ่นที่ใช้

ใช้สาขา `codex/prd-v2-implementation` ต่อจาก base `2df5420d0dc7d1a001c2e5726df4b61b27e9e97a` ตาม PRD v2.0 ของอาจารย์ งานรอบนี้นำ source ที่ทดสอบผ่านจาก ZIP ส่งมอบมาใส่ใน checkout แยก `E:\PairEval-Commit-20261016` ไม่รวมงานค้าง v2.1 จาก working tree เดิม ไม่เปลี่ยนสาขาหรือไฟล์ในโฟลเดอร์เดิม

## การเปลี่ยนแปลง

- เพิ่มคำสั่ง `demo:prepare-final` สำหรับงาน Final/อุทธรณ์สังเคราะห์แยก ใช้ deadline จริงอีก 5 นาที มี lock/marker และรันซ้ำแล้วไม่ reset ข้อมูล
- ปรับข้อความเมื่อส่งคำตอบครบและสีข้อความตัวเลือกที่เลือกแล้ว
- เพิ่ม capability ฝั่ง server และแสดง Final/Reopen เฉพาะ Owner ใน UI โดยคง authorization ของ mutation เดิม
- เพิ่มคู่มือ 15–20 นาที หลักฐาน GUI/ตัวเลข และผลตรวจ ZIP ติดตั้งใหม่
- แก้ลิงก์ patch ใน readiness ให้ชี้ไฟล์ที่อยู่ใน Git ได้จริง

## หลักฐานที่ใช้ก่อนส่งเข้า Git

- Unit tests 88/88, lint, typecheck และ production build ผ่าน
- คลิก Final → อุทธรณ์ → Reopen → Override → Final ฉบับใหม่ → ตอบอุทธรณ์สำเร็จ คะแนน 16.44 → 16.94 ตรง CSV/XLSX และสูตรตรวจแยกครบ 16 คน
- Final เดิมไม่เปลี่ยน; audit ค้าง 0; ปิด–เปิดแล้วคะแนน/revisions/อุทธรณ์คงอยู่
- แตก ZIP ไปโฟลเดอร์ใหม่โดยไม่มี env/DB เดิม: npm ci/build/open ผ่าน เตรียม Final ได้ 32 submissions; คำสั่งซ้ำไม่เพิ่มข้อมูล; GUI ปฏิเสธ Final ก่อน deadline
- ไม่ต้องรันทดสอบฐานข้อมูลทั้งชุดซ้ำเพื่อ commit เพราะ source ที่นำเข้าตรงกับ artifact ที่ตรวจแล้ว ตรวจ Git diff, whitespace และการไม่มี secret ก่อน commit/push อีกครั้ง

รายละเอียดอยู่ใน [คู่มือ](student-local-delivery-2026-10-16.md), [ผลตรวจชุดส่งมอบ](../../delivery/PairEval-PRD-v2.0-student-local-2026-10-16-QA.md) และ [หลักฐานตัวเลข](delivery-evidence-20261016/final-numeric-results.json)

## Source กับ ZIP

`RELEASE-PROVENANCE.json` และ `SHA256SUMS.txt` เป็นข้อมูลอ้างอิง **เนื้อหา ZIP ที่ตรึงไว้** ไม่ใช่รายการ checksum ของ Git checkout ทุกแพลตฟอร์ม ซึ่งอาจใช้ LF/CRLF ต่างกัน และมีเอกสาร Git เพิ่มหลังตรวจ ZIP

ZIP SHA-256: `f710856e85419c44281851979e818a0a4f12971c01af11887e86d4421f007e37`

ZIP เก็บในเครื่องตาม `.gitignore` (`delivery/*.zip`) ไม่ force-add ไฟล์ ZIP เข้า Git; source, คู่มือ, หลักฐานสังเคราะห์ และ checksum อยู่ใน commit สามารถ clone source มาติดตั้งตามคู่มือได้ ไม่รวม env, session state, database, backup/key, node_modules หรือ build cache

## ข้อจำกัด

ส่งมอบเป็นต้นแบบนักศึกษาสำหรับ local ไม่อ้าง PRD/NFR 100% การ push ไม่ได้ยืนยันว่า CI หรือ deployment รุ่นนี้ผ่านและไม่มีการสั่ง deploy รอบนี้ Production dependency audit ไม่มี high/critical แต่มี moderate 2; เมื่อนับเครื่องมือพัฒนาด้วยมี high 5 ตามผลตรวจเดิม ยังไม่ได้ทดสอบ OAuth จริง โหลดผู้ใช้จริง screen reader ครบชุด หรือ recovery นอกเครื่อง

หากจะย้ายเข้าสู่ฐานเดิม ต้องจัดรวม migrations 013–015 ที่เลขชนกันระหว่างสองสายงานก่อน ห้าม copy migration ลง Neon เดิมโดยตรง
