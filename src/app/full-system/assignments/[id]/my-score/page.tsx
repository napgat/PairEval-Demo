"use client";
import { use, useEffect, useState } from "react";
type Score = { label: string; groupComponent: number | null; individualComponent: number | null;
  status: string; groupStatus: string; individualStatus: string; total: number | null; p: number; M: number;
  answered: number; assigned: number; lowConfidence: boolean };
type Appeal = { id: string; message: string; status: string; resolution: string | null };
export default function MyScore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState("");
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  useEffect(() => { let active = true; (async () => { try {
    const response = await fetch(`/api/full-system/assignments/${id}/my-score`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.code ?? "โหลดคะแนนไม่สำเร็จ");
    const appealResponse = await fetch(`/api/full-system/assignments/${id}/appeals`, { cache: "no-store" });
    const appealPayload = await appealResponse.json();
    if (active) { setScore(payload.data);
      if (appealResponse.ok) { setAppeals(appealPayload.data.appeals); setAppealOpen(appealPayload.data.windowOpen); } }
  } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "โหลดคะแนนไม่สำเร็จ"); } })();
    return () => { active = false; }; }, [id]);
  const show = (value: number | null) => value === null ? "ยังมีข้อมูลไม่พอ" : value.toFixed(2);
  const submitAppeal = async () => {
    setError("");
    try {
      const response = await fetch(`/api/full-system/assignments/${id}/appeals`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ message: appealText }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "ส่งอุทธรณ์ไม่สำเร็จ");
      const refreshed = await fetch(`/api/full-system/assignments/${id}/appeals`, { cache: "no-store" });
      const list = await refreshed.json(); if (refreshed.ok) setAppeals(list.data.appeals);
      setAppealText("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "ส่งอุทธรณ์ไม่สำเร็จ"); }
  };
  return <main className="fs-page fs-score-page">
    <a className="fs-back-link" href="/full-system"><span aria-hidden="true">←</span> กลับไปหน้าห้องเรียน</a>
    <header className="fs-page-heading"><div><span className="eyebrow">พื้นที่นักศึกษา · ผลคะแนนส่วนตัว</span>
      <h1>คะแนนของฉัน</h1><p>แสดงเฉพาะผลของบัญชีนี้ โดยไม่เปิดเผยว่าใครเป็นผู้ประเมิน</p></div>
      <span className="fs-student-mark" aria-hidden="true">◉</span></header>
    {error && <p className="error-box" role="alert">{error}</p>}
    {!score ? <div className="fs-loading-card" role="status">กำลังโหลดคะแนนของคุณ…</div> : <><p className="notice fs-score-status">{score.label}</p>
      <div className="score-cards"><div><span>ส่วนกลุ่ม</span><strong>{show(score.groupComponent)}</strong><small>คะแนนจากการประเมินผลงานกลุ่ม</small></div>
        <div><span>ส่วนรายบุคคล</span><strong>{score.individualStatus === "INSUFFICIENT_DATA" ? "ยังมีข้อมูลไม่พอ" : show(score.individualComponent)}</strong></div>
        <div className="fs-total-score"><span>คะแนนรวมของฉัน</span><strong>{show(score.total)}</strong><small>ค่าปัจจุบันตามข้อมูลที่ส่งแล้ว</small></div></div>
      <p className="fs-score-progress">ส่งคำตอบแล้ว <strong>{score.answered}/{score.assigned}</strong> คู่</p>
      {score.lowConfidence && <p className="notice">ข้อมูลบางเกณฑ์มีจำนวน comparison ต่ำกว่าเกณฑ์ จึงยังมีความเชื่อมั่นต่ำ</p>}
      <details className="fs-score-explainer"><summary>อ่านรายละเอียดคะแนน</summary>
        <p>ค่า p คืออัตราการส่งคำตอบ และ M คือตัวคูณการมีส่วนร่วม คะแนนอาจเปลี่ยนได้จนกว่าอาจารย์จะยืนยันผล</p>
        <p className="fine-print">p = {score.p.toFixed(3)} · M = {score.M.toFixed(3)} · หน้านี้ไม่แสดงชื่อผู้ประเมินหรือประวัติการเปลี่ยนคะแนน</p>
      </details>
      {score.status === "FINAL" && <section className="form-panel"><h2>อุทธรณ์คะแนน</h2>
        {appealOpen && !appeals.some(row => row.status === "OPEN") && <><p>ยื่นได้ภายใน 7 วันหลัง Finalize</p>
          <label className="field">เหตุผลอุทธรณ์<textarea value={appealText} onChange={e => setAppealText(e.target.value)} /></label>
          <button className="primary-button" disabled={appealText.trim().length < 20} onClick={submitAppeal}>ส่งอุทธรณ์</button></>}
        {appeals.map(row => <p key={row.id}>{row.status}: {row.message}{row.resolution ? ` · คำตอบ: ${row.resolution}` : ""}</p>)}
      </section>}
    </>}
  </main>;
}
