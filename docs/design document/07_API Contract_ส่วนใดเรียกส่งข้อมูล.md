# 07 — API Contract: ใครเรียกข้อมูลอะไร

**ฐานอ้างอิง:** [PRD v2.1](pairwise_evaluation_prd%201.md) หัวข้อ 12 และ [ข้อตัดสินใจสำหรับพัฒนา](13_Decisions%20Needed.md) · **สถานะ:** ร่าง contract เพื่อพัฒนาด้วยข้อมูลสังเคราะห์; ตาราง field ด้านล่างเป็นข้อเสนอ DQ-11 ที่ยังต้อง review และทำ contract tests ไม่ใช่คู่มือ API ของ Demo

ทุก endpoint ใช้ REST + JSON ยกเว้น import/export ไฟล์. ระบบเต็มใช้ session จาก OIDC และตรวจ role, classroom scope, ownership จากฐานข้อมูลทุกครั้ง (FR-AUTHZ-01/02, FR-API-06); การซ่อนปุ่มที่ UI ไม่ใช่การตรวจสิทธิ์

| กลุ่ม | Method และ path ตาม PRD | ผู้มีสิทธิ์ / ผลที่คาด |
|---|---|---|
| Auth | `GET /api/auth/oidc/start`, `GET /api/auth/oidc/callback`, `POST /api/auth/logout` | ผู้ใช้เริ่ม/จบ session ที่ยืนยันตัวตน |
| Entitlement | `GET /api/admin/faculty-entitlements`, `PUT /api/admin/faculty-entitlements/{userId}` | SYSTEM_ADMIN เท่านั้น; ไม่ได้สิทธิ์อ่านคะแนนโดยปริยาย |
| Classroom | `GET /api/classrooms`, `POST /api/classrooms`, `POST /api/classrooms/{id}/roster:import`, `GET /api/classrooms/{id}/roster`, `POST /api/classrooms/{id}/members` | Owner/Co-teacher/TA ตาม role matrix; CSV import เป็น atomic |
| Assignment | `POST /api/assignments`, `PATCH /api/assignments/{id}`, `PUT /api/assignments/{id}/artifacts/{side}/{itemId}` | ผู้สอนที่มีสิทธิ์; แก้เกณฑ์/roster/artifact เฉพาะสถานะที่ PRD อนุญาต |
| Pairing/Lifecycle | `GET /api/assignments/{id}/feasibility`, `POST /api/assignments/{id}:publish`, `POST /api/assignments/{id}:unpublish` | แสดง coverage/workload; Publish สร้างคู่แบบ transaction; Unpublish ปิด generation ปัจจุบันแบบไม่ลบประวัติ ตาม DQ-09 |
| Evaluation | `GET /api/assignments/{id}/my-evaluations?side=GROUP\|INDIVIDUAL`, `PUT /api/comparisons/{pairAssignmentId}`, `POST /api/assignments/{id}/submissions` | เห็นคู่ของตน; autosave idempotent; Submit ด้วย `Idempotency-Key`; ผู้สอนที่ได้รับคู่ใช้ contract เดียวกัน |
| Score | `GET /api/assignments/{id}/my-score`, `POST /api/assignments/{id}:recompute`, `POST /api/assignments/{id}:finalize`, `POST /api/assignments/{id}/scores/{side}/{itemId}:override` | Student เห็นคะแนนตน; Owner/ผู้มีสิทธิ์ทำงานคะแนนตาม role matrix |
| Reports | `GET /api/assignments/{id}/reports/group`, `/individual`, `/coverage`, `/quality`; `POST /api/assignments/{id}/pairs:add-evaluators` | รายงานผู้สอน, เพิ่มผู้ประเมินที่ผ่าน eligibility; Student เรียกไม่ได้ |
| Export | `POST /api/assignments/{id}/exports` | CSV/XLSX ตามสิทธิ์; ค่าเริ่มต้น pseudonym; identity จริงเฉพาะ Owner พร้อมยืนยันและ audit |
| Appeal/Audit | `POST /api/appeals`, `GET /api/assignments/{id}/audit` | Student ยื่นอุทธรณ์; Owner/ผู้มีสิทธิ์อ่าน audit ตามนโยบาย |

## กติกาข้าม endpoint ที่เลือกสำหรับพัฒนา

- `PUT /api/comparisons/{id}` ต้อง idempotent; `POST .../submissions` ต้องรับ `Idempotency-Key` เพื่อกันการส่งซ้ำ (FR-API-01/02)
- Error shape ตาม PRD: `{ "error": { "code": "...", "message": "...", "field": null, "requestId": "..." } }`; `code` ต้องคงที่แยกจากข้อความ (FR-API-03)
- **ข้อเสนอ DQ-11:** success response เป็น `{ "data": ..., "meta": { "requestId": "..." } }`; รายการที่ต้องแบ่งหน้าใช้ `meta.nextCursor`. ตาราง field และตัวอย่างขั้นต่ำอยู่ด้านล่าง; ยังต้อง review และทำ contract test **ราย endpoint** ก่อนถือว่า DQ-11 ปิด
- Resource ต่าง classroom หรือไม่ใช่เจ้าของต้องถูกปฏิเสธโดยไม่เปิดเผยว่ามีข้อมูล; Student ขอ raw pairs/evaluator identity ไม่ได้. Co-teacher เห็นเฉพาะ pseudonym; Owner เปิดตัวตนจริงต้อง audit (OQ-7, FR-ANON-01/05)
- Rate limit 120 request/นาที/ผู้ใช้ และ export 5 request/นาที; เมื่อเกินตอบ 429 พร้อม `Retry-After` (FR-API-04)
- Publish เปิดงานทันทีเมื่อ transaction สำเร็จ (DQ-13); ห้องสองกลุ่มที่ไม่มี eligible Group evaluator ต้องคืน feasibility `eligible=0`, `R_actual=0` และปฏิเสธ Publish ฝั่ง Group ที่ยังต้องคิดคะแนน (OQ-8/DQ-10)
- Artifact ต้องผูก item/side/classroom ตาม FR-ASSIGN-08/DR-08; URL และสิทธิ์ในระบบเก็บไฟล์ภายนอกยังต้องยืนยันก่อนใช้กับผู้ใช้จริง (DQ-14)

## DQ-11 — รูปแบบร่วมของ request/response ที่เสนอ

ข้อกำหนดในส่วนนี้เป็น **design proposal** เพิ่มจาก PRD v2.1; ทีม UI/API ต้อง review ชื่อ field, permission และ error ก่อน coding คู่ขนาน. JSON ใช้ `camelCase`; ID เป็น opaque string; เวลาเป็น ISO 8601 UTC; ค่าคะแนนทศนิยมส่งเป็น decimal string เพื่อไม่ให้ JavaScript ปัดเศษ. Request body ต้อง reject field ที่ไม่รู้จักและห้ามรับ `evaluatorUserId`, `classroomId` หรือ role จาก client เพื่อใช้เป็นหลักฐานสิทธิ์. ตรวจ session, classroom membership, assignment scope, item ownership และ generation จากฐานข้อมูลทุกครั้ง

| กรณี | HTTP / รูปแบบที่เสนอ |
|---|---|
| อ่าน/แก้ไข JSON สำเร็จ | `200` + `{ "data": object, "meta": { "requestId": string } }` |
| สร้าง resource | `201` + envelope เดียวกันและ `Location` เมื่อมี URL resource |
| Logout | `204` ไม่มี body; OIDC start/callback ใช้ redirect และ cookie จึงไม่ใช้ JSON envelope |
| รายการที่แบ่งหน้า | `GET ?limit=20&cursor=...`; `limit` 1–100; `data.items` เป็น array และ `meta.nextCursor` เป็น string หรือ `null`; cursor เป็น opaque และผูกกับ filter/สิทธิ์ของผู้เรียก |
| ไฟล์ | `200` พร้อม `Content-Type`, `Content-Disposition`; ไฟล์ CSV เป็น UTF-8 with BOM; งาน export ยาวอาจตอบ `202` ตาม FR-API-05 หลังตกลง job contract |
| Validation/permission | `400` syntax/query, `401` ไม่มี session, `403` ไม่มีสิทธิ์ทั่วไป, `404` resource ต่างห้องหรือไม่ใช่เจ้าของที่ไม่ควรเผยว่ามีอยู่, `409` state/revision/idempotency conflict, `422` ข้อมูลถูก syntax แต่ผิดกฎธุรกิจ, `429` rate limit + `Retry-After` |

ทุก error ใช้ shape ของ PRD โดย `field` เป็น path เช่น `criteria[0].weightPct` หรือ `null`; `requestId` ต้องตรงกับ response header `X-Request-Id`. ห้ามส่ง PII, pair ของคนอื่น, internal stack trace หรือ token ใน `message`. `Idempotency-Key` เป็น opaque string ต่อผู้ใช้+assignment+operation; key เดิมกับ body เดิมคืนผลเดิม, key เดิมกับ body ต่างกันคืน `409 IDEMPOTENCY_CONFLICT`. `PUT comparison` เรียกซ้ำ body เดิมต้องไม่เพิ่ม revision หรือเปลี่ยน `savedAt` โดยไม่จำเป็น

## Field contract ราย endpoint ตาม PRD หัวข้อ 12

ในตารางนี้ `→` แยก request กับ `data` ของ success response. ฟิลด์ที่ไม่ได้ระบุห้ามส่งออกจนกว่าจะเพิ่มและ review contract; `id`, `createdAt`, `updatedAt` ใช้เมื่อ resource นั้นมีจริง. ค่าที่เป็นรายชื่อใช้ pagination ตามตารางบน. นี่เป็นข้อเสนอให้เริ่มพัฒนา ไม่ใช่ผลทดสอบ

| Endpoint | Request → `data` ที่เสนอ | กฎสำคัญ / error หลัก |
|---|---|---|
| `GET /api/auth/oidc/start`, `GET /api/auth/oidc/callback` | Query/cookie ตาม OIDC → redirect พร้อม session HttpOnly | ตรวจ state/nonce, callback และ allowed domain; ปฏิเสธ login ที่ไม่อนุญาต |
| `POST /api/auth/logout` | ไม่มี body → `204` | ล้าง server session และ cookie |
| `GET /api/admin/faculty-entitlements` | `limit,cursor` → `{items:[{userId,canCreateClassroom}],...}` | SYSTEM_ADMIN เท่านั้น; ไม่มีคะแนนหรือ comparison |
| `PUT /api/admin/faculty-entitlements/{userId}` | `{canCreateClassroom:boolean,reason:string}` → `{userId,canCreateClassroom}` | SYSTEM_ADMIN, audit; `404` หาก user ไม่มี |
| `GET /api/classrooms` | `limit,cursor` → `{items:[{id,name,slug,timezone,role,status}]}` | แสดงเฉพาะห้องที่มีสิทธิ์; admin ไม่เห็นห้องอื่นอัตโนมัติ |
| `POST /api/classrooms` | `{name,timezone,allowedEmailDomains,ownerUserId?}` → `{id,name,slug,status}` | `ownerUserId` ใช้เฉพาะ SYSTEM_ADMIN ที่สร้างแทน FACULTY; ตรวจสิทธิ์สร้าง |
| `POST /api/classrooms/{id}/roster:import` | `multipart/form-data` field `file` CSV `email,group_name,student_id?,display_name?` → `{importedCount,groupCount,warnings:[]}` | Header ตาม FR-CLASS-01 ไม่สนตัวพิมพ์เล็กใหญ่; atomic; แถวผิดคืน `422` พร้อม field/row โดยไม่บันทึกบางส่วน; Owner/Co-teacher/TA |
| `GET /api/classrooms/{id}/roster` | `limit,cursor` → `{items:[{userId,displayName,groupId,role,membershipStatus}]}` | Owner/Co-teacher/TA; ข้อมูลส่วนตัวตาม role; Student เรียกไม่ได้ |
| `POST /api/classrooms/{id}/members` | `{userId,role:CO_TEACHER\|TA}` → `{id,userId,role}` | Owner เท่านั้นใน draft นี้; ไม่รับ OWNER จาก body; duplicate `409` |
| `POST /api/assignments` | `{classroomId,name,description,groupMaxScore,individualMaxScore,groupDeadlineUtc,individualDeadlineUtc,criteria,config}` → `{id,status:DRAFT}` | Owner/Co-teacher ของห้อง; ตรวจคะแนน/เกณฑ์และ deadline; config ใช้ field allowlist ของ schema PRD |
| `PATCH /api/assignments/{id}` | เฉพาะ field ที่แก้ได้ใน DRAFT จากแถวบน → `{id,status:DRAFT,updatedAt}` | `409 INVALID_STATE` ถ้าไม่ใช่ DRAFT; เปลี่ยน roster หลัง Publish ใช้ flow DQ-09 |
| `PUT /api/assignments/{id}/artifacts/{side}/{itemId}` | `{artifactUrl,displayLabel}` → `{side,itemId,displayLabel,available}` | ตรวจ item ใน assignment/classroom, HTTPS และ approved host; ไม่คืน URL ที่มี token |
| `GET /api/assignments/{id}/feasibility` | ไม่มี body → `{generationCandidate,sides:[{side,eligibleEvaluatorCount,requestedCoverage,actualCoverage,blockingReasons:[]}]}` | ห้อง 2 กลุ่มคืน Group `eligibleEvaluatorCount=0`, `actualCoverage=0` ตาม OQ-8/DQ-10 |
| `POST /api/assignments/{id}:publish` | ไม่มี body → `{id,status:OPEN,generation,publishedAt}` | Transaction; `422 PAIRING_INFEASIBLE` หรือ `409 INVALID_STATE`; ตรวจ criteria/deadline และความถูกต้องของ artifact ที่ระบุ; ถ้าไม่มี link ให้ warning ตาม FR-EVAL-02 |
| `POST /api/assignments/{id}:unpublish` | `{reason}` → `{id,status:DRAFT,invalidatedGeneration}` | DQ-09 เก็บ submission/snapshot เก่า, audit; reason ว่างคืน `422` |
| `POST /api/assignments/{id}:recompute` | `{reason?}` → `{id,formulaVersion,computedAt,flags:[]}` | ผู้มีสิทธิ์ตาม role matrix; คำนวณจาก submission revision ล่าสุดและ generation ที่มีผล |
| `POST /api/assignments/{id}:finalize` | `{reason?}` → `{snapshotId,snapshotNo,kind:FINAL,createdAt}` | Owner; `409` หากยังไม่ CLOSED หรือมี appeal/validation error; LOW_CONFIDENCE ต้องให้ Owner ตรวจและระบุเหตุผลก่อน finalize ด้วยมือ; auto-finalize ใช้ gate OQ-3; audit |
| `GET /api/assignments/{id}/my-evaluations` | `side=GROUP\|INDIVIDUAL,limit,cursor` → `{items:[{pairAssignmentId,criterion,side,leftItem,rightItem,choice,status,deadlineUtc}],progress}` | เฉพาะคู่ที่มอบหมายแก่ session; item มี display label และลิงก์ผลงานที่ผ่านสิทธิ์; ไม่คืน evaluator คนอื่น |
| `PUT /api/comparisons/{pairAssignmentId}` | `{choice:1..6}` → `{pairAssignmentId,choice,status:DRAFT,savedAt}` | ตรวจ assignment/generation/evaluator/deadline; body เดิม idempotent; หลัง Submit ยังแก้ draft และ Re-submit ได้ก่อน deadline โดย submission เดิม immutable; หลัง deadline คืน `422 DEADLINE_PASSED` |
| `POST /api/assignments/{id}/submissions` | Header `Idempotency-Key`, body `{side}` → `{submissionId,side,revisionNo,submittedAt,answeredCount,assignedCount}` | Snapshot คำตอบทั้ง side แบบ transaction ตาม DR-06; `409` หาก key/body ขัดกัน; deadline `422 DEADLINE_PASSED` |
| `GET /api/assignments/{id}/my-score` | ไม่มี body → `{assignmentId,status,groupScore,individualScore,participationRatio,totalScore,flags:[]}` | Student เฉพาะคะแนนตน; ก่อนข้อมูลพอใช้ `null`/`NO_DATA`; ไม่ส่งคะแนนหรือ identity คนอื่น |
| `GET /api/assignments/{id}/reports/group` | `limit,cursor,criterionId?` → `{items:[{groupId,criterionId,qualityIndex,comparisonCount,weightedScore,flags:[]}]}` | Owner/Co-teacher; ไม่แสดง raw evaluator identity |
| `GET /api/assignments/{id}/reports/individual` | `limit,cursor,criterionId?` → `{items:[{studentId,criterionId,qualityIndex,comparisonCount,participationRatio,weightedScore,totalScore,flags:[]}]}` | Owner/Co-teacher; Co-teacher ได้ identity ตาม OQ-7 เฉพาะรูปแบบ pseudonym ที่อนุญาต |
| `GET /api/assignments/{id}/reports/coverage` | `limit,cursor,side?` → `{items:[{pairId,side,criterionId,requestedCoverage,actualCoverage,meanChoice,flags:[]}]}` | Owner/Co-teacher; ใช้เลือก pair เพื่อเพิ่ม evaluator |
| `GET /api/assignments/{id}/reports/quality` | `limit,cursor,flag?` → `{items:[{itemType,itemId,criterionId,flag,explanation,suggestedAction}]}` | Owner/Co-teacher; ไม่เผยข้อมูลผู้ประเมินดิบ |
| `POST /api/assignments/{id}/pairs:add-evaluators` | `{pairId,count}` → `{pairId,addedCount,actualCoverage}` | ตรวจ eligibility และ workload; infeasible คืน `422` พร้อมจำนวนที่ขาด; audit |
| `POST /api/assignments/{id}/exports` | `{format:CSV\|XLSX,report,includeIdentities:false,confirmation?}` → ไฟล์หรือ `{jobId,status}` ถ้า async | Owner/Co-teacher; `includeIdentities=true` เฉพาะ Owner พร้อม confirmation/audit; schema ไฟล์ด้านล่าง |
| `POST /api/assignments/{id}/scores/{side}/{itemId}:override` | `{criterionId?,overrideValue,reason}` → `{overrideId,originalValue,overrideValue,createdAt}` | Owner เท่านั้นใน draft นี้; immutable override record/audit; reason ว่าง `422` |
| `POST /api/appeals` | `{assignmentId,message}` → `{appealId,status:OPEN,createdAt}` | Student ใน assignment นั้นเท่านั้น; ไม่รับ student ID จาก body |
| `GET /api/assignments/{id}/audit` | `limit,cursor,action?` → `{items:[{id,actor,action,resourceType,resourceId,reason,occurredAt}]}` | Owner เท่านั้นใน draft นี้; ไม่ส่ง `beforeJson/afterJson` โดยปริยาย |

### ตัวอย่าง JSON สำหรับทีม UI/API

**สำเร็จ — feasibility ก่อน Publish** (`200`):

```json
{"data":{"generationCandidate":2,"sides":[{"side":"GROUP","eligibleEvaluatorCount":0,"requestedCoverage":5,"actualCoverage":0,"blockingReasons":["NO_ELIGIBLE_EVALUATOR"]}]},"meta":{"requestId":"req-demo-01"}}
```

**ปฏิเสธ — Publish ห้องสองกลุ่ม** (`422`):

```json
{"error":{"code":"PAIRING_INFEASIBLE","message":"Group evaluation has no eligible student evaluators.","field":"side","requestId":"req-demo-02"}}
```

**ส่งคำตอบสำเร็จ** (`201`, `Idempotency-Key` เดิมกับ body เดิมต้องได้ `submissionId`/`revisionNo` เดิม):

```json
{"data":{"submissionId":"sub-01","side":"INDIVIDUAL","revisionNo":2,"submittedAt":"2026-09-29T08:00:00Z","answeredCount":4,"assignedCount":5},"meta":{"requestId":"req-demo-03"}}
```

ตัวอย่างใช้รหัสสังเคราะห์เท่านั้น; ต้องเพิ่ม fixture ของ `400/401/403/404/409/429`, response/report/export จริง และ contract tests ที่ยิง API ก่อนเปลี่ยนสถานะ DQ-11 เป็นตรวจผ่าน

### Export schema ขั้นต้น

`report` เสนอค่า `GROUP_SUMMARY`, `INDIVIDUAL_SUMMARY`, `PAIR_COVERAGE`, `RAW_COMPARISONS`; CSV หนึ่ง report ต่อไฟล์, XLSX ต้องมี 4 sheet ตาม FR-EXPORT-02 แม้ caller เลือก report เดียว. Header ที่เสนอ:

| Sheet / CSV | คอลัมน์ขั้นต่ำ |
|---|---|
| Group Summary | `assignment_id,group_id,criterion_id,quality_index,comparison_count,weighted_score,flags` |
| Individual Summary | `assignment_id,student_id,criterion_id,quality_index,comparison_count,participation_ratio,weighted_score,total_score,flags` |
| Pair Coverage | `assignment_id,pair_id,side,criterion_id,requested_coverage,actual_coverage,mean_choice,flags` |
| Metadata | `exported_at_utc,formula_version,assignment_id,generation,score_floor,score_ceiling,instructor_weight,participation_scope,source_snapshot_id` |

ค่า `student_id` ของ Co-teacher/ค่า `evaluator_id` ใน raw export ต้องเป็น pseudonym ตาม OQ-7/FR-EXPORT-03; Owner ที่ขอ identity จริงต้องส่ง `confirmation` ที่ UI ให้กรอกเหตุผลและ server audit. `RAW_COMPARISONS` CSV เพิ่ม `pair_id,criterion_id,evaluator_id,choice,submitted_at_utc` แต่ **ไม่** เพิ่มเป็น sheet ที่ห้าของ XLSX 4-sheet บังคับ; ต้อง review กับ FR-EXPORT-02/03 ก่อน implement. ชื่อไฟล์ใช้ FR-EXPORT-05; XLSX Metadata sheet มีสูตร/config/เวลา export ตาม FR-EXPORT-02/06

## งานที่ยังต้องตรวจรับก่อนถือว่า DQ-11 ปิด

1. ยืนยัน field allowlist และสิทธิ์ของแต่ละ endpoint กับ Owner/Product โดยเฉพาะ `POST members`, `recompute`, `override`, Co-teacher reports และ artifact URL; เทียบกับ schema/acceptance criteria ใน PRD หัวข้อ 7, 11, 12
2. เพิ่ม endpoint ที่ UI/PRD กล่าวถึงแต่หัวข้อ 12 ยังไม่ระบุ: archive classroom, ลบสมาชิก, clone assignment, reopen, ตอบอุทธรณ์, ขอสำเนาข้อมูลส่วนตัว, เปิด evaluator identity และเปิด artifact ผ่าน PairEval หลังตรวจสิทธิ์. แต่ละตัวต้องมี method/path, role, request/response/error และ audit ก่อน coding
3. ตัดสินใจ async export job (`202`, polling/download/expiry) และ notification delivery contract หากเกินเวลาตอบปกติ; ระบุ version ของ API และแนวเปลี่ยน contract แบบไม่ทำ client เก่าพัง
4. ทำ contract tests ราย endpoint พร้อมตัวอย่าง success/error รวม 400/401/403/404/409/422/429, cross-classroom/ownership, idempotency, pagination, CSV/XLSX 4 sheet, pseudonym และห้าม PII/token ใน log/response

**ความต่างจากเดโม:** route ปัจจุบันของ PairEval-Demo ต่างจากตารางนี้ และยังไม่มี OIDC, publish/finalize, idempotency key, rate limit, รายงาน 4 แบบ หรือ XLSX; ห้ามอ้าง API ของระบบเต็มว่าใช้งานได้เพียงเพราะมีเอกสารนี้
