"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EvaluationView } from "@/lib/evaluation-store";

const scale = [
  "ซ้ายดีกว่ามาก", "ซ้ายดีกว่า", "ซ้ายดีกว่าเล็กน้อย",
  "ขวาดีกว่าเล็กน้อย", "ขวาดีกว่า", "ขวาดีกว่ามาก",
];

function remainingText(deadline: string, now: number) {
  const remaining = Date.parse(deadline) - now;
  if (remaining <= 0) return "ปิดรับคำตอบแล้ว";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `เหลือ ${days} วัน ${hours} ชั่วโมง ${minutes} นาที`;
}

export default function EvaluationPanel({ initial }: { initial: EvaluationView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, number | null>>(initial.answers);
  const [now, setNow] = useState(() => Date.parse(initial.serverNow));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const closed = view.isClosed || now >= Date.parse(view.deadline);
  const answered = Object.values(answers).filter(choice => choice !== null).length;
  const criteria = [...new Map(view.pairs.map(pair => [pair.criterionId, pair.criterionName])).entries()];

  async function save(action: "draft" | "submit") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/assignments/${view.assignmentId}/evaluation/${view.kind}`, {
        method: action === "draft" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const result = await response.json() as EvaluationView & { error?: string };
      if (!response.ok) { setError(result.error ?? "บันทึกไม่สำเร็จ"); setNow(Date.now()); return; }
      setView(result); setAnswers(result.answers); setNow(Date.parse(result.serverNow));
      router.refresh();
      setMessage(action === "draft" ? "บันทึกร่างแล้ว กลับมาเปิดหน้านี้ข้อมูลจะยังอยู่" : `ส่งคำตอบ revision ${result.revisionNumber} แล้ว`);
    } catch { setError("เชื่อมต่อ server ไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }

  if (!view.pairs.length) return <section className="panel"><h2>ยังไม่มีคู่ที่ได้รับมอบหมาย</h2><p>ผู้สอนต้องสร้างคู่ของงานนี้ก่อน จึงจะเริ่มประเมินได้</p></section>;

  return <div className="evaluation-panel">
    <div className="evaluation-summary"><div><span>ความคืบหน้า</span><strong>{answered} / {view.totalCount} คู่</strong></div><div><span>กำหนดส่ง</span><strong>{new Date(view.deadline).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</strong><small>{remainingText(view.deadline, now)}</small></div></div>
    <div className="evaluation-status"><strong>{view.kind === "group" ? "Group Evaluation" : "Individual Evaluation"}</strong><p>{view.latestSubmittedAt ? `ส่งล่าสุด revision ${view.revisionNumber}: ${new Date(view.latestSubmittedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}` : "ยังไม่เคย Submit"}</p>{view.draftSavedAt && <p>ร่างล่าสุด: {new Date(view.draftSavedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>}</div>
    {criteria.map(([criterionId, criterionName]) => {
      const pairs = view.pairs.filter(pair => pair.criterionId === criterionId);
      const count = pairs.filter(pair => answers[pair.id] !== null).length;
      return <section className="criterion-section" key={criterionId}><div className="criterion-heading"><h2>{criterionName}</h2><span>{count} / {pairs.length} คู่</span></div>{pairs.map((pair, index) => <fieldset className="evaluation-pair" key={pair.id} disabled={closed || busy}><legend>คู่ {index + 1}: {pair.itemAName} เทียบกับ {pair.itemBName}</legend><div className="candidate-labels"><strong>{pair.itemAName}</strong><span>เทียบกับ</span><strong>{pair.itemBName}</strong></div><div className="rating-options">{scale.map((label, scaleIndex) => <label key={scaleIndex}><input type="radio" name={pair.id} value={scaleIndex + 1} checked={answers[pair.id] === scaleIndex + 1} onChange={() => setAnswers(previous => ({ ...previous, [pair.id]: scaleIndex + 1 }))} /><span className="rating-number">{scaleIndex + 1}</span><small>{label}</small></label>)}</div><button type="button" className="clear-choice" disabled={closed || busy || answers[pair.id] === null} onClick={() => setAnswers(previous => ({ ...previous, [pair.id]: null }))}>ล้างคำตอบคู่นี้</button></fieldset>)}</section>;
    })}
    {answered < view.totalCount && <p className="evaluation-warning">ยังไม่ได้ตอบ {view.totalCount - answered} คู่ · Submit บางส่วนได้; คะแนนของผู้ส่งจะคิดตามสัดส่วนคู่ที่ตอบ</p>}
    {error && <p className="error-box" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <div className="actions"><button type="button" className="secondary-button" onClick={() => save("draft")} disabled={closed || busy}>Save draft</button><button type="button" className="primary-button" onClick={() => save("submit")} disabled={closed || busy || answered === 0}>{view.revisionNumber ? "Re-submit" : "Submit"}</button></div>
    {closed && <p className="evaluation-warning">เลยกำหนดส่งแล้ว เปิดดูคำตอบได้ แต่ Save และ Submit ไม่ได้</p>}
  </div>;
}
