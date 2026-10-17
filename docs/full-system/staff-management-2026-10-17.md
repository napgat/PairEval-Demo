# ทีมผู้สอน — รุ่นต้นแบบ local วันที่ 17 ตุลาคม 2026

## วิธีใช้

Owner เปิดห้องเรียน → **รายชื่อและกลุ่ม → ทีมผู้สอน** เห็นรายชื่อ Owner/อาจารย์ร่วม/ผู้ช่วยสอนที่ยังอยู่ในห้อง เพิ่มด้วยอีเมลบัญชีที่มีอยู่และเลือกบทบาทได้ทันที ถอดสมาชิกผ่านกล่องยืนยัน และเพิ่มอีเมลเดิมกลับได้ ประวัติสมาชิกเดิมยังอยู่ Owner แสดงแบบอ่านอย่างเดียว

สำหรับลองบนเครื่อง ให้สร้างห้องสมมติใหม่ แล้วเพิ่ม `v20-presentation-co@example.test` และ `v20-presentation-ta@example.test` สลับบัญชีที่หน้า `http://localhost:3103` เพื่อตรวจสิทธิ์ อย่าถอดสมาชิกจากห้องตัวอย่างเดิมระหว่างซ้อม workflow อื่น

บัญชีที่ไม่พบ/ถูกปิดใช้งานเพิ่มไม่ได้ บัญชี Student/Owner ของห้องนี้เปลี่ยนเป็นผู้สอนผ่านฟอร์มนี้ไม่ได้ ผู้สอนที่เป็นสมาชิกอยู่แล้วต้องถอดก่อนเพิ่มด้วยบทบาทใหม่ ไม่มีการส่งคำเชิญหรือสร้างบัญชีให้ผู้อื่น

## API ที่ใช้งานจริง

ทุกเส้นทางตรวจ session, Privacy Notice และ Owner ของห้องที่ยัง active จากฐานข้อมูล การเปลี่ยนข้อมูลตรวจ Origin ด้วย Co-teacher/TA/Student/คนนอกห้องจัดการสมาชิกผู้สอนไม่ได้

| Method | เส้นทาง Full System | ผลปกติ |
|---|---|---|
| GET | `/api/full-system/classrooms/{id}/members` | 200 `{data:[{userId,displayName,email,role}]}` เฉพาะสมาชิกผู้สอนที่ active เรียง Owner → Co-teacher → TA |
| POST | `/api/full-system/classrooms/{id}/members` | 201 `{data:{id,userId,role,restored}}` |
| DELETE | `/api/full-system/classrooms/{id}/members/{userId}` | 204 ไม่มี response body; เปลี่ยนสถานะสมาชิกเป็น WITHDRAWN |

มี alias `/api/classrooms/{id}/members` และ `/api/classrooms/{id}/members/{userId}` ที่ใช้ handler เดียวกัน

POST รับ `{email,role}` หรือ `{userId,role}` อย่างใดอย่างหนึ่ง บทบาทรับเฉพาะ `CO_TEACHER`/`TA` รูปแบบ userId เดิมยังใช้ได้ อีเมลใช้ normalization ตาม FR-AUTH-03 ของ baseline v2.0: trim/lowercase, ตัด plus suffix และจุดใน local part บัญชีเดิมที่ไม่ DISABLED มีสิทธิ์ถูกเพิ่ม (รวมบัญชี PENDING ตามพฤติกรรมเดิม); การเพิ่มบทบาทไม่ได้เปิดใช้งานบัญชีหรือข้ามขั้นตอนเข้าสู่ระบบ

| Status/code | ความหมาย |
|---|---|
| 400 INVALID_JSON | JSON ไม่ถูกต้อง |
| 401 UNAUTHENTICATED | ไม่มี session ที่ใช้ได้ |
| 403 ORIGIN_INVALID | Origin ไม่ตรง |
| 404 NOT_FOUND | ไม่พบห้อง/สมาชิก หรือไม่มีสิทธิ์ Owner |
| 409 MEMBER_CONFLICT | เป็นสมาชิกอยู่แล้ว, ไม่อนุญาตเปลี่ยน Student/Owner หรือถอด Owner คนสุดท้าย |
| 422 MEMBER_INVALID | รูปแบบ ID/อีเมล/บทบาท หรือส่ง identifier ไม่ถูกต้อง |
| 422 MEMBER_ACCOUNT_UNAVAILABLE | ไม่พบบัญชีที่ใช้ได้ |
| 428 PRIVACY_NOTICE_REQUIRED | ยังไม่ยอมรับ Privacy Notice |
| 503 AUDIT_UNAVAILABLE | บันทึก intent ไม่ได้ จึงไม่เปลี่ยนข้อมูล |
| 202 AUDIT_PENDING / COMMIT_UNKNOWN | ยังยืนยัน audit outcome/ผล commit ไม่ได้; ตรวจรายชื่อก่อนทำซ้ำ |

UI ไม่อ่าน JSON ของ DELETE 204 และไม่แจ้งสำเร็จเมื่อได้ 202 หรือเครือข่ายขัดข้อง ปิดปุ่มเปลี่ยนข้อมูลจนกว่าจะโหลดรายชื่อใหม่ ไม่มีการส่ง POST/DELETE ซ้ำอัตโนมัติ การโหลดใหม่แสดงสถานะสมาชิกปัจจุบัน ไม่ได้เป็นหลักฐานว่า audit ที่ค้างถูกส่งครบแล้ว

การเพิ่มกลับ UPDATE แถว membership เดิมและล้าง withdrawn_at โดยคง joined_at; intent/outcome บันทึกบทบาทก่อน–หลังและ restored การล็อกห้อง serialize การเปลี่ยนสมาชิก API เดิมยังป้องกันถอด Owner คนสุดท้าย แม้ UI ไม่เสนอปุ่มถอด Owner

## ผลตรวจที่ทำจริง

สภาพแวดล้อม Windows x64, Node.js 24, Chromium, PostgreSQL local แยก operational/audit; ข้อมูลสังเคราะห์ ไม่มีการเปลี่ยน Neon/staging และไม่มี migration ใหม่

- Unit **106/106** ใน 24 ไฟล์; typecheck, lint และ production build ผ่าน
- `node scripts/staff-ui-check.mjs`: เพิ่ม Co-teacher/TA ผ่าน GUI, duplicate/unknown/disabled, ป้องกันแปลง Student/Owner, ยกเลิก/Escape และคืน focus, ยืนยันถอด 204, ตรวจสิทธิ์หลังถอด, เพิ่มกลับด้วย membership ID และ joined_at เดิม
- ตรวจ GET/POST/DELETE ด้วย Co-teacher/TA/Student/คนนอกห้องถูกปฏิเสธ; ไม่มี panel ใน UI ของบทบาทเหล่านี้ ตรวจ anonymous 401, malformed JSON 400, alias และ POST userId เดิมด้วย
- ตรวจ audit **4 ADD_COMMITTED + 2 REMOVE_COMMITTED**, outbox ค้าง **0**; fixture ห้องและบัญชี disabled ถูกล้าง ประวัติ audit ยังคงไว้
- จำลอง response 202, 503 และ network failure ที่ browser transport เพื่อยืนยันข้อความ/การล็อกปุ่ม/โหลดใหม่ **ไม่ใช่การจำลอง audit outage ที่ฐานจริง**
- Axe ไม่มี violations ใน 4 สถานะ: Owner desktop, dialog และ mobile 390/320 px; ไม่มี page overflow หรือ browser page errors ตารางเลื่อนในกรอบและรับ keyboard focus ได้
- regression UI เดิม `npm run test:demo-ui` **22 หน้าจอ/สถานะผ่าน**, ไม่มี Axe violations/page errors และไม่มีข้อข้าม เป็น read-only smoke ของเส้นทางเดิม ไม่ใช่การส่งประเมินซ้ำทุก flow

ผลรายละเอียด/รูปในเครื่องทดสอบอยู่ใน `.verification/staff-ui-20261017/` และ `.verification/ui-usability-20261016/` ซึ่งเป็นข้อมูล local ไม่ส่งขึ้น Git ทำซ้ำด้วยสคริปต์ที่เก็บใน repo ได้ขณะ local demo เปิดอยู่

## ข้อจำกัดและส่งต่อ

ยังรอเพื่อนตรวจรุ่นนี้บนเครื่องของตน ไม่ยกระดับเป็น production-ready หรือผ่าน PRD ทุกข้อจากผลชุดนี้ ขอบเขต invitation, Google OAuth/first-login จริง และการรับรอง accessibility ทุกหน้าไม่อยู่ในงานนี้ รุ่นเดิมอัปเดต main → `npm ci` → `npm run build` → เปิด launcher โดยเก็บฐานเดิมตามคู่มือได้

## ตรวจซ้ำตามแผนหลัง commit 8c33107 — 17 ตุลาคม 2026

ทดสอบบนสำเนา local ที่แยกฐานจากชุดนำเสนอ ใช้ Windows x64, Node.js 24 และ Chromium ข้อมูลทุกบัญชีเป็นข้อมูลสังเคราะห์ ไม่แก้โค้ดแอปในรอบนี้

| ชุดตรวจ | ผลจริง |
|---|---|
| Unit/typecheck/lint/build | 106/106 tests ใน 24 ไฟล์ และทุกคำสั่งผ่าน |
| Staff GUI/API regression | สคริปต์ `staff-ui-check.mjs` ผ่าน 8 กลุ่มตรวจ รวมเพิ่ม–ถอด–เพิ่มกลับ สิทธิ์ทุกบทบาท alias และ API userId เดิม |
| Audit ของ staff regression | 4 ADD_COMMITTED + 2 REMOVE_COMMITTED, outbox ค้าง 0 |
| กรอกอีเมลผิดรูปแบบ | browser แสดง validation และไม่ส่ง POST |
| Keyboard | Tab จากอีเมลไปบทบาทและปุ่มเพิ่ม แล้ว Enter ส่งจริงได้ทั้ง Co-teacher/TA; Escape ของกล่องถอดคืน focus ตาม regression |
| ปิด–เปิดจริง | หยุดและเปิดทั้งแอป/ฐานด้วย launcher; ID, role, status, joined_at และ withdrawn_at ของสมาชิกตรงกับก่อนปิด |
| สิทธิ์หลังเปิดใหม่ | Co-teacher ที่ active อ่าน roster ได้; TA ที่ถูกถอดยังถูกปฏิเสธและไม่ปรากฏในรายชื่อผู้สอน |
| เพิ่มกลับหลังเปิดใหม่ | TA กลับเป็น ACTIVE โดยใช้ membership ID และ joined_at เดิม |
| Audit ของ persistence | 3 ADD_COMMITTED + 1 REMOVE_COMMITTED, outbox ค้าง 0 |
| UI เดิม | `npm run test:demo-ui` ผ่าน 22 หน้าจอ/สถานะ ไม่มีข้อข้าม ไม่มี Axe violations, page overflow หรือ browser page errors |
| เก็บข้อมูลและ cleanup | fingerprint สมาชิก/score snapshots ของห้องสาธิตเดิมไม่เปลี่ยน; ห้อง persistence ถูกล้างเหลือ 0 พร้อมเก็บ audit |

ไม่พบข้อผิดพลาดของแอปในขอบเขตที่ตรวจ รอบนี้เพิ่มการตรวจ keyboard และ restart จริงจากหลักฐานรอบพัฒนาเดิม ภาพและผลละเอียดอยู่ใน `.verification/staff-retest-20261017/`, `.verification/staff-ui-20261017/` และ `.verification/ui-usability-20261016/` ของสำเนาทดสอบ ซึ่งไม่ส่งขึ้น Git

การตรวจ 202/503/network failure ยังเป็นการจำลองที่ browser transport ตามที่ระบุด้านบน ส่วน UI เดิมเป็น read-only regression ไม่ใช่การส่ง Group/Individual หรือปิดอุทธรณ์ใหม่ครบเส้นทางในรอบนี้ เปิดชุดนำเสนอเดิมกลับหลังจบทดสอบแล้ว และยังรอเพื่อนตรวจบนเครื่องของตน
