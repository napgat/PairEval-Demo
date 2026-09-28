"use client";

import { useState } from "react";
import type { PairingPreview } from "@/lib/pairing-store";

export default function PairingPanel({ initial }: { initial: PairingPreview }) {
  const [preview, setPreview] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const criteria = [...new Map(preview.pairs.map(pair => [pair.criterionId, { id: pair.criterionId, name: pair.criterionName, kind: pair.kind }])).values()];

  async function generate() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/assignments/${preview.assignmentId}/pairings`, { method: "POST" });
      const result = await response.json() as { preview?: PairingPreview; error?: string; result?: string };
      if (result.preview) setPreview(result.preview);
      setMessage(response.ok ? "บันทึกคู่ทั้งหมดของงานเรียบร้อยแล้ว" : result.error ?? "ยังไม่บันทึกคู่: กรุณาดูเหตุผลและรีเฟรชหน้า");
    } catch { setMessage("เชื่อมต่อ server ไม่สำเร็จ ไม่มีการยืนยันว่าบันทึกคู่แล้ว กรุณารีเฟรชเพื่อตรวจสถานะ"); }
    finally { setBusy(false); }
  }

  return <div className="pairing-panel">
    <div className="pairing-stats"><div><span>เป้าหมายต่อคู่</span><strong>{preview.target}</strong></div><div><span>คู่ × เกณฑ์ทั้งหมด</span><strong>{preview.totalPairs}</strong></div><div><span>ผลประเมินที่จะมอบหมาย</span><strong>{preview.plannedAssignments}</strong></div><div><span>มอบหมายจริงแล้ว</span><strong>{preview.actualAssignments}</strong></div></div>
    <div className={`pairing-state ${preview.status}`}><strong>{preview.status === "ready" ? "พร้อมสร้างคู่" : preview.status === "generated" ? "สร้างคู่ครบแล้ว" : preview.status === "infeasible" ? "จัดคู่ไม่ได้" : "มีข้อมูลคู่ที่ไม่ครบ"}</strong><p>{preview.status === "ready" ? "ตรวจผู้ประเมินที่มีสิทธิ์ครบทุกคู่แล้ว การกดบันทึกจะสร้างทั้งงานพร้อมกัน" : preview.status === "generated" ? "คอลัมน์ Actual แสดงจำนวนคู่ที่บันทึกจริงในฐานข้อมูล" : "ไม่มีการบันทึกคู่บางส่วนจากการ preview นี้"}</p></div>
    {preview.issues.length > 0 && <div className="error-box" role="alert"><strong>เหตุผลที่ไม่สามารถสร้างคู่ครบทั้งงาน</strong><ul>{preview.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul></div>}
    {message && <p className="notice" role="status">{message}</p>}
    {preview.status === "ready" && <button className="primary-button" disabled={busy} onClick={generate}>{busy ? "กำลังบันทึก..." : "บันทึกคู่ทั้งหมดของงาน"}</button>}
    {criteria.map(criterion => <section className="panel" key={criterion.id}><h2>{criterion.kind === "group" ? "Group" : "Individual"}: {criterion.name}</h2><div className="table-wrap"><table className="coverage-table"><thead><tr><th>คู่</th><th>ผู้ประเมินที่มีสิทธิ์</th><th>Target</th><th>Preview</th><th>Actual</th></tr></thead><tbody>{preview.pairs.filter(pair => pair.criterionId === criterion.id).map(pair => <tr key={`${pair.itemAId}/${pair.itemBId}`}><td>{pair.itemAName} ↔ {pair.itemBName}</td><td>{pair.eligibleCount}</td><td>{pair.target}</td><td>{pair.planned}</td><td className={pair.actual >= pair.target ? "covered" : "uncovered"}>{pair.actual}</td></tr>)}</tbody></table></div></section>)}
    <details className="panel"><summary>จำนวนงานต่อผู้ประเมิน ({preview.workloads.length} คน)</summary><div className="table-wrap"><table className="coverage-table"><thead><tr><th>ผู้ประเมิน</th><th>Preview</th><th>Actual</th></tr></thead><tbody>{preview.workloads.map(person => <tr key={person.evaluatorId}><td>{person.name}</td><td>{person.planned}</td><td>{person.actual}</td></tr>)}</tbody></table></div></details>
  </div>;
}
