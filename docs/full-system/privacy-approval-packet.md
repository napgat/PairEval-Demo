# Privacy Notice approval packet — draft for named owners

Date: 29 September 2026. This packet is a reviewable proposal for `FR-PRIV-01` and `OQ-6`, not a legal determination, approved notice, or permission to enroll real users for real coursework. The institutional policy gate remains closed. PRD v2.1 and its traceability line numbers are unchanged.

**Student-project staging update (30 September 2026):** Two owner-supplied Google accounts were enrolled solely to view a synthetic preview classroom. They can acknowledge a separate `student-demo-staging-v1` notice themselves after login; see [staging demo access](staging-demo-access.md). That prototype acknowledgement is not approval of the PRD notice below, OQ-6, retention or real-grade processing. The institutional gate remains open.

## Proposed first-login text (`2026-09-paireval-v1`)

> PairEval ใช้อีเมลมหาวิทยาลัยที่ Google ยืนยันแล้วเพื่อเข้าสู่ระบบและจับคู่กับรายชื่อห้องเรียน เก็บชื่อเพื่อให้ผู้สอนจัดการชั้นเรียนและรายงาน และเก็บรหัสนักศึกษาเฉพาะเมื่อมีในรายชื่อ ระบบเก็บคำตอบการประเมิน การแก้ไขคำตอบ คะแนน และตัวตนผู้ประเมินเพื่อคำนวณผลและตรวจสอบความสุจริตทางวิชาการ Owner, ผู้สอนร่วม และผู้ช่วยสอนที่มีสิทธิ์ในห้องเรียนเห็นข้อมูลรายชื่อตามบทบาท นักศึกษาเห็นผลรวมของตนเองเมื่อผ่านเกณฑ์การไม่เปิดเผยตัวตน ผู้สอนร่วมเห็นรหัสแทนตัวตนผู้ประเมินในข้อมูลการประเมินที่ตนมีสิทธิ์ดู; ผู้ช่วยสอนไม่มีสิทธิ์ดูตัวตนผู้ประเมิน การเปิดเผยตัวตนจริงต้องผ่านกระบวนการของ Owner และบันทึก audit ทุกครั้ง ระบบเก็บเหตุการณ์ความปลอดภัย เช่น บัญชี การกระทำ เวลา ทรัพยากร เหตุผล และ IP เมื่อมี เพื่อการตรวจสอบ
>
> ตาม PRD v2.1 อีเมล ชื่อ รหัสนักศึกษา (ถ้ามี) ผลประเมิน และตัวตนผู้ประเมินเก็บ 2 ปีการศึกษา แล้วแทนตัวตนด้วยรหัสคงที่โดยรักษาสถิติเชิงรวม **ขณะนี้ไม่เก็บเวลาใช้ทำงานของผู้ใช้จริง** จนกว่าผู้รับผิดชอบข้อมูลส่วนบุคคลจะตัดสิน OQ-6 หากเปิดใช้ในอนาคต ต้องแจ้งฐานการใช้ ระยะเก็บ และตัวเลือกที่จำเป็นก่อนเริ่มเก็บ คุณสามารถติดต่อ [ผู้ควบคุมข้อมูล/ช่องทางที่หน่วยงานอนุมัติ] เพื่อขอสำเนาข้อมูลของตน; PRD กำหนดเป้าหมายตอบภายใน 30 วัน

The bracketed contact is deliberately unresolved and must be replaced before display to real users. The paragraph describes planned anonymity and retention behavior; those features are not yet implemented or accepted, so the text must not be published as if they already operate.

## Owner decisions required before enabling acceptance

| Owner | Exact decision and evidence to record |
|---|---|
| Privacy Officer / data controller | Approve or edit each sentence; identify controller and contact; decide lawful basis and whether acknowledgement or separate consent is appropriate; define start/end of an academic year; approve how audit and backups fit the two-year rule and legal holds. Record name, decision date, notice version and approved text. |
| Privacy Officer (`OQ-6`) | Choose whether time-on-task is collected for real users. If yes, decide basis, separate consent if required, notice wording, and one-academic-year retention; if no, approve the QS-05/PRD change path. Until then, keep collection disabled. |
| Academic/Product owner (`OQ-7`) | Approve exact identity visibility for Owner, co-teacher, TA and student across roster, evaluation screens, exports, and audit; verify that the notice matches the final role matrix. |
| Security/Operations owner | Approve version storage, re-acknowledgement on change, revocation behavior, access logs, independent audit checkpoint/backup account, restore test and retention execution. |

## Release check after approval

Implement a versioned acceptance endpoint and UI only against the approved text. The first verified Google login must stop before classroom data until acceptance; declining must leave access denied. Test changed notice version, expired/revoked session, cross-classroom access, audit of acceptance/revocation, and safe copy/retention workflow with synthetic accounts before enabling real enrollment. A sentinel `synthetic-staging-v1` acceptance row is a test bypass only and is never evidence of consent.
