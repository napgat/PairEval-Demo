# วัน/ช่วงงาน: วันที่ 1 — 28 กันยายน 2026

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | หลักฐาน/ขอบเขตปัจจุบัน |
|---|---|---|
| Demo role selection และ navigation | เสร็จสำหรับวันที่ 1 | เลือกผู้สอน/นักศึกษาและเปิดหน้าจอหลักได้ แต่ยังไม่มี auth หรือการบังคับสิทธิ์จริง |
| Classroom/roster | กำลังทำ | อ่านข้อมูล seed ได้; การสร้างและ CSV import ยังไม่เริ่ม (วันที่ 2) |
| Assignment | กำลังทำ | แสดงงาน/criteria/deadline จาก SQLite ได้; ฟอร์มและ validation ยังไม่เริ่ม (วันที่ 2) |
| Pairing Group/Individual | ยังไม่เริ่ม | เตรียมชุดข้อมูล feasible/infeasible และหน้าสถานะ (วันที่ 3) |
| Evaluation Save/Submit/Re-submit | ยังไม่เริ่ม | หน้าว่างพร้อมป้ายสถานะ (วันที่ 4) |
| Scoring/Report/My score/CSV | ยังไม่เริ่ม | หน้าว่างพร้อมป้ายสถานะ ไม่มีคะแนน hard-coded (วันที่ 5) |
| P1 ทุกส่วน | ยังไม่เริ่ม | หน้ารวมแสดง “ยังไม่เปิดใช้งานใน Demo” |

## สิ่งที่เปลี่ยน

- สร้าง Git repository อิสระ `PairEval-Demo` ภายใน SDPX ไม่มี remote ไม่แตะ submodule Lab
- นำโครง `package.json`, lockfile, TypeScript/Next/ESLint/PostCSS config และ health route จาก branch `main` ของ Lab commit `c1f0573` มาใช้เป็นฐานโดยอ่านจาก Git เท่านั้น
- เพิ่ม `scripts/seed.mjs` สำหรับ SQLite และ `data/demo.sqlite` ที่รีเซ็ตได้; seed มีผู้สอน 1, นักศึกษา 25, ห้อง 2, กลุ่ม 5, งาน 2, criteria 6; ตารางคู่และ submission ว่าง
- เพิ่มหน้าเลือกบทบาท หน้า instructor/student และ navigation ไปยังหน้าจอหลักที่แผนระบุ; หน้าที่ backend ยังไม่ทำมีป้ายชัดเจน
- เพิ่ม `README.md` ระบุวิธีติดตั้ง รัน seed/reset บัญชีสังเคราะห์ และขอบเขตจริง

### ใช้ซ้ำจาก Lab / ต้องสร้างเพิ่ม

| ส่วน | ผลตรวจโค้ด Lab แบบอ่านอย่างเดียว | การตัดสินใจ |
|---|---|---|
| Next.js 16, TypeScript, config/lockfile | มีใน `main` | คัดลอกฐาน config และ dependency |
| Health route | ส่ง `{status:"ok"}` | คัดลอกสำหรับตรวจว่าแอปตอบสนอง |
| Landing page | ใช้ค่า score/coverage คงที่ และ Save เป็น state ใน browser | ไม่คัดลอก เพราะไม่ใช่ flow ที่บันทึกจริง |
| Pairing service | รองรับ Group อย่างเดียวและเลือก evaluator คนแรกเพียง 1 ครั้งต่อคู่ | ไม่คัดลอกเป็น Pairing Engine ของ Demo; สร้างใหม่วันที่ 3 |
| Repository/data | `main` มี interface ของ pair assignment แต่ไม่มี persistence สำหรับ flow เต็ม; test seed route ตอบ success เท่านั้น | ใช้ SQLite ใหม่และสร้าง schema สำหรับ flow เดโม |
| Lab 07 branch/CI/performance/deployment | แยกอยู่บน `codex/lab-07-performance` | ไม่คัดลอก ไม่แก้ ไม่ตั้ง remote/deployment ของ Demo ให้ชี้ Lab |

## วิธีตรวจ

1. ใน `PairEval-Demo` รัน `npm ci --offline --ignore-scripts` และตรวจซ้ำด้วย `npm ci --offline`; รัน `npm run seed`, `npm run build`, `npm run start -- -p 3100`
2. เปิด `http://localhost:3100` และหน้าหลักของทั้งสองบทบาท; ตรวจ 16 เส้นทาง รวม `/api/health` ได้ HTTP 200
3. ตรวจ `/demo/student/report/class-feasible-assignment` และ `/demo/student/roster/class-feasible` ได้ HTTP 404
4. หยุด server แล้วรัน `npm run seed:reset`; query SQLite ได้ 2 classrooms, 5 groups, 26 users (รวม instructor), 2 assignments, 6 criteria, 0 pairs, 0 submissions
5. ตรวจ Lab อีกครั้ง: ยังอยู่ branch `codex/lab-07-performance` และมีเพียงไฟล์ `Pairwise Evaluation - Project Description.md` ที่แก้ค้างอยู่เหมือนก่อนเริ่มงาน

## ผลทดสอบ

| ชุดตรวจ | ผ่าน | ไม่ผ่าน | หมายเหตุ |
|---|---:|---:|---|
| Seed และ seed:reset | 2 | 0 | ครั้งแรกพบ error ตัวแปรอยู่นอก scope; แก้แล้วรันซ้ำผ่าน |
| Install | 2 | 0 | offline install แบบ ignore scripts และแบบปกติผ่าน |
| Build | 2 | 0 | Next.js production build สำเร็จก่อนและหลังแก้ warning |
| Typecheck | 2 | 0 | รันก่อนและหลังแก้ lint warning ผ่าน |
| Lint | 1 | 0 | หลังแก้ unused prop ไม่มี warning |
| HTTP navigation/health | 16 | 0 | ทุกหน้าหลักตอบ 200 |
| Student route denial | 2 | 0 | report และ roster ตอบ 404 |
| Unit/Integration/E2E ของ Pairing/Scoring | 0 | 0 | ยังไม่เริ่ม; ห้ามอ้างผล Lab เป็นผลเดโม |

## ข้อจำกัด/ความเสี่ยง

- หน้าบทบาทเป็นเพียง navigation; สามารถพิมพ์ URL ไปบทบาทผู้สอนได้ ยังไม่ปลอดภัยสำหรับข้อมูลจริง
- ข้อมูลทั้งหมดเป็นข้อมูลสังเคราะห์ ส่วน action P0 วันที่ 2–5 ยังไม่ได้ทำ จึงไม่มีการสร้างคู่ การประเมิน หรือคะแนนจริง
- ขนาดชุด feasible ถูกเลือกเพื่อให้มี evaluator ที่มีสิทธิ์พอในทางจำนวน แต่ Pairing Engine ยังไม่ตรวจ/ยืนยัน coverage
- SQLite เป็นไฟล์ในเครื่องสำหรับสาธิต ยังไม่ได้ออกแบบให้ใช้งานหลาย server หรือ production
- ยังไม่มี unit/integration/E2E ของ flow ปลายเทอม

## งานถัดไป

1. วันที่ 2: ทำ Classroom/CSV import แบบตรวจทั้งไฟล์ก่อนบันทึก พร้อมปฏิเสธอีเมลซ้ำและแถวผิด
2. วันที่ 2: ทำฟอร์ม Assignment และ validation คะแนนย่อย/criteria รวม 100%
3. เพิ่มการบังคับสิทธิ์ฝั่ง server ก่อนเปิด action ใด ๆ ให้นักศึกษาใช้
