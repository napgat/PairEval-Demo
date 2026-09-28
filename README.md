# PairEval Demo

แอปปลายเทอมแยกเป็น Git repository ใหม่จาก SDPX Lab 07 ใช้ข้อมูลสังเคราะห์เท่านั้น ขณะนี้ทำงานถึง **วันที่ 2** ตาม `SPDX-Lab/Project Plan/Plan.md`: ผู้สอนสร้างห้องจาก CSV และสร้างงานประเมินได้ การจับคู่ ประเมิน และคิดคะแนนจะทำในวันถัดไป

## ความต้องการ

- Node.js 24 ขึ้นไป (ใช้ SQLite ที่มากับ `node:sqlite`)
- npm

## ติดตั้งและเปิดแอป

```powershell
npm ci
npm run seed
npm run dev
```

เปิด <http://localhost:3000> แล้วกดเลือกบัญชีตัวอย่าง หรือดู health check ที่ <http://localhost:3000/api/health>

## รีเซ็ตข้อมูล

```powershell
npm run seed:reset
```

คำสั่งนี้ลบและสร้าง `data/demo.sqlite` ใหม่ทั้งไฟล์ ข้อมูลตัวอย่างจะกลับเป็น 2 ห้อง, 5 กลุ่ม, นักศึกษาสังเคราะห์ 25 คน และ 2 งาน โดยไม่มีคู่หรือคะแนนเริ่มต้น Session เดิมจะใช้ไม่ได้หลังรีเซ็ต ให้เลือกบัญชีใหม่ที่หน้าแรก ปิด dev server ก่อนรีเซ็ตหากเครื่อง Windows แจ้งว่าไฟล์กำลังใช้งาน

## บัญชีตัวอย่าง

| บทบาท | อีเมลสังเคราะห์ | การเข้าหน้าวันที่ 1 |
|---|---|---|
| ผู้สอน | `instructor@demo.invalid` | กด “เข้า Demo ผู้สอน” ที่หน้าแรก |
| นักศึกษา | `student-01@demo.invalid` | กด “เข้า Demo นักศึกษา” ที่หน้าแรก |

ระบบสร้าง session ของบัญชีตัวอย่างและตรวจสิทธิ์ฝั่ง server สำหรับคำสั่งผู้สอน แต่ทุกคนที่เปิดหน้าแรกยังเลือกบัญชีผู้สอนได้เอง จึง **ไม่ใช่ authentication สำหรับข้อมูลจริง** อย่าใช้ข้อมูลจริงหรือเผยแพร่แอปเป็นระบบให้คะแนนจริง

## งานวันที่ 2: สร้างห้องและ Assignment

1. เข้า Demo ผู้สอน → “สร้างห้อง + CSV” → ตั้งชื่อห้อง → upload [CSV ตัวอย่างที่ถูกต้อง](./examples/roster-valid.csv) หรือวางข้อความ → “ตรวจตัวอย่าง CSV” → “สร้างห้องและนำเข้ารายชื่อ”
2. เปิดรายชื่อ/กลุ่มจากหน้าห้องเพื่อดูข้อมูลที่บันทึกจริง
3. กด “สร้างงาน” → ระบุคะแนนรวม, คะแนน Group/Individual, deadline และเกณฑ์ของแต่ละส่วน → กดสร้าง → เปิดรายละเอียดงานที่บันทึกได้
4. ลอง [CSV ตัวอย่างที่ผิด](./examples/roster-invalid.csv): ระบบระบุแถวอีเมลซ้ำและไม่บันทึกบางส่วน ลองเปลี่ยนน้ำหนักเกณฑ์เป็น 90%: Assignment จะไม่ถูกบันทึก

CSV ต้องมีหัวตาราง `email,groupname` ตามลำดับ อีเมลสังเคราะห์ลงท้าย `.invalid` และไม่ซ้ำในไฟล์ รองรับสูงสุด 200 คน; หากผิดรูปแบบจะปฏิเสธทั้งไฟล์ น้ำหนักเกณฑ์ Group และ Individual ต้องรวม 100% แยกกัน และคะแนนส่วนย่อยต้องรวมตรงคะแนนรวม

## ชุดข้อมูล

- **จัดคู่ได้ตามขนาดข้อมูล**: 3 กลุ่ม × 7 คน แต่ละคู่กลุ่มมี evaluator ที่ไม่อยู่ในคู่ 7 คน และแต่ละคู่บุคคลมีเพื่อนอีก 5 คนในกลุ่ม กฎจับคู่จริงและการยืนยัน coverage จะทำวันที่ 3
- **จัดคู่ไม่ได้**: 2 กลุ่ม × 2 คน ไม่มี evaluator ที่อยู่นอกคู่กลุ่ม และแต่ละคู่บุคคลไม่มี evaluator คนที่สาม
- กำหนดส่งตั้งไว้ปี 2030 เพื่อให้ demo อยู่ในช่วงก่อน deadline จนถึงวันที่สาธิต

## โครงข้อมูล

SQLite ใน `data/demo.sqlite` มี users, classrooms, groups, memberships, assignments, criteria และตารางเตรียมสำหรับ pair assignments, drafts, submission revisions, answers การ seed สร้างโครงและข้อมูลเริ่มต้น ตารางคู่และคำตอบยังว่าง ไม่มีคะแนนที่ฝังไว้

## ที่มาของโค้ด

อ่าน Lab repository จาก `main` commit `c1f0573` แบบอ่านอย่างเดียว และคัดลอกเฉพาะ `package.json`, lockfile, TypeScript/Next/ESLint/PostCSS config กับ health route มาเป็นฐาน จากนั้นเปลี่ยนชื่อ package, เพิ่ม seed และสร้างหน้าจอใหม่ ไม่คัดลอกหน้า landing ที่แสดงคะแนนคงที่, pairing service ที่ยังแจกเพียงหนึ่ง evaluator ต่อคู่, โค้ด Lab 07, `.env`, การตั้งค่า deployment, ข้อมูลจริง หรือไฟล์ `.git` ของ Lab

Git repository นี้อยู่ที่ `SDPX/PairEval-Demo/.git` แยกจาก `SPDX-Lab/koencontrol-sdpx_lab/.git` ไม่มี remote, PR หรือ deployment ที่เชื่อม Lab

## ตรวจงานวันที่ 2

```powershell
npm test
npm run lint
npm run build
npm run seed:reset
npm run start -- -p 3100
# เปิด terminal อีกหน้าต่างใน repo เดียวกัน
node scripts/day2-smoke.mjs
node scripts/day2-browser.mjs
```

`day2-smoke` และ `day2-browser` จะสร้างข้อมูลทดสอบใน SQLite หลังทดสอบให้หยุด server และรัน `npm run seed:reset` เพื่อกลับสู่ชุดเริ่มต้น ผลรันและข้อจำกัดอยู่ใน [บันทึกวันที่ 2](./docs/day-02.md)

## สถานะถัดไป

วันที่ 3: Pairing engine และ feasibility วันที่ 4–5: Evaluation, scoring, report และ CSV ตามแผน
