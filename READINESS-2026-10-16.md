# ความพร้อมนำเสนออาจารย์ — ตรวจใหม่ 16 ตุลาคม 2026

> อัปเดตปิดงาน: ดู [คู่มือส่งมอบ 16 ต.ค.](docs/full-system/student-local-delivery-2026-10-16.md) ซึ่งเพิ่มผล GUI Final/อุทธรณ์/Reopen/Override และงานตัวอย่างแยกแล้ว ข้อความด้านล่างเป็น checkpoint ก่อนเพิ่มงานนี้

## ข้อสรุป

**พร้อมสาธิตฟังก์ชันหลักบน local ด้วยข้อมูลสังเคราะห์** ตามเส้นทางที่ตรวจด้านล่าง. ใช้สำเนาที่ `E:\PairEval-Professor-Review-20261016` และเปิดผ่าน `Open-PairEval-Demo.cmd`. ยังไม่ใช่การรับรอง PRD ครบทุกข้อหรือการเปิดใช้งานกับคะแนนจริง.

สำเนานี้มาจากสาขา `codex/prd-v2-implementation` commit `2df5420d0dc7d1a001c2e5726df4b61b27e9e97a` ซึ่งยึด **PRD v2.0 ของอาจารย์**. ไม่ใช้เปอร์เซ็นต์จาก matrix v2.1 เดิมมาแทนผลรอบนี้. รุ่นที่สาธิตผ่านมี patch รายละเอียด UI 5 ไฟล์เพิ่มเติมตามหัวข้อด้านล่าง.

โฟลเดอร์ทำงานเดิมยังอยู่สาขา `codex/full-system-day-02` ที่ `1befe03` พร้อมงาน local เดิม. ไม่ checkout/merge ทับงานเดิม ไม่ลง migration ใหม่ใน Neon และไม่ commit/push/deploy. Migration 013–015 ของสองชุดมีเลขชนกัน ต้องจัดรวมก่อนย้ายรุ่นเข้าสู่ฐานเดิม.

## วิธีเปิดชุดที่ตรวจผ่าน

1. เปิดโฟลเดอร์ `E:\PairEval-Professor-Review-20261016` แล้วดับเบิลคลิก **Open-PairEval-Demo.cmd**.
2. เปิด [http://localhost:3103](http://localhost:3103) เลือกอาจารย์เจ้าของห้อง/ผู้สอนร่วม/TA/นักศึกษา.
3. ตัวแอปอยู่ port **3101**, portal อยู่ **3103**, PostgreSQL อยู่ **55432**; bind เฉพาะ loopback. ชุดนี้ใช้ฐาน operational/audit ที่สร้างใหม่ในเครื่อง ไม่ใช้ credentials ของ Neon เดิม.
4. ปิดด้วย `Stop-PairEval-Demo.ps1` โดยใช้ PowerShell ตามตัวเปิด หรือคำสั่งด้านล่าง. ข้อมูลไม่ถูก reset เมื่อเปิดใหม่.

```powershell
cd E:\PairEval-Professor-Review-20261016
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Open-PairEval-FullSystem.ps1 -NoOpen
# เมื่อเลิกสาธิต
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Stop-PairEval-Demo.ps1
```

ตัวเลือกบัญชีเป็นเครื่องมือ synthetic local; **ไม่ได้ทดสอบ Google login จริงในรอบนี้**. หลังการซ้อม นักศึกษาคนที่ 1 ส่งทั้งสองด้านแล้วและมี revision 1/2 ให้แสดงการส่งแก้ไขได้. ไม่อ้างว่ายังเป็นบัญชีที่ไม่เคยส่งตามบันทึกเตรียมข้อมูลเดิม.

## ผลที่รันใหม่จริง

| การตรวจ | ผลและขอบเขต |
|---|---|
| ติดตั้ง/ฐานใหม่ | npm ci ผ่าน; PostgreSQL UTF-8 ใหม่ แยก operational/audit; migrations 001–019 และ seed marker ผ่าน |
| Unit tests | **88/88**, 22 files; รันซ้ำหลัง patch UI ผ่าน |
| Typecheck / lint / production build | ผ่านหลัง patch; ไม่มี lint warning |
| PRD v2.0 acceptance | **41/41** บน base commit ก่อน patch; รวม role/scope, roster alias/TA, offline reload/retry, submission idempotency, identity audit/IP, rate limit, refresh, immutable snapshot, finalize guards, retention และ archive |
| GUI อาจารย์ | เข้า Owner → ห้อง → งาน/เกณฑ์ → รายงานครบ 4 tabs → ดาวน์โหลด CSV/XLSX → คำนวณ Interim รุ่นใหม่ สำเร็จ |
| GUI นักศึกษา Group | เปิดผลงานจำลอง, ตอบ 2/2, ร่างคงอยู่หลัง reload, Submit revision 1 และ Re-submit revision 2 สำเร็จ |
| GUI นักศึกษา Individual | ตอบ 3/3, Submit revision 1 และ Re-submit revision 2 สำเร็จ; My Score ส่งแล้ว 5/5 คู่ |
| GUI TA / ผู้สอนร่วม | TA เห็นรายชื่อ 16 คน; ผู้สอนร่วมเปิดรายงานได้; หลัง patch ไม่เห็นปุ่ม Finalize ส่วน Owner ยังเห็น |
| คะแนนและไฟล์ | คำนวณตรวจแยกจากสูตร production สำหรับ 16 คน: group/individual/participation/total ตรง snapshot; CSV และ XLSX 4 sheets ตรงกัน; ตรวจค่าที่ปัด 4 ตำแหน่งตาม export |
| ตัวอย่างคะแนนนักศึกษา 1 | Group **11.96**, Individual **3.733333…**, M=1, Total **15.693333…** → snapshot/export **15.6933**, รายงาน **15.693**, My Score **15.69** |
| Presentation / accessibility | หลัง patch ตรวจ 7 หน้า ไม่พบ axe WCAG violations ที่เครื่องมือตรวจได้ รวมสถานะเลือกคำตอบ; สลับบทบาท/CSV/เปิดผลงานผ่านเมื่อ block คำขอนอก localhost |
| Browser engines | acceptance เปิดแบบประเมินผ่าน Chromium/Firefox/WebKit ในกรณีที่ระบุ ไม่ใช่ browser/device matrix เต็มชุด |
| Audit | INSERT/SELECT ได้; UPDATE/DELETE/TRUNCATE ปฏิเสธ; outbox ค้าง 0 ณ checkpoint หลังตรวจคะแนน |
| Backup/restore | หลังมีข้อมูลคำตอบ/คะแนนจริงของ fixture: operational 35 tables/641 rows, audit 1 table/166 rows เทียบทุกแถวตรงกัน; restore 1.264 วินาที; ตรวจ tamper และฐานเดิมไม่เปลี่ยน |
| ปิด–เปิดจริง | Stop ปิด port 3101/3103/55432; Open เริ่มใหม่ได้; คำตอบ revision 1/2 ทั้งสองด้านและคะแนนคงเดิม; worker เรียก scores/reminders/privacy และสร้าง backup สำเร็จ |
| Production boundary | Demo/session ถูกปิดใน production environment; หน้า unauthenticated redirect; API ไม่รับ legacy cookie; มี requestId/HSTS ตามชุดตรวจ |
| Production dependencies | ตรวจใหม่ High **0**, Critical **0**, Moderate **2**; ไม่ใช่ผลรับรองไม่มีช่องโหว่ทุกชนิด |

การคำนวณตรวจแยกใช้ raw inputs ของ snapshot ที่ส่งแล้วและสูตรอิสระ ไม่ import ฟังก์ชัน scoring/export ของ production. ไม่ใช่ fixed golden oracle ที่เขียนก่อนสร้าง fixture; worked-example golden tests อยู่ใน unit suite. รอบแรกของ harness ตรวจ total แบบไม่ปัด 4 ตำแหน่งจึงต่าง 0.000033… แล้วแก้เกณฑ์เทียบให้ตรงความละเอียดที่ระบบบันทึก โดยไม่แก้สูตร/ข้อมูลคะแนน.

Finalize/appeal/retention/archive ใน acceptance เป็น API/fixture tests ตามสคริปต์ ไม่ใช่การคลิกทุกขั้นตอนใหม่ใน GUI. งานสาธิตใน portal มี deadline อีก 7 วัน จึงแสดง Interim; ถ้าจะนำเสนอ Final/appeal สด ต้องเตรียมงานที่ปิดรับแล้วแยกตามกติกา ไม่เลื่อนเวลา/ข้าม guard ระหว่างสาธิตโดยอ้างว่าเป็นพฤติกรรมปกติ.

## จุดที่พบและการจัดการ

1. **พาธภาษาไทยเปิด embedded PostgreSQL ไม่ได้บนเครื่องนี้.** `initdb` แปลงชื่อพาธเป็น `????????` และหา executable ไม่พบ. ย้ายเฉพาะ source snapshot ที่ใช้ทดสอบไปพาธภาษาอังกฤษแล้วเปิดสำเร็จ. โฟลเดอร์ repo เดิมไม่ถูกย้าย. ก่อนส่งเครื่องอื่นให้ใช้พาธภาษาอังกฤษเช่นเดียวกัน.
2. **Contrast หลังเลือก radio ไม่ผ่าน.** รอบแรก `presentation-check` exit 1 ที่ข้อความของตัวเลือกที่เลือกแล้ว แม้ acceptance ของสถานะว่างผ่าน. แก้สีข้อความจาก `#62767c` เป็น `#415a63`; ทดสอบ 7 หน้าซ้ำบนคำตอบที่เลือกแล้วผ่านทั้งหมด.
3. **ข้อความ “ยังไม่ตอบ 0 คู่” ชวนสับสน.** เปลี่ยนกรณีครบเป็น “ตอบครบ 2 คู่แล้ว ยืนยันส่งคำตอบหรือไม่?”. ตรวจกล่องยืนยันจริงแล้ว Cancel; revision ยังคง 2. กรณีไม่ครบยังแสดงจำนวนที่ขาด.
4. **ผู้สอนร่วมเห็นปุ่ม Owner.** เพิ่ม capability `canManageFinalScores` จากขอบเขต Owner ฝั่ง server แล้วใช้ซ่อน Finalize/Reopen ใน UI. ไม่เปลี่ยน authorization ของ mutation เดิม; Owner เห็น Finalize 1 ปุ่ม ผู้สอนร่วมเห็น 0 ใน GUI หลัง patch. Reopen ในสถานะ Final ยังไม่ได้คลิกตรวจใหม่รอบนี้.
5. การคลิกกล่อง confirm ผ่าน browser automation ช่วงแรกติด timeout แต่ native Enter ยืนยันได้และฐานมี revision ที่ถูกต้อง; ไม่ใช่หลักฐานว่าแอปส่งไม่สำเร็จ. ต่อมาตรวจด้วย native click/Enter/Escape ตามกล่องที่พบ.

Patch อยู่ [professor-readiness-2026-10-16.patch](docs/full-system/professor-readiness-2026-10-16.patch) สำหรับ **base `2df5420` เท่านั้น**. Patch มีเฉพาะ CSS, ข้อความยืนยัน, metadata สิทธิ์ และ UI ปุ่มคะแนน. ใช้แล้วในสำเนานำเสนอ; ยังไม่ใส่ลง source เดิมที่ `1befe03` และยังไม่ push.

## หลักฐานและสิ่งที่ยังไม่รับรอง

- Evidence หลัก: `E:\PairEval-Professor-Review-20261016\.verification\v20-20261015\` — acceptance-results.json, presentation-check.json, production-boundary.json, restore-drill.json และ launcher logs เป็นผลรอบ 16 ต.ค. นี้ แม้ชื่อ directory สืบจากสคริปต์เดิม.
- GUI/คะแนนที่ตรวจเพิ่ม: `.verification/review-20261016/gui-checks.json`, `numeric-results.json`, `individual.csv`, `report.xlsx`, `student-score.png`, `teacher-report.png` ในสำเนาเดียวกัน. ไม่แชร์ presentation-state.json หรือ .env.local เพราะมี session tokens/credentials.
- ยังไม่ตรวจ Google consent/callback และ deployed environment ใหม่; localhost synthetic login ใช้แทนผล OAuth จริงไม่ได้.
- ยังไม่รันโหลด 200 บัญชีใหม่ในรอบนี้; ผล burst ที่ไม่ผ่านในรายงาน 15 ต.ค. ยังคงเป็นข้อจำกัด ไม่เปลี่ยนเป็นผ่าน.
- ยังไม่ตรวจ NVDA/VoiceOver แบบ manual, มือถือจริง, uptime/50 ห้อง/10× traffic, off-device backup, retention ของบัญชีที่เรียนต่อหลายปี และ mail/background export แบบองค์กร.
- ชุดนี้พร้อมสำหรับ **การนำเสนอเส้นทางหลักของต้นแบบ** พร้อมอธิบายข้อจำกัด; ไม่อ้าง completion 100% ของ PRD.
