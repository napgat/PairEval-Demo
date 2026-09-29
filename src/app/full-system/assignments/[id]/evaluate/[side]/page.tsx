"use client";
import { use, useEffect, useRef, useState } from "react";

type Pair = { id: string; criterionId: string; leftName: string; rightName: string;
  leftArtifactUrl: string | null; rightArtifactUrl: string | null; choice: number | null };
type Evaluation = { assignmentId: string; side: string; timezone: string; deadline: string | null;
  readOnly: boolean; criteria: Array<{ id: string; name: string; description: string | null }>;
  pairs: Pair[]; latestSubmission: { revision: number; submittedAt: string } | null;
  draftSavedAt: string | null; disabledReason: string | null };
const labels = ["ซ้ายดีกว่ามาก", "ซ้ายดีกว่า", "ซ้ายดีกว่าเล็กน้อย", "ขวาดีกว่าเล็กน้อย", "ขวาดีกว่า", "ขวาดีกว่ามาก"];

export default function EvaluationPage({ params }: { params: Promise<{ id: string; side: string }> }) {
  const { id, side } = use(params);
  const path = `/api/full-system/assignments/${id}/evaluation/${side}`;
  const [data, setData] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(new Map<string, number | null>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = async () => {
    const response = await fetch(path, { cache: "no-store" }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "โหลดงานไม่สำเร็จ");
    setData(payload.data);
  };
  useEffect(() => { let active = true; (async () => { try {
    const response = await fetch(path, { cache: "no-store" }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "โหลดงานไม่สำเร็จ");
    if (active) setData(payload.data);
  } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "โหลดงานไม่สำเร็จ"); } })();
    return () => { active = false; if (timer.current) clearTimeout(timer.current); }; }, [path]);
  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    const updates = [...pending.current]; pending.current.clear();
    if (!updates.length) return;
    setSaving(true);
    try { for (const [pairId, choice] of updates) {
      const response = await fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairId, choice }) }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "บันทึกไม่สำเร็จ");
    }
      setMessage(`บันทึกแล้ว เมื่อ ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      for (const [pairId, choice] of updates) pending.current.set(pairId, choice);
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
      throw error;
    } finally { setSaving(false); }
  };
  const answer = (pairId: string, choice: number | null) => {
    if (!data || data.readOnly) return;
    setData(current => current && ({ ...current, pairs: current.pairs.map(pair =>
      pair.id === pairId ? { ...pair, choice } : pair) }));
    pending.current.set(pairId, choice);
    setMessage("กำลังบันทึก…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, 500);
  };
  const submit = async () => {
    if (!data) return;
    const missing = data.pairs.filter(pair => pair.choice === null).length;
    if (!window.confirm(`ยังไม่ตอบ ${missing} คู่จาก ${data.pairs.length} คู่ ยืนยันส่งคำตอบที่มีหรือไม่?`)) return;
    setBusy(true);
    try { await flush();
      const response = await fetch(path, { method: "POST" }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "ส่งไม่สำเร็จ");
      await load(); setMessage(`ส่งคำตอบรุ่น ${payload.data.revision} แล้ว (${payload.data.answered}/${payload.data.assigned})`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "ส่งไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const answered = data?.pairs.filter(pair => pair.choice !== null).length ?? 0;
  return <main className="assignment-shell"><p><a href="/full-system">← ห้องเรียน</a></p>
    <span className="eyebrow">PairEval Full System · FS08–FS09</span>
    <h1>{side === "group" ? "ประเมินผลงานกลุ่ม" : "ประเมินรายบุคคล"}</h1>
    {message && <p className="notice" role="status">{message}</p>}
    {!data ? <p>กำลังโหลด…</p> : <>
      <p className="lead">ตอบแล้ว {answered}/{data.pairs.length} · {data.readOnly ? "พ้นกำหนดส่ง: อ่านอย่างเดียว" : "ระบบบันทึกฉบับร่างอัตโนมัติ"}</p>
      <p className="fine-print">ครบกำหนด {data.deadline ? new Date(data.deadline).toLocaleString("th-TH", { timeZone: data.timezone }) : "ไม่กำหนด"} ({data.timezone})</p>
      <p className="fine-print">คะแนนส่วนตัวใช้คะแนนจากงานของคุณร่วมกับอัตราการส่งคำตอบ p และตัวคูณ M; draft ยังไม่ถูกนำไปคำนวณ</p>
      {data.latestSubmission && <p className="notice">ส่งล่าสุดรุ่น {data.latestSubmission.revision} · ส่งซ้ำได้ก่อนครบกำหนด</p>}
      {data.disabledReason && <p className="notice">{data.disabledReason}</p>}
      {data.criteria.map(criterion => <section className="criterion-section" key={criterion.id}>
        <div className="criterion-heading"><h2>{criterion.name}</h2><span>{data.pairs.filter(pair => pair.criterionId === criterion.id && pair.choice !== null).length} / {data.pairs.filter(pair => pair.criterionId === criterion.id).length}</span></div>
        {criterion.description && <p>{criterion.description}</p>}
        {data.pairs.filter(pair => pair.criterionId === criterion.id).map(pair => <fieldset className="evaluation-pair" key={pair.id}>
          <legend>เลือกหนึ่งคำตอบสำหรับคู่นี้</legend><div className="candidate-labels">
            <strong>{pair.leftName}<br />{pair.leftArtifactUrl ? <a href={pair.leftArtifactUrl} target="_blank" rel="noopener noreferrer">ดูผลงาน ↗</a> : <small>อาจารย์ยังไม่ได้ระบุผลงาน</small>}</strong>
            <span>เทียบกับ</span><strong>{pair.rightName}<br />{pair.rightArtifactUrl ? <a href={pair.rightArtifactUrl} target="_blank" rel="noopener noreferrer">ดูผลงาน ↗</a> : <small>อาจารย์ยังไม่ได้ระบุผลงาน</small>}</strong>
          </div><div className="rating-options">{labels.map((label, index) => <label key={index}>
            <input type="radio" name={pair.id} checked={pair.choice === index + 1} disabled={data.readOnly || busy}
              onChange={() => answer(pair.id, index + 1)} aria-label={`${index + 1} ${label}`} />
            <span className="rating-number">{index + 1}</span><small>{label}</small></label>)}</div>
          {!data.readOnly && <button className="clear-choice" type="button" onClick={() => answer(pair.id, null)}>ล้างคำตอบ</button>}
        </fieldset>)}
      </section>)}
      {!data.readOnly && <button className="primary-button" disabled={busy || saving || answered === 0} onClick={submit}>ส่งคำตอบ{data.latestSubmission ? "อีกครั้ง" : ""}</button>}
      <p><a className="text-link" href={`/full-system/assignments/${id}/my-score`}>ดูคะแนนของฉัน →</a></p>
    </>}
  </main>;
}
