"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { appealStatus, friendlyError } from "@/lib/full-system-ui";

type Score = { label: string; groupComponent: number | null; individualComponent: number | null;
  status: string; groupStatus: string; individualStatus: string; total: number | null; p: number; M: number;
  answered: number; assigned: number; lowConfidence: boolean };
type Appeal = { id: string; message: string; status: string; resolution: string | null };
export default function MyScore({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{classroom?:string}> }) {
  const { id } = use(params), { classroom } = use(searchParams);
  const [score, setScore] = useState<Score | null>(null), [error, setError] = useState("");
  const [appeals, setAppeals] = useState<Appeal[]>([]), [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState(""), [sending, setSending] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { let active = true; (async () => { try {
    const response = await fetch(`/api/full-system/assignments/${id}/my-score`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.code ?? "โหลดคะแนนไม่สำเร็จ");
    const appealResponse = await fetch(`/api/full-system/assignments/${id}/appeals`, { cache: "no-store" });
    const appealPayload = await appealResponse.json();
    if (active) { setScore(payload.data); if (appealResponse.ok) { setAppeals(appealPayload.data.appeals); setAppealOpen(appealPayload.data.windowOpen); } }
  } catch (failure) { if (active) setError(friendlyError(failure)); } })(); return () => { active = false; }; }, [id]);
  const show = (value: number | null) => value === null ? "รอผลประเมิน" : value.toFixed(2);
  const submitAppeal = async () => {
    if (sending) return;
    setSending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/full-system/assignments/${id}/appeals`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify({ message: appealText }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "ส่งอุทธรณ์ไม่สำเร็จ");
      const refreshed = await fetch(`/api/full-system/assignments/${id}/appeals`, { cache: "no-store" });
      const list = await refreshed.json();
      if (refreshed.ok) setAppeals(list.data.appeals);
      setAppealText(""); setMessage("ส่งคำขอทบทวนคะแนนแล้ว คุณติดตามคำตอบจากอาจารย์ได้ที่หน้านี้");
    } catch (failure) { setError(friendlyError(failure)); } finally { setSending(false); }
  };
  const final = score?.status === "FINAL";
  return <main className="fs-page fs-score-page">
    <Link className="fs-back-link" href={classroom ? `/full-system/classrooms/${encodeURIComponent(classroom)}/work` : "/full-system"}>← กลับไป{classroom ? "งานประเมิน" : "หน้าห้องเรียน"}</Link>
    <header className="fs-page-heading"><div><span className="eyebrow">ผลการประเมินส่วนตัว</span><h1>คะแนนของฉัน</h1>
      <p>ดูผลคะแนนและติดตามคำขอทบทวน โดยไม่เปิดเผยชื่อผู้ประเมิน</p></div></header>
    {error && <p className="error-box" role="alert">{error}</p>}
    {!score && !error ? <div className="fs-loading-card" role="status">กำลังโหลดคะแนนของคุณ…</div> : score && <>
      <div className={`fs-score-state ${final ? "is-final" : ""}`}>{final ? <CheckCircle2 size={20} aria-hidden="true" /> : <Clock3 size={20} aria-hidden="true" />}
        <div><strong>{final ? "อาจารย์ยืนยันคะแนนแล้ว" : "คะแนนระหว่างดำเนินงาน"}</strong><p>{final ? "หากมีข้อสงสัย สามารถขอให้อาจารย์ทบทวนคะแนนได้ด้านล่าง" : "คะแนนอาจเปลี่ยนได้ เมื่อมีคำตอบเพิ่มเติมหรืออาจารย์ทบทวนผล"}</p></div></div>
      <div className="score-cards"><div><span>คะแนนกลุ่ม</span><strong>{show(score.groupComponent)}</strong><small>ผลประเมินของกลุ่มคุณ</small></div>
        <div><span>คะแนนรายบุคคล</span><strong>{score.individualStatus === "INSUFFICIENT_DATA" ? "ข้อมูลยังไม่พอ" : score.individualStatus === "DISABLED" ? "ไม่ใช้ในงานนี้" : show(score.individualComponent)}</strong><small>ผลประเมินรายบุคคลของคุณ</small></div>
        <div className="fs-total-score"><span>คะแนนรวม</span><strong>{show(score.total)}</strong><small>{final ? "คะแนนที่ยืนยันแล้ว" : "คะแนน ณ ขณะนี้"}</small></div></div>
      <p className="fs-score-progress">ส่งคำตอบแล้ว <strong>{score.answered} จาก {score.assigned} คู่</strong></p>
      {score.lowConfidence && <p className="notice">บางเกณฑ์มีคำตอบน้อย ผลคะแนนอาจยังไม่สะท้อนภาพรวมทั้งหมด</p>}
      <details className="fs-score-explainer"><summary>คะแนนนี้คำนวณอย่างไร</summary>
        <p>คะแนนรวมมาจากผลประเมินกลุ่มและรายบุคคล ร่วมกับสัดส่วนงานประเมินที่คุณยืนยันส่ง ฉบับร่างยังไม่นับเป็นงานที่ส่ง</p>
        <p className="fine-print">สัดส่วนการส่ง (p) = {score.p.toFixed(3)} · ตัวคูณการมีส่วนร่วม (M) = {score.M.toFixed(3)}</p>
      </details>
      {final && <section className="form-panel fs-appeals-panel"><h2>ขอทบทวนคะแนน</h2>
        <p className="fs-muted-copy">แจ้งประเด็นที่สงสัยพร้อมเหตุผล เพื่อให้อาจารย์ตรวจสอบและตอบกลับ</p>
        {message && <p className="notice" role="status">{message}</p>}
        {appealOpen && !appeals.some(row => row.status === "OPEN") ? <>
          <label className="field">เหตุผลอุทธรณ์<textarea value={appealText} onChange={e=>setAppealText(e.target.value)} minLength={20} maxLength={4000}
            aria-describedby="appeal-help" placeholder="ระบุส่วนที่ต้องการให้ทบทวน และข้อมูลหรือหลักฐานประกอบ" /></label>
          <p id="appeal-help" className="field-help">อย่างน้อย 20 ตัวอักษร · ยื่นได้ภายใน 7 วันหลังอาจารย์ยืนยันคะแนน</p>
          <button className="primary-button" disabled={sending || appealText.trim().length < 20} onClick={submitAppeal}>{sending ? "กำลังส่งคำขอ…" : "ส่งคำขอทบทวนคะแนน"}</button>
        </> : <p className="fs-muted-copy">{appeals.some(row=>row.status === "OPEN") ? "ส่งคำขอแล้ว กรุณารออาจารย์พิจารณา" : "พ้นช่วงเวลายื่นคำขอทบทวนคะแนนแล้ว"}</p>}
        {appeals.length > 0 && <div className="fs-appeal-history"><h3>ประวัติคำขอของฉัน</h3>{appeals.map(row=><article className="fs-appeal-item" key={row.id}>
          <span className={`fs-status-badge ${row.status === "OPEN" ? "is-pending" : "is-open"}`}>{appealStatus(row.status)}</span>
          <p>{row.message}</p>{row.resolution && <div className="fs-appeal-response"><strong>คำตอบจากอาจารย์</strong><p>{row.resolution}</p></div>}
        </article>)}</div>}
      </section>}
    </>}
  </main>;
}
