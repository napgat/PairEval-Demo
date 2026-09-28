# PairEval Demo

แอปปลายเทอมแยกเป็น Git repository ใหม่จาก SDPX Lab 07 ใช้ข้อมูลสังเคราะห์เท่านั้น ขณะนี้ทำงานถึง **วันที่ 6** ตาม `SPDX-Lab/Project Plan/Plan.md`: ผู้สอนสร้างห้อง งาน คู่ประเมิน และดูรายงาน/CSV ได้; นักศึกษา Save draft, Submit/Re-submit และดูคะแนนเฉพาะตนได้

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

| บทบาท | อีเมลสังเคราะห์ | วิธีเข้า Demo |
|---|---|---|
| ผู้สอน | `instructor@demo.invalid` | กด “เข้า Demo ผู้สอน” ที่หน้าแรก |
| นักศึกษา | `student-01@demo.invalid` หรือบัญชีสังเคราะห์ที่นำเข้า | เลือกบัญชีในหน้าแรกแล้วกด “เข้า Demo นักศึกษา” |

ระบบสร้าง session ของบัญชีตัวอย่างและตรวจสิทธิ์ฝั่ง server แต่ทุกคนที่เปิดหน้าแรกยังเลือกบัญชีสังเคราะห์ใดก็ได้ จึง **ไม่ใช่ authentication สำหรับข้อมูลจริง** อย่าใช้ข้อมูลจริงหรือเผยแพร่แอปเป็นระบบให้คะแนนจริง

## งานวันที่ 2: สร้างห้องและ Assignment

1. เข้า Demo ผู้สอน → “สร้างห้อง + CSV” → ตั้งชื่อห้อง → upload [CSV ตัวอย่างที่ถูกต้อง](./examples/roster-valid.csv) หรือวางข้อความ → “ตรวจตัวอย่าง CSV” → “สร้างห้องและนำเข้ารายชื่อ”
2. เปิดรายชื่อ/กลุ่มจากหน้าห้องเพื่อดูข้อมูลที่บันทึกจริง
3. กด “สร้างงาน” → ระบุคะแนนรวม, คะแนน Group/Individual, deadline และเกณฑ์ของแต่ละส่วน → กดสร้าง → เปิดรายละเอียดงานที่บันทึกได้
4. ลอง [CSV ตัวอย่างที่ผิด](./examples/roster-invalid.csv): ระบบระบุแถวอีเมลซ้ำและไม่บันทึกบางส่วน ลองเปลี่ยนน้ำหนักเกณฑ์เป็น 90%: Assignment จะไม่ถูกบันทึก

CSV ต้องมีหัวตาราง `email,groupname` ตามลำดับ อีเมลสังเคราะห์ลงท้าย `.invalid` และไม่ซ้ำในไฟล์ รองรับสูงสุด 200 คน; หากผิดรูปแบบจะปฏิเสธทั้งไฟล์ น้ำหนักเกณฑ์ Group และ Individual ต้องรวม 100% แยกกัน และคะแนนส่วนย่อยต้องรวมตรงคะแนนรวม

## ชุดข้อมูล

- **จัดคู่ได้**: 3 กลุ่ม × 7 คน แต่ละคู่กลุ่มมี evaluator ที่ไม่อยู่ในคู่ 7 คน และแต่ละคู่บุคคลมีเพื่อนอีก 5 คนในกลุ่ม Pairing Engine ตรวจแล้วว่า target 5 ครบทุกคู่ของทุกเกณฑ์
- **จัดคู่ไม่ได้**: 2 กลุ่ม × 2 คน ไม่มี evaluator ที่อยู่นอกคู่กลุ่ม และแต่ละคู่บุคคลไม่มี evaluator คนที่สาม
- กำหนดส่งตั้งไว้ปี 2030 เพื่อให้ demo อยู่ในช่วงก่อน deadline จนถึงวันที่สาธิต

## งานวันที่ 3: Pairing preview และสร้างคู่

1. เข้า Demo ผู้สอน → “สร้างคู่” สำหรับงานในห้องที่จัดคู่ได้ หน้า preview แสดงผู้ประเมินที่มีสิทธิ์, target 5, จำนวนที่จะสร้าง (Preview) และจำนวนที่บันทึกจริง (Actual) ต่อคู่/เกณฑ์ รวมถึงจำนวนงานต่อผู้ประเมิน
2. กด “บันทึกคู่ทั้งหมดของงาน” ระบบตรวจทั้ง Group และ Individual อีกครั้ง แล้วบันทึกทั้งหมดใน transaction เดียว กลับมาเปิดหน้าเดิมจะเห็น Actual 5 ทุกคู่ และสร้างซ้ำไม่ได้
3. เปิดงานใน “ห้องที่จัดคู่ไม่ได้” ผ่านห้องเรียน → งานประเมิน → “ตรวจและสร้างคู่” หน้า preview แสดงเหตุผลพร้อมจำนวนผู้ประเมินที่มีสิทธิ์ และไม่มีปุ่มบันทึก

อัลกอริทึมเลือกผู้ประเมินที่มีสิทธิ์ 5 คนที่ไม่ซ้ำกันต่อคู่ โดยเรียงตามภาระงานปัจจุบันและใช้ค่าผสมจาก ID เป็นตัวตัดสินลำดับแบบทำซ้ำได้ หาก **คู่ใดในเกณฑ์ใด** มีผู้ประเมินที่มีสิทธิ์ไม่ครบ 5 คน ระบบไม่บันทึกคู่ของงานนั้นเลย ผู้ประเมิน Group ต้องไม่อยู่ในสองกลุ่มที่เทียบ; ผู้ประเมิน Individual ต้องอยู่กลุ่มเดียวกับคู่ แต่ไม่ใช่หนึ่งในสองคนที่ถูกเทียบ

## งานวันที่ 4: Evaluation

1. จากชุด seed เข้า Demo ผู้สอนและกด “บันทึกคู่ทั้งหมดของงาน” ในห้องที่จัดคู่ได้
2. กลับหน้าแรกและเข้า Demo นักศึกษา เปิด “ประเมินกลุ่ม” หรือ “ประเมินบุคคล” จะเห็นเฉพาะคู่ที่มอบหมายให้ `student-01@demo.invalid` พร้อมเกณฑ์, ตัวเลือก 1–6, progress และเวลาที่เหลือ
3. เลือกคำตอบบางคู่แล้วกด **Save draft** จากนั้น refresh หน้าหรือสลับไปอีกชนิดและกลับมา คำตอบที่บันทึกยังอยู่ Draft ยังไม่นับเป็น submission
4. กด **Submit** เพื่อสร้าง revision 1; แก้คำตอบแล้วกด **Re-submit** เพื่อสร้าง revision 2 โดยเก็บคำตอบของ revision 1 ไว้ Group และ Individual มี revision กับ deadline แยกกัน

Submit บางส่วนได้เมื่อมีอย่างน้อยหนึ่งคำตอบ หน้าแสดงคำเตือนจำนวนคู่ที่ยังไม่ตอบ หลัง deadline เปิดดูคำตอบได้แต่ Save/Submit ถูกปิดทั้งใน UI และฝั่ง server หน้านักศึกษาและ API ไม่ส่งคู่ของผู้ประเมินคนอื่น

## โครงข้อมูล

SQLite ใน `data/demo.sqlite` มี users, classrooms, groups, memberships, assignments, criteria, pair assignments, drafts, submission revisions และ answers การ seed สร้างโครงและข้อมูลเริ่มต้น ตารางคู่และคำตอบยังว่างจนกว่าจะมีการกดสร้าง/บันทึก/ส่ง ไม่มีคะแนนที่ฝังไว้

## ที่มาของโค้ด

อ่าน Lab repository จาก `main` commit `c1f0573` แบบอ่านอย่างเดียว และคัดลอกเฉพาะ `package.json`, lockfile, TypeScript/Next/ESLint/PostCSS config กับ health route มาเป็นฐาน จากนั้นเปลี่ยนชื่อ package, เพิ่ม seed และสร้างหน้าจอใหม่ ไม่คัดลอกหน้า landing ที่แสดงคะแนนคงที่, pairing service ที่ยังแจกเพียงหนึ่ง evaluator ต่อคู่, โค้ด Lab 07, `.env`, การตั้งค่า deployment, ข้อมูลจริง หรือไฟล์ `.git` ของ Lab

Git repository นี้อยู่ที่ `SDPX/PairEval-Demo/.git` แยกจาก `SPDX-Lab/koencontrol-sdpx_lab/.git` ไม่มี remote, PR หรือ deployment ที่เชื่อม Lab
งานวันที่ 1–2 ถูกบันทึกเป็น baseline commit `eefd123` ในรีโปนี้เท่านั้น
งานวันที่ 3 ถูกบันทึกเป็น commit `496ff96` ในรีโปนี้ก่อนเริ่มวันที่ 4

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

## ตรวจงานวันที่ 3

```powershell
npm test
npm run lint
npm run build
npm run seed:reset
npm run start -- -p 3100
# เปิด terminal อีกหน้าต่างใน repo เดียวกัน
node scripts/day3-smoke.mjs
```

`day3-smoke` สร้างคู่จริง 345 รายการใน SQLite สำหรับชุด feasible; หากจะรัน `day3-browser.mjs` ให้หยุด server, `npm run seed:reset`, เปิด server ใหม่ แล้วรัน browser test หลังเสร็จให้รีเซ็ตอีกครั้ง ผลรันอยู่ใน [บันทึกวันที่ 3](./docs/day-03.md)

## ตรวจงานวันที่ 4

```powershell
npm test
npm run lint
npm run build
npm run seed:reset
npm run start -- -p 3100
# เปิด terminal อีกหน้าต่างใน repo เดียวกัน
node scripts/day4-smoke.mjs
```

`day4-smoke` สร้างคู่, draft และ revisions แล้วแก้ deadline ในฐานข้อมูลเพื่อทดสอบการปิดรับ หลังรันให้หยุด server, `npm run seed:reset`, เปิด server ใหม่ แล้วรัน `node scripts/day4-browser.mjs` เพื่อตรวจ draft หลัง refresh และการสลับหน้า ท้ายสุดหยุด server และ reset อีกครั้ง ผลจริงอยู่ใน [บันทึกวันที่ 4](./docs/day-04.md)

## เดโมคะแนนวันที่ 5

1. ถ้าเพิ่ง reset ให้เข้า Demo ผู้สอน → “สร้างคู่” → กด “บันทึกคู่ทั้งหมดของงาน” สำหรับห้องที่จัดคู่ได้
2. ใน terminal ของ Repo นี้รัน `npm run demo:answers` เพื่อสร้าง **submission revision และคำตอบจริงใน SQLite** ของผู้ประเมินสังเคราะห์คนอื่น (เว้น student-01 ไว้ให้กดส่งเอง) คำสั่งรันซ้ำจะไม่แก้ submission ที่มีอยู่ ถ้าสร้างงานใหม่ ใช้ `npm run demo:answers -- <assignment-id> <student-id>` โดย student ID คือบัญชีที่จะเว้นไว้
3. เข้า Demo นักศึกษา ส่งคำตอบ Group/Individual บางส่วนหรือทั้งหมด แล้วดู “คะแนนของฉัน” คะแนนจะคำนวณใหม่จาก revision ล่าสุดที่กด Submit เท่านั้น
4. กลับเข้า Demo ผู้สอน → “รายงาน” ดูคะแนนตามเกณฑ์ จำนวนคำตอบต่อคู่ และสถานะ coverage → “ส่งออก CSV” ดาวน์โหลดสรุปคะแนน

การตรวจวันที่ 5 เคยได้ 345 คู่, 42 submitted revisions และ 332 answers; ตัวเลขนี้เป็นผลของรอบนั้น ไม่ใช่คะแนนที่ฝังใน seed หรือ UI. `npm run seed:reset` ล้างข้อมูลทั้งหมด แล้วทำข้อ 1–2 เพื่อเตรียมใหม่

## ตรวจงานวันที่ 5

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run seed:reset
npm run start -- -p 3100
# อีก terminal ใน repo เดียวกัน
node scripts/day5-smoke.mjs
node scripts/day5-browser.mjs
```

`day5-smoke` สร้างคู่, เพิ่มคำตอบสังเคราะห์, ทดสอบ draft/Submit/Re-submit/API/CSV; `day5-browser` ตรวจหน้ารายงาน ดาวน์โหลด CSV และ My Score. ผลจริงและตัวอย่างคำนวณอยู่ใน [บันทึกวันที่ 5](./docs/day-05.md)

## เดิน Main Flow วันที่ 6 จากข้อมูลใหม่

```powershell
# ปิด server ก่อน reset หาก Windows จับไฟล์ SQLite อยู่
npm run seed:reset
npm run build
npm run start -- -p 3100
# อีก terminal ใน Repo เดียวกัน
npm run test:main-flow
npm run test:ui-audit
```

`test:main-flow` ต้องเริ่มจาก seed ที่ยังไม่มีคู่และ submission: เบราว์เซอร์สร้างห้อง 3 กลุ่ม × 7 คนผ่าน CSV, สร้างงานใหม่, ตรวจหน้าว่างก่อนจัดคู่, สร้างคู่ครบ, เรียกสคริปต์เพิ่ม submission สังเคราะห์ของเพื่อนโดยเว้นนักศึกษาที่เลือกไว้, แล้ว Save draft, Submit/Re-submit Group และ Individual, ตรวจคะแนนและดาวน์โหลด CSV. คำสั่งพิมพ์ `classroom`, `assignment` และ `evaluator` ID ที่ใช้จริงในรอบนั้น; ไม่มีคะแนนฝังไว้. หลังจบให้รัน `test:ui-audit` เพื่อเช็กลิงก์หลัก, ข้อผิดพลาด, NO_DATA, สิทธิ์ และหน้าจอมือถือ 390 px. ผลจริงและตารางขอบเขตฟีเจอร์อยู่ใน [บันทึกวันที่ 6](./docs/day-06.md)

ถ้าต้องการเตรียมข้อมูลเพื่อคลิกสาธิตด้วยตนเองแทนการรัน E2E: `npm run seed:reset` → เปิดแอป → เข้า Demo ผู้สอน → ห้องที่จัดคู่ได้ → งานประเมิน → “ตรวจและสร้างคู่” → “บันทึกคู่ทั้งหมดของงาน” → รัน `npm run demo:answers` → เข้า Demo นักศึกษา `student-01` เพื่อ Submit/Re-submit → เปิด My Score → เข้า Demo ผู้สอนเพื่อดู Report และดาวน์โหลด CSV. หลังรัน E2E ข้างต้น ฐานข้อมูลก็พร้อมเปิดดูได้ทันทีโดยไม่ต้อง reset ซ้ำ

## สถานะถัดไป

วันที่ 7: ซ้อมสาธิตจาก seed ใหม่, แก้บั๊กที่พบจริง และจัดหลักฐานส่งมอบ
