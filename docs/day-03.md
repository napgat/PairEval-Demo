# วัน/ช่วงงาน: วันที่ 3 ของแผน — 28 กันยายน 2026

## สถานะ P0 และ P1

| ฟีเจอร์ | สถานะ | พฤติกรรมที่ตรวจได้ |
|---|---|---|
| Demo access, Classroom, CSV, Assignment | เสร็จตามขอบเขตเดโมถึงวันที่ 2 | ใช้งานต่อได้; baseline commit `eefd123` บันทึกก่อนเริ่มวันที่ 3 ในรีโปนี้เท่านั้น |
| Pairing Group | เสร็จ | ครบทุก combination ต่อ criterion, evaluator ต้องอยู่นอกสองกลุ่ม, target 5 คนไม่ซ้ำต่อคู่ |
| Pairing Individual | เสร็จ | เฉพาะคู่ในกลุ่มเดียวกัน, evaluator อยู่กลุ่มนั้นแต่ไม่ใช่ผู้ถูกเทียบ, target 5 คนไม่ซ้ำต่อคู่ |
| Preview/feasibility/coverage | เสร็จ | แสดง target, eligible, Preview, Actual, จำนวนงานต่อคน และเหตุผลเมื่อจัดไม่ได้ |
| Atomic generation | เสร็จ | ตรวจทั้งงานก่อนเขียน; บันทึกทุกคู่ใน transaction เดียว; สร้างซ้ำไม่ได้ |
| Evaluation, Scoring, Report, CSV export | ยังไม่เริ่ม | นักศึกษาเห็นเพียงจำนวนคู่ของตน; ยังตอบหรือเห็นคะแนนไม่ได้ |
| P1 | ยังไม่เริ่ม | ยังมีป้าย “ยังไม่เปิดใช้งานใน Demo” |

## สิ่งที่เปลี่ยน

- สร้าง baseline commit `eefd123 feat: baseline PairEval demo days 1-2` ใน `PairEval-Demo` branch `main` ก่อนแก้วันที่ 3 ไม่มี remote และไม่ได้ commit ใน root/Lab
- `src/lib/pairing-engine.ts`: สร้างทุก combination Group/Individual, คำนวณ eligible evaluator, ปฏิเสธทั้งงานหากคู่ใดมีไม่ถึง 5 คน; เลือกผู้ประเมิน 5 คนไม่ซ้ำด้วยลำดับที่กระจายภาระงานและทำซ้ำได้
- `src/lib/pairing-store.ts`: preview จากข้อมูลจริง, Actual จากคู่ที่บันทึก, ภาระงานต่อ evaluator และ transaction สำหรับบันทึกคู่ทั้งหมด; ป้องกันการสร้างซ้ำหรือเติมคู่บางส่วนอัตโนมัติ
- `src/app/api/assignments/[id]/pairings/route.ts`: GET preview และ POST generate เฉพาะ instructor ของห้อง; student ถูกปฏิเสธ
- `src/app/demo/components/pairing-panel.tsx`: หน้าตาราง coverage รายเกณฑ์และปุ่มบันทึกที่แสดงเฉพาะกรณี feasible; เหตุผลกรณี infeasible
- `src/app/demo/[role]/[[...slug]]/page.tsx`: ลิงก์จากงานไป Pairing และหน้าของนักศึกษาแสดงจำนวนคู่ของตนตามข้อมูลจริง โดยยังระบุว่า Evaluation เปิดวันที่ 4
- `scripts/seed.mjs`: unique index ป้องกัน evaluator คนเดียวได้รับคู่เดียวกันซ้ำในเกณฑ์เดียวกัน

## วิธีตรวจ

1. รัน `npm run seed:reset`, `npm test`, `npm run lint`, `npm run build`, `npm run start -- -p 3100`
2. อีก terminal รัน `node scripts/day3-smoke.mjs`: ก่อนบันทึกชุด feasible มี 69 คู่ตามเกณฑ์ × 5 = 345 งาน, Actual 0; ชุด infeasible มี 4 คู่และเหตุผลว่า eligible 0 < target 5
3. คำสั่ง smoke ลอง POST ชุด infeasible ได้ HTTP 422 และตารางคู่ยังว่าง; POST ชุด feasible ได้ HTTP 201 กับ 345 แถว เปิด preview อีกครั้งทุกคู่ Actual 5; POST ซ้ำได้ HTTP 409 และจำนวนแถวไม่เพิ่ม
4. หยุด server, reset, เปิด server ใหม่ แล้วรัน `node scripts/day3-browser.mjs`: คลิก preview infeasible (ไม่มีปุ่มบันทึก), คลิกบันทึก feasible, refresh ยังเห็นครบ, เปลี่ยนเป็นนักศึกษาแล้วเห็นจำนวนคู่ของตน
5. หยุด server และ `npm run seed:reset` หลังทดสอบ ตอนจบฐานข้อมูลกลับเป็น 2 ห้อง, 5 กลุ่ม, 25 นักศึกษา, 2 งาน และ 0 คู่

## ผลทดสอบ

| ชุดตรวจ | ผ่าน | ไม่ผ่าน | ผลจริง |
|---|---:|---:|---|
| Unit validation + Pairing (Vitest) | 12 | 0 | 8 เดิม + 4 กฎคู่: no self, coverage 5, infeasible, ไม่ทำ partial, ภาระงาน/ผลทำซ้ำ |
| HTTP + SQLite integration วันที่ 3 | 12 | 0 | preview/สิทธิ์/atomic save/actual coverage/duplicate generation |
| Browser flow (Playwright Chromium) | 1 | 0 | infeasible → feasible → save → reopen → นักศึกษาเห็นจำนวนคู่ของตน |
| Build และ lint | 2 | 0 | Next.js build รวม typecheck ผ่าน; lint ไม่มี warning |

ชุด feasible มี Group 3 คู่ × 2 เกณฑ์ = 6 คู่ และ Individual 21 คู่ต่อกลุ่ม × 3 กลุ่ม × 1 เกณฑ์ = 63 คู่ รวม 69 คู่ตามเกณฑ์ เมื่อบันทึกได้ 345 assignments ทุกคู่มี evaluator 5 คนที่มีสิทธิ์และไม่ซ้ำกัน ชุด infeasible ไม่มีแถวใดถูกบันทึก หลังตรวจได้ reset กลับเป็น 0 คู่

## ข้อจำกัด/ความเสี่ยง

- Demo role selection ยังเปิดให้ทุกคนเลือก instructor ได้ จึงยังไม่เหมาะกับข้อมูลจริง
- การกระจายคู่ใช้ลำดับผสมจาก ID แบบทำซ้ำได้เพื่อทดสอบและลดภาระงานที่ไม่สมดุล ไม่ได้สุ่มใหม่ทุกครั้ง; ไม่รับประกัน 5 คู่ต่อ evaluator เพราะแผนให้ความสำคัญกับ coverage และ no self ก่อน
- คู่ที่สร้างแล้วไม่สามารถ regenerate ในวันที่ 3; UI เปลี่ยนกลุ่ม/สร้างคู่ใหม่เป็น P1 ที่ยังไม่เปิดใช้
- นักศึกษายัง Save/Submit ไม่ได้ คะแนนและรายงานผลประเมินยังไม่ทำ; Actual ในหน้า Pairing หมายถึง **คู่ที่มอบหมายแล้ว** ไม่ใช่คำตอบที่ส่งแล้ว
- ไม่มี remote, PR หรือ deployment สำหรับ PairEval-Demo; Lab 07 และ submodule ไม่ถูกแก้

## งานถัดไป

1. วันที่ 4: หน้า Group/Individual Evaluation แสดงคู่ของนักศึกษาที่เข้าใช้และตัวเลือก 1–6
2. ทำ Save draft, Submit/Re-submit แบบ revision พร้อมตรวจสิทธิ์ของคู่และ deadline ที่ server
3. ทดสอบ draft อยู่หลัง refresh, revision ล่าสุด, deadline และการปฏิเสธ pair ของคนอื่น
