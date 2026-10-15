# PairEval — ผลแก้ตาม PRD v2.0 และความพร้อมสาธิต

วันที่: 15 ตุลาคม 2026 · เครื่องโน้ตบุ๊ก · ข้อมูลสังเคราะห์ทั้งหมด

**พร้อมสาธิตฟังก์ชันหลักบนโน้ตบุ๊ก โดยใช้ Full System เป็นหลัก แต่ยังไม่ผ่าน PRD ทั้งหมดสำหรับนำไปใช้กับรายวิชาจริง** ห้ามใช้จำนวนเทสต์ที่ผ่านเป็นเปอร์เซ็นต์ completion ของ PRD

## เปิดใช้งาน

ดับเบิลคลิก `D:\PairEval-Review-20261015\Open-PairEval-Demo.cmd` หรือเปิด <http://localhost:3103> หลังตัวเปิดทำงาน เลือก Owner, ผู้สอนร่วม, TA หรือนักศึกษา ตัวเลือกบทบาทเป็นเครื่องมือสาธิตที่แยกจากแอปและจำกัดอยู่ที่ localhost/development; ไม่ใช่การล็อกอิน Google จริง

ข้อมูลเตรียมไว้: 16 นักศึกษา, 4 กลุ่ม, 84 คู่ประเมิน, 30 submissions จากนักศึกษาคนอื่น และ snapshot ชั่วคราว 1 รุ่น นักศึกษาคนที่ 1 ยังไม่ส่ง เพื่อใช้สาธิตสด มีผลงานจำลองกลุ่ม 4 ชิ้นและรายบุคคล 16 ชิ้นเปิดได้ในเครื่อง

ลำดับแนะนำ: Owner เปิดเกณฑ์/รายงาน → นักศึกษาคนที่ 1 เปิดผลงานและส่งทั้งสองด้าน → Owner คำนวณใหม่/ตรวจ participation/ส่งออก → เปลี่ยนเป็น TA เพื่อตรวจรายชื่อ ปิดบริการด้วย `Stop-PairEval-Demo.ps1`; ตัวเปิดไม่ reset ข้อมูล

## เกณฑ์อ้างอิง

- [PRD ของอาจารย์ v2.0](https://github.com/CE-SDPX/SDPX-AI/blob/main/project-ideas/pairwise_evaluation_prd.md), อัปเดต 3 สิงหาคม 2026
- File commit: `f0b8b3cd7ad58a6c6401eeb4f0954b2271fa31b0`
- SHA-256: `4d4d2e7fac0bfa30c3f16f313aee0adc58d30bd3f634acfdeb38da368b51567a`
- Checkout: `codex/prd-v2-implementation`, base `1befe03ab61a28df53c32852f02a03eac6246884`
- [Evidence map](prd-v2.0-evidence-map.md) มี 132 ID จากต้นฉบับ แสดงขอบเขตหลักฐานและช่องว่างอย่างชัดเจน ใช้แทน matrix v2.1 สำหรับรอบนี้

## ส่วนที่แก้

- ใช้ band mapping และ participation รวมตาม v2.0 ใน Full System และ Demo สำรอง; 90% ได้ M=1, ไม่มีการหารคะแนนด้วยจำนวนกลุ่ม และ Demo สำรองไม่อนุมาน Final จากเส้นตาย
- ตั้ง score floor/ceiling ต่อ assignment ได้ พร้อมตรวจค่าฝั่ง server และใช้ในการคำนวณจริง
- Normalize อีเมลตามตัวอย่างรับงานของ PRD, ตรวจ alias ชนกัน, เก็บอีเมลต้นฉบับ; TA นำเข้า roster ได้เฉพาะเมื่อแก้รายชื่อได้ และ import ข้อมูลแบบ atomic
- Owner ยืนยันเหตุผลก่อนเปิดเผยตัวตนผู้ประเมิน; audit การเข้าถึงและการส่งออกเป็นคนละ event พร้อม IP ส่วน default export เป็น pseudonym
- เฉพาะ Owner ยืนยัน/เปิดคะแนนใหม่; มีงานประจำวันตาม timezone และ auto-finalize หลัง 14 วัน พร้อมปิดกั้นเมื่อมี appeal, LOW_CONFIDENCE หรือ BELOW_K
- เก็บคำตอบค้างส่งในเครื่องแยกผู้ใช้/งาน/generation/ด้าน; retry หลังเครือข่ายกลับมาและหลัง reload โดยไม่ส่ง submission อัตโนมัติ
- เพิ่ม silent session refresh, self data copy, retention job, metadata ของ hash เมื่อ redact snapshot, สิทธิ์ห้ามแก้ snapshot/revision ผ่าน runtime role และการหมดอายุของเวลาประเมิน
- มี requestId, JSON request log, rate limit แบบ shared ผ่านฐานข้อมูล, error shape, security headers และปิดเส้นทาง Demo เมื่อเป็น production
- เก็บห้องเรียนเป็น read-only/นำกลับมาได้; นักศึกษาเปิด archive ได้เฉพาะผลของตนเอง
- แจ้งเตือนเมื่อเกณฑ์ชื่อเดียวกันมี agreement ต่ำติดต่อกัน; สัญญาณคุณภาพไม่หักคะแนนอัตโนมัติ
- เพิ่ม backup เข้ารหัสทุก 15 นาทีขณะ worker ทำงาน เก็บไฟล์ 7 วัน และทดสอบ restore ในฐานข้อมูลใหม่ที่แยกจากข้อมูลสาธิต
- แก้ contrast ในหน้าหลัก, radio/keyboard/aria-live, ชื่อปุ่มในสคริปต์ และ UTF-8 ของ PostgreSQL บน Windows

## ผลตรวจที่ทำจริง

| การตรวจ | ผล / ขอบเขต |
|---|---|
| Unit tests | 88/88, 22 files; รวม scoring golden example และ fast-check 100 cohorts สำหรับ INV-1..5 |
| ตรวจรับ v2.0 ใหม่ | 41/41 checkpoints จาก `scripts/prd-v20-acceptance.mjs` |
| Full System เดิม | 10/10 scripts ผ่านรอบล่าสุด: assignment, evaluation, score/export, withdrawal/review, instructor, notice, quality/timing, clean migrations, audit permissions, audit outcomes |
| Legacy Demo สำรอง | Main Flow 32/32 และ UI audit 36/36; ใช้ fresh seed สำหรับทดสอบและคืนฐานข้อมูลเดิมแล้ว |
| Build / types / lint | ผ่าน; ไม่มี lint warning ในรอบสุดท้ายก่อนส่งมอบ |
| Automated accessibility | 7 หน้าสาธิตไม่มี axe WCAG violations ที่เครื่องมือตรวจพบ; evaluation มี keyboard test และจอ 320 px |
| Browser engines | Chromium, Firefox, WebKit ผ่านกรณี evaluation; ยังไม่เท่ากับทดสอบทุกเวอร์ชันและทุกอุปกรณ์จริง |
| Presentation | เปลี่ยนบทบาท, เดินจาก Owner ไปงาน/รายงาน, ดาวน์โหลด CSV และเปิดผลงานผ่าน โดยบล็อกคำขอภายนอกทั้งหมด |
| Cold start | หยุด application/portal/jobs/PostgreSQL จริง แล้วเปิดใหม่; สมาชิก 16, คู่ 84, submissions 30, snapshot 1 และนักศึกษาสาธิตที่ยังไม่ส่งคงเดิม; เปิดซ้ำมี worker เพียงตัวเดียว |
| Restore | operational 35 tables และ audit 1 table; เทียบข้อมูลทุกแถวตรงกัน, ตรวจ tamper/กุญแจผิด, ประมาณ 2–3 วินาทีในชุดข้อมูลนี้ |
| Production dependencies | High 0, Critical 0; Moderate 2 ในสาย exceljs/uuid |
| Development dependencies | ยังมี High 5 รายการในสาย lint/fast-glob/micromatch/braces; ไม่ได้ force downgrade toolchain และไม่อ้างว่าปลอดช่องโหว่ทั้งหมด |

หลักฐานรอบนี้อยู่ใน `.verification/v20-20261015/`; logs เดิมที่มีทั้งรอบผิดพลาดและรอบแก้ผ่านอยู่ใน `.verification/hardening-20261015/` ให้ใช้ผลล่าสุดของแต่ละสคริปต์

## ผลโหลด 200 คน

เครื่องเดียวกันเป็นทั้ง client/server และฐานข้อมูล จึงเป็นผลวัดในเครื่อง ไม่ใช่ผลยืนยัน hosted production ใช้ Node load runner ไม่ใช่ k6 และวัด Evaluation API ไม่ใช่เวลาวาดหน้าเต็ม 200 browsers

| รายการ | ผลล่าสุด |
|---|---:|
| สร้างคู่ 200 คน, 40 กลุ่ม, 5 เกณฑ์ | 7,080 comparisons ใน 7.31 วินาที |
| 200 Evaluation API requests พร้อมกัน | p95 987.82 ms, p99 989.27 ms |
| Autosave ต่อเนื่อง 100 req/s จาก 200 บัญชี | p95 12.48 ms |
| Submit ต่อเนื่อง 100 req/s จาก 200 บัญชี | p95 13.89 ms |
| คำนวณใหม่ทั้งงาน | 307.75 ms |
| Autosave burst 200 requests ในทันที | p95 701.74 ms — **เกินเป้า 300 ms** |
| Submit burst 200 requests ในทันที | p95 924.10 ms — **เกินเป้า 800 ms** |

ไม่ควรนำผล continuous usage ไปกลบผล burst ที่ยังไม่ผ่าน

## ส่วนที่ยังต้องปิดก่อนอ้างว่าครบ PRD / ใช้จริง

1. **Google OIDC และระบบออนไลน์จริง:** ยังไม่มี credentials/deployment ของปลายทางให้ทดสอบ consent → callback กับ Google จริง รวมถึง HTTPS, secret manager, สิทธิ์ login ของ runtime และ isolated audit storage ในสภาพแวดล้อมนั้น
2. **Retention ของบัญชีที่เรียนต่อ:** anonymization ของบัญชีเก่าที่ไม่มีกิจกรรมและการลบ timing ทำงานและมีเทสต์ แต่ตัวตนในข้อมูลเก่าของบัญชีที่ยังใช้ในห้องเรียนใหม่ต้องแยกตามปี/งานเพิ่มเติม จึงยังไม่ปิด FR-PRIV-02 ทั้งหมด ปฏิทินเริ่ม 1 สิงหาคมเป็นค่าตั้งต้นที่ต้องให้รายวิชายืนยัน ทั้ง env และตาราง `privacy_retention_policy` ต้องตรงกัน
3. **QS-06:** คำนวณและทดสอบด้วยข้อมูลความสัมพันธ์ที่ประกาศว่าเป็นข้อมูลจำลองแล้ว แหล่งข้อมูลเพื่อนสนิทในรายวิชาจริงและการแจ้งการใช้ข้อมูลยังต้องกำหนด ห้ามอนุมานความสัมพันธ์ของนักศึกษาเอง
4. **NFR:** ยังไม่ผ่าน worst-case burst ทั้งสองเป้า, ยังไม่ทดสอบ 50 ห้องเต็มพร้อมกัน/10× traffic, uptime รายเดือน/ช่วงก่อนเส้นตาย, off-device backup และการส่ง alert ภายนอกอย่างต่อเนื่อง Worker ในเครื่องหยุดทำงานเมื่อโน้ตบุ๊กปิด
5. **Compatibility/accessibility:** ยังไม่มีสองเวอร์ชันล่าสุดทุก browser, iOS/Android จริง และการทดสอบ NVDA/VoiceOver แบบ manual; automated scan ไม่ใช่ใบรับรอง WCAG AA
6. **Should ที่เลื่อน:** export ขนาดใหญ่ยังเป็น synchronous แบบจำกัดขนาด และไม่มี mail-delivery service

ประเด็น PRD ที่ควรหารือกับอาจารย์: ห้องสองกลุ่มไม่มีนักศึกษาที่อยู่นอกคู่กลุ่ม ระบบบล็อกเพื่อรักษาข้อห้ามประเมินกลุ่มตนเอง; unpublish เก็บ generation/คำตอบเดิมเพื่อสอดคล้องกฎห้ามลบประวัติ แทนการลบ physical rows

## ขอบเขตการส่งมอบ

แก้ใน repository PairEval แยกที่ `D:\PairEval-Review-20261015` ไม่แก้หรืออัปเดต submodule ของ KMITL ไม่มีการ deploy, commit หรือ push ชุดส่งมอบเป็น source/patch ไม่รวม `.env.local`, session tokens, ฐานข้อมูล หรือกุญแจ backup

คำแนะนำในการนำเสนอ: บอกว่า “ฟังก์ชันหลักตาม v2.0 มีหลักฐานทดสอบและพร้อมสาธิตบนเครื่องนี้ พร้อมรายการข้อที่ยังต้องปิดก่อนใช้งานจริง” ไม่ควรบอกว่า “ผ่าน PRD ครบ 100%”
