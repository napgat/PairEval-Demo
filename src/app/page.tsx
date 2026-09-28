import { readDemoSnapshot } from "@/lib/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  const seeded = readDemoSnapshot() !== null;
  return <main className="home-shell">
    <div className="home-card">
      <span className="eyebrow">PAIRWISE EVALUATION · COURSE DEMO</span>
      <h1>PairEval</h1>
      <p className="lead">พื้นที่สาธิตการประเมินแบบเปรียบเทียบคู่ แยกจากรีโป Lab 07 และใช้ข้อมูลสังเคราะห์เท่านั้น</p>
      <div className="notice">{seeded ? "ข้อมูลตัวอย่างพร้อมแล้ว · วันที่ 3: สร้างห้อง งาน และคู่ประเมินได้" : "ยังไม่มีข้อมูลตัวอย่าง กรุณารัน npm run seed ก่อน"}</div>
      <div className="role-grid">
        <form action="/api/demo/session" method="post" className="role-card"><input type="hidden" name="role" value="instructor" /><span>01 / ผู้สอน</span><strong>สร้างห้องและงานประเมิน</strong><small>บัญชีตัวอย่าง instructor@demo.invalid</small><button type="submit" className="primary-button" disabled={!seeded}>เข้า Demo ผู้สอน →</button></form>
        <form action="/api/demo/session" method="post" className="role-card"><input type="hidden" name="role" value="student" /><span>02 / นักศึกษา</span><strong>ดูงานของตน</strong><small>บัญชีตัวอย่าง student-01@demo.invalid</small><button type="submit" className="primary-button" disabled={!seeded}>เข้า Demo นักศึกษา →</button></form>
      </div>
      <p className="fine-print">Demo นี้เลือกบัญชีตัวอย่างได้โดยไม่ต้องใช้รหัสผ่าน ระบบใช้ session เพื่อแยกสิทธิ์ระหว่างสองบทบาท แต่ยังไม่ใช่การยืนยันตัวตนสำหรับข้อมูลจริง</p>
    </div>
  </main>;
}
