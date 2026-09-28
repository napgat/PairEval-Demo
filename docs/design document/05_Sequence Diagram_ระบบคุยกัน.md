# 05 — Sequence Diagram: การคุยกันในงานสำคัญ

**ฐานอ้างอิง:** [PRD v2.1](pairwise_evaluation_prd%201.md) หัวข้อ 7–12 · **สถานะ:** ลำดับเป้าหมายของระบบเต็ม

## Login และเปิดงาน

```mermaid
sequenceDiagram
    actor U as ผู้ใช้
    participant W as Web
    participant O as Google OIDC
    participant A as API/AuthZ
    participant D as Database
    U->>W: เปิดงาน
    W->>O: เริ่ม OIDC
    O-->>A: ID token
    A->>A: ตรวจ issuer/audience/expiry/email_verified/domain
    A->>D: เชื่อม verified email ครั้งแรก แล้วใช้ sub
    A->>D: ตรวจ role + classroom/resource scope
    A-->>W: session และข้อมูลที่มีสิทธิ์เห็น
```

อ้างอิง FR-AUTH-01–04, FR-AUTHZ-01–04, D9; หาก resource ต่าง classroom ต้องตอบโดยไม่เปิดเผยว่ามี resource นั้น (FR-AUTHZ-02)

## Preview, Publish และสร้างคู่

```mermaid
sequenceDiagram
    actor I as Instructor
    participant W as Web
    participant A as API
    participant P as Pairing Engine
    participant D as Database
    participant N as Notification/Audit
    I->>W: กดตรวจ feasibility
    W->>A: GET feasibility
    A->>P: canonical input + seed + constraints
    P-->>A: coverage/workload/เหตุผลที่ลด target
    A-->>W: ตัวเลข preview
    I->>W: Publish
    W->>A: POST publish
    A->>D: Transaction: ตรวจ config + บันทึก generation/pairs/status
    A->>N: audit และแจ้งผู้ได้รับคู่
    A-->>W: OPEN ทันทีหลัง commit สำเร็จ
```

อ้างอิง FR-PAIR-01–11, INV-G1/INV-I1/INV-2–6, FR-ASSIGN-02–03; ถ้าธุรกรรมล้มเหลวต้องไม่เหลือคู่บางส่วน

**Unpublish/Re-publish ตาม DQ-09:** ปิด generation เดิมแบบ soft-invalidate พร้อมเหตุผลและ audit; อย่าลบ submitted comparison/snapshot. การแก้ roster/criteria ทำใน DRAFT แล้ว Publish สร้างคู่รุ่นใหม่แบบ transaction และแจ้งผู้ได้รับผลกระทบ

## Autosave, Submit, คำนวณ และ Finalize

```mermaid
sequenceDiagram
    actor S as Student
    participant W as Web
    participant A as API/AuthZ
    participant D as Database
    participant C as Scoring Engine
    participant U as Audit
    S->>W: เลือกคำตอบ
    W->>A: PUT comparison (idempotent)
    A->>D: ตรวจ owner/deadline แล้วบันทึก Draft
    A-->>W: เวลาบันทึกสำเร็จ
    S->>W: Submit side
    W->>A: POST submissions + Idempotency-Key
    A->>D: Transaction: submission + comparison revisions
    A-->>W: revision และ submitted_at
    A->>C: ใช้ revision ล่าสุดคำนวณ Interim
    C->>D: บันทึก projection / flags
    Note over A,C: Owner ตรวจ quality และ override ก่อน Finalize
    A->>C: Finalize
    C->>D: สร้าง immutable input/output snapshot
    A->>U: audit finalize
```

อ้างอิง FR-EVAL-04–09, FR-API-01–03, DR-01/03/06, FR-SCORE-01–10, FR-AUDIT-01–03; การส่งหลัง deadline หรือคู่ที่ไม่ได้รับมอบหมายต้องถูกปฏิเสธที่ API

**OQ-3:** งาน scheduled ตรวจเมื่อพ้น deadline สุดท้าย 14 วัน; finalize **ทั้ง Assignment** เมื่อไม่มี LOW_CONFIDENCE, appeal ค้าง หรือ validation error. มิฉะนั้นคง CLOSED และแจ้ง Owner; ทุกกรณีต้อง idempotent และบันทึก audit actor ของระบบ

**ความต่างจากเดโม:** เดโมมีการกด Save draft เอง, Submit/Re-submit และคำนวณคะแนนเมื่ออ่านรายงาน แต่ยังไม่มี OIDC, publish, autosave, scoring job, Finalize snapshot หรือ notification
