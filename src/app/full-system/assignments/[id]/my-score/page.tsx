"use client";
import { use, useEffect, useState } from "react";
type Score = { label: string; groupComponent: number | null; individualComponent: number | null;
  groupStatus: string; individualStatus: string; total: number | null; p: number; M: number;
  answered: number; assigned: number; lowConfidence: boolean };
export default function MyScore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; (async () => { try {
    const response = await fetch(`/api/full-system/assignments/${id}/my-score`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.code ?? "โหลดคะแนนไม่สำเร็จ");
    if (active) setScore(payload.data);
  } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "โหลดคะแนนไม่สำเร็จ"); } })();
    return () => { active = false; }; }, [id]);
  const show = (value: number | null) => value === null ? "NO_DATA" : value.toFixed(2);
  return <main className="assignment-shell"><p><a href="/full-system">← ห้องเรียน</a></p>
    <span className="eyebrow">PairEval Full System · FS10</span><h1>คะแนนของฉัน</h1>
    {error && <p className="error-box" role="alert">{error}</p>}
    {!score ? <p>กำลังโหลด…</p> : <><p className="notice">{score.label}</p>
      <div className="score-cards"><div><span>ส่วนกลุ่ม</span><strong>{show(score.groupComponent)}</strong></div>
        <div><span>ส่วนรายบุคคล</span><strong>{score.individualStatus === "INSUFFICIENT_DATA" ? "ยังมีข้อมูลไม่พอ" : show(score.individualComponent)}</strong></div>
        <div><span>คะแนนของฉัน</span><strong>{show(score.total)}</strong></div></div>
      <p>ส่งคำตอบแล้ว {score.answered}/{score.assigned} · p = {score.p.toFixed(3)} · M = {score.M.toFixed(3)}</p>
      {score.lowConfidence && <p className="notice">ข้อมูลบางเกณฑ์มีจำนวน comparison ต่ำกว่าเกณฑ์ จึงยังมีความเชื่อมั่นต่ำ</p>}
      <p className="fine-print">หน้านี้แสดงเฉพาะค่าปัจจุบันของบัญชีนี้ ไม่มีชื่อผู้ประเมินหรือประวัติการเปลี่ยนคะแนน</p>
    </>}
  </main>;
}
