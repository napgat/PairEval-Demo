import { mkdir, writeFile } from "node:fs/promises";
const dir = "public/demo-artifacts";
await mkdir(dir, { recursive: true });
const topics = [
  "ระบบวัดคุณภาพน้ำ",
  "กระดานติดตามงานซ่อม",
  "ระบบจองห้องอ่านหนังสือ",
  "ระบบติดตามการคัดแยกขยะ",
];
const document = (title, body) =>
  `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:18px/1.8 system-ui,sans-serif;color:#233f43;background:#f2f7f6;max-width:900px;margin:40px auto;padding:24px}article{padding:32px;background:white;border:1px solid #c9dcd7;border-radius:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bacfc9;padding:12px;text-align:left}a{color:#075d55}small{color:#49635e}</style><main><small>PairEval · ผลงานจำลองเพื่อการสาธิต ไม่มีข้อมูลนักศึกษาจริง</small><article><h1>${title}</h1>${body}</article><p><a href="/demo-artifacts/index.html">ดูผลงานจำลองทั้งหมด</a></p></main></html>`;
for (let g = 1; g <= 4; g++)
  await writeFile(
    `${dir}/group-${g}.html`,
    document(
      `กลุ่ม ${g} — ${topics[g - 1]}`,
      `<h2>ปัญหาและกลุ่มผู้ใช้</h2><p>ต้นแบบช่วยให้ผู้ดูแลและผู้ใช้ติดตามสถานะ ${topics[g - 1]} ผ่านหน้าจอเดียว ใช้ข้อมูลที่สร้างขึ้นเพื่อทดสอบเท่านั้น</p><h2>ขอบเขตที่นำเสนอ</h2><ul><li>เพิ่มรายการและตรวจข้อมูลที่จำเป็น</li><li>ค้นหาและกรองสถานะล่าสุด</li><li>บันทึกผู้รับผิดชอบและประวัติการเปลี่ยนแปลง</li></ul><h2>หลักฐานจำลองของกลุ่ม</h2><table><tr><th>รายการ</th><th>ผลการทดลอง</th></tr><tr><td>กรณีใช้งานที่สาธิต</td><td>${g + 3} ขั้นตอน</td></tr><tr><td>กรณีผิดพลาดที่ตรวจ</td><td>${7 - g} กรณี</td></tr><tr><td>ข้อจำกัดที่แจ้ง</td><td>${g} ประเด็น</td></tr></table><p>คำอธิบายนี้เป็นชิ้นงานตัวอย่างสำหรับทดลองเปรียบเทียบคุณภาพและความชัดเจนของการนำเสนอ ตัวเลขทั้งหมดเป็นข้อมูลจำลอง</p>`,
    ),
  );
const duties = [
  "ออกแบบกรณีใช้งานและรับฟังความต้องการ",
  "พัฒนาหน้าจอและตรวจการใช้งานบนมือถือ",
  "จัดการข้อมูลและตรวจความถูกต้อง",
  "เตรียมชุดทดสอบและสรุปข้อจำกัด",
];
for (let i = 1; i <= 16; i++)
  await writeFile(
    `${dir}/student-${i}.html`,
    document(
      `ผลงานรายบุคคล — นักศึกษาจำลอง ${i}`,
      `<p>กลุ่ม ${Math.floor((i - 1) / 4) + 1} · ${topics[Math.floor((i - 1) / 4)]}</p><h2>บทบาทที่รับผิดชอบ</h2><p>${duties[(i - 1) % 4]}</p><h2>หลักฐานความร่วมมือ</h2><ul><li>ส่งมอบงานตามรายการที่ตกลง ${2 + (i % 4)} รายการ</li><li>ร่วมทบทวนงานกับสมาชิก ${1 + (i % 3)} รอบ</li><li>บันทึกปัญหาและข้อเสนอแนะให้ทีมตรวจสอบได้</li></ul><p>ใช้ข้อมูลนี้ประกอบการทดลองหน้าประเมินรายบุคคลเท่านั้น ไม่มีบุคคลจริงหรือคะแนนจริง</p>`,
    ),
  );
await writeFile(
  `${dir}/index.html`,
  document(
    "คลังผลงานจำลอง PairEval",
    `<h2>ผลงานกลุ่ม</h2><ul>${topics.map((t, i) => `<li><a href="group-${i + 1}.html">กลุ่ม ${i + 1}: ${t}</a></li>`).join("")}</ul><h2>ผลงานรายบุคคล</h2><ul>${Array.from({ length: 16 }, (_, i) => `<li><a href="student-${i + 1}.html">นักศึกษาจำลอง ${i + 1}</a></li>`).join("")}</ul>`,
  ),
);
console.log("Prepared 4 group and 16 individual synthetic artifacts");
