# External Dependencies Readiness

รายการนี้ครอบคลุมบริการภายนอกที่ Full System ต้องเตรียมตาม Project Description 1 และ Work Plan ข้อมูลลับต้องเก็บใน secret manager หรือ environment ของระบบ ห้าม commit ลง repository

| บริการ | ใช้สำหรับ | สิ่งที่ต้องเตรียม | เกณฑ์พร้อมใช้งาน | สถานะวันที่ 1 |
|---|---|---|---|---|
| Google OAuth / OpenID Connect | FR-AUTH-01/02, ยืนยันตัวตนและจับคู่ email กับ roster | Google Cloud project, OAuth consent screen, Web client ID/secret, callback URL ของ local/staging/production, test users, verified email scope | Login/logout/callback/state/session expiry ผ่านใน staging; email ที่ไม่อยู่ roster ถูกปฏิเสธโดยไม่เปิดเผยรายชื่อห้อง | ยังไม่มีใน Demo; ปัจจุบันเป็น account picker ใน `src/app/page.tsx` |
| PostgreSQL ที่จัดการสำรองข้อมูลได้ | ฐานข้อมูลหลายผู้ใช้, transaction, migration, history และ retention ≥1 ปีการศึกษา | ผู้ให้บริการ/instance, region, connection string แยก local/staging/production, TLS, backup/PITR, retention, account สำหรับ migration และ runtime แยกกัน | migration บน DB ว่างและข้อมูลสังเคราะห์ผ่าน; restore test ผ่าน; secret ไม่อยู่ใน Git | ยังไม่มี; Demo ใช้ SQLite ไฟล์เดียว |
| Email หรือ notification provider | FR-PAIR-13 และ notification เมื่อ regenerate/ต้อง submit ใหม่ | Institutional SMTP หรือ transactional email provider, sender domain, test recipient, bounce/log policy, template ภาษาไทย, rate limit | ส่งไปบัญชีทดสอบได้, retry/idempotency ผ่าน, ไม่มีรายชื่อนักศึกษาหรือคะแนนเกินจำเป็นในข้อความ | ยังไม่มี |
| Staging + HTTPS | ตรวจ OAuth จริง, role/scope, mobile, performance และการเชื่อมบริการภายนอก | Domain/subdomain, TLS, hosting/runtime ที่รองรับ Node, environment secrets, staging DB, access control, log/monitoring | HTTPS ใช้งานได้, health check, deploy/rollback, test account และ isolation จาก production ผ่าน | ยังไม่มี; ห้ามใช้ deployment ของ Lab 07 |
| Scheduler / background job | FR-SCORE-10 daily update, final calculation และ notification | Scheduled job ของ hosting หรือ worker queue, timezone Asia/Bangkok, locking/idempotency, failure alert | รันซ้ำไม่สร้างผลซ้ำ, retry ได้, บันทึกเวลาคำนวณและสถานะ | ยังไม่ได้เลือก; Demo คำนวณเมื่อเปิดหน้า/API |
| Monitoring และ uptime alert | NFR availability 99.5% โดยเฉพาะก่อน deadline | uptime probe, error tracking, log retention, on-call/contact และ threshold | ตรวจ health/API จากภายนอกและแจ้งเตือนเมื่อผิดปกติ; มี runbook ช่วงก่อน deadline | ยังไม่มี |

## Dependency ที่เป็น library ไม่ใช่บริการ

- Excel `.xlsx`: ต้องเลือก library ที่รองรับหลาย sheet และป้องกัน formula injection; ไม่ต้องมี SaaS
- Migration/ORM หรือ SQL migration runner: ต้องเลือกร่วมกับ PostgreSQL ในวันที่ 2
- Load test tooling: ใช้ข้อมูลสังเคราะห์เพื่อยืนยัน Classroom 200 คนและหน้า Evaluation ภายใน 2 วินาที
