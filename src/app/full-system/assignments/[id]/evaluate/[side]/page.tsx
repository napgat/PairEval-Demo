"use client";
import { queueKey, readQueuedAnswers } from "@/lib/evaluation-queue";
import { use, useEffect, useRef, useState } from "react";
import { installSyntheticTiming } from "@/lib/full-system-active-clock";

type Pair = { id: string; criterionId: string; leftName: string; rightName: string;
  leftArtifactUrl: string | null; rightArtifactUrl: string | null; choice: number | null };
type Evaluation = { assignmentId: string; side: string; viewerId: string; generation: number; timezone: string; deadline: string | null;
  readOnly: boolean; syntheticTimingEnabled?: boolean; criteria: Array<{ id: string; name: string; description: string | null }>;
  pairs: Pair[]; latestSubmission: { revision: number; submittedAt: string } | null;
  draftSavedAt: string | null; disabledReason: string | null };
const labels = ["ซ้ายดีกว่ามาก", "ซ้ายดีกว่า", "ซ้ายดีกว่าเล็กน้อย", "ขวาดีกว่าเล็กน้อย", "ขวาดีกว่า", "ขวาดีกว่ามาก"];

export default function EvaluationPage({ params, searchParams }: {
  params: Promise<{ id: string; side: string }>;
  searchParams: Promise<{ classroom?: string }>;
}) {
  const { id, side } = use(params);
  const { classroom } = use(searchParams);
  const returnHref = classroom ? `/full-system/classrooms/${encodeURIComponent(classroom)}/work` : "/full-system";
  const path = `/api/full-system/assignments/${id}/evaluation/${side}`;
  const [data, setData] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const pending = useRef(new Map<string, number | null>());
  const submitKey = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timing = useRef<ReturnType<typeof installSyntheticTiming> | null>(null);
  const storedKey = useRef<string | null>(null);
  const deadline = useRef<string | null>(null);
  const sending = useRef<Promise<void> | null>(null);
  const sync = useRef<() => Promise<void>>(async () => {});
  const remember = () => {
    if (!storedKey.current) return;
    try {
      if (!pending.current.size) localStorage.removeItem(storedKey.current);
      else localStorage.setItem(storedKey.current, JSON.stringify({ expiresAt: deadline.current, answers: [...pending.current] }));
    } catch { setMessage("พื้นที่เก็บคำตอบในเครื่องไม่พร้อม โปรดเชื่อมต่อและรอให้บันทึกสำเร็จก่อนปิดหน้า"); }
  };
  const load = async () => {
    const response = await fetch(path, { cache: "no-store" }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "โหลดงานไม่สำเร็จ");
    setData(payload.data);
  };
  useEffect(() => { let active = true; (async () => { try {
    const response = await fetch(path, { cache: "no-store" }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "โหลดงานไม่สำเร็จ");
    if (active) {
      const initial = payload.data as Evaluation;
      storedKey.current = queueKey(initial.viewerId, id, initial.generation, side);
      deadline.current = initial.deadline;
      try {
        pending.current = initial.readOnly ? new Map() : readQueuedAnswers(localStorage.getItem(storedKey.current), new Set(initial.pairs.map(p => p.id)));
        if (initial.readOnly) localStorage.removeItem(storedKey.current);
      } catch { pending.current = new Map(); }
      setData({ ...initial, pairs: initial.pairs.map(p => pending.current.has(p.id) ? { ...p, choice: pending.current.get(p.id)! } : p) });
      if (pending.current.size) { setMessage("กู้คืนคำตอบที่รอเชื่อมต่อแล้ว กำลังส่งฉบับร่างให้ระบบ"); void sync.current().catch(() => {}); }
    }
  } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "โหลดงานไม่สำเร็จ"); } })();
    return () => { active = false; if (timer.current) clearTimeout(timer.current); }; }, [path, id, side]);
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!data?.syntheticTimingEnabled || data.readOnly) return;
    const recorder = installSyntheticTiming(path); timing.current = recorder;
    return () => { recorder.destroy(); timing.current = null; };
  }, [path, data?.syntheticTimingEnabled, data?.readOnly]);
  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (sending.current) await sending.current;
    const updates = [...pending.current];
    if (!updates.length) return;
    const job = (async () => { setSaving(true);
    try {
      if (!navigator.onLine) throw new Error("ออฟไลน์ — เก็บคำตอบในเครื่องแล้ว จะบันทึกฉบับร่างเมื่อเชื่อมต่ออีกครั้ง");
      await timing.current?.settle(); for (const [pairId, choice] of updates) {
      const response = await fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairId, choice }) }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "บันทึกไม่สำเร็จ");
      if (pending.current.get(pairId) === choice) pending.current.delete(pairId);
      remember();
    }
      setMessage(`บันทึกแล้ว เมื่อ ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      remember();
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
      throw error;
    } finally { setSaving(false); } })();
    sending.current = job;
    try { await job; } finally { if (sending.current === job) sending.current = null; }
  };
  useEffect(() => { sync.current = flush; });
  useEffect(() => {
    const online = () => { void sync.current().catch(() => {}); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  const answer = (pairId: string, choice: number | null) => {
    if (!data || data.readOnly) return;
    timing.current?.complete(pairId);
    setData(current => current && ({ ...current, pairs: current.pairs.map(pair =>
      pair.id === pairId ? { ...pair, choice } : pair) }));
    pending.current.set(pairId, choice);
    remember();
    submitKey.current = null;
    setMessage("กำลังบันทึก…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, 500);
  };
  const submit = async () => {
    if (!data) return;
    const missing = data.pairs.filter(pair => pair.choice === null).length;
    const confirmation = missing === 0 ? `ตอบครบ ${data.pairs.length} คู่แล้ว ยืนยันส่งคำตอบหรือไม่?` : `ยังไม่ตอบ ${missing} คู่จาก ${data.pairs.length} คู่ ยืนยันส่งคำตอบที่มีหรือไม่?`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    try { await timing.current?.finish(); await flush();
      submitKey.current ??= crypto.randomUUID();
      const response = await fetch(path, { method: "POST",
        headers: { "Idempotency-Key": submitKey.current } }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "ส่งไม่สำเร็จ");
      submitKey.current = null;
      await load(); setMessage(`ส่งคำตอบรุ่น ${payload.data.revision} แล้ว (${payload.data.answered}/${payload.data.assigned})`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "ส่งไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const answered = data?.pairs.filter(pair => pair.choice !== null).length ?? 0;
  const remaining = data?.deadline ? Date.parse(data.deadline) - clock : null;
  return <main className="fs-page fs-evaluation-page">
    <a className="fs-back-link" href={returnHref}><span aria-hidden="true">←</span> กลับไปงานประเมิน</a>
    {message && !data && <p className="notice" role="status" aria-live="polite">{message}</p>}
    {!data ? <div className="fs-loading-card" role="status">กำลังเตรียมแบบประเมิน…</div> : <>
      <header className="fs-page-heading fs-evaluation-heading"><div>
        <span className="eyebrow">พื้นที่นักศึกษา · {side === "group" ? "ประเมินกลุ่ม" : "ประเมินรายบุคคล"}</span>
        <h1>{side === "group" ? "เปรียบเทียบผลงานกลุ่ม" : "เปรียบเทียบผลงานรายบุคคล"}</h1>
        <p>เลือกผลงานที่ทำได้ดีกว่าในแต่ละคู่ เกณฑ์แต่ละข้อจะบันทึกคำตอบให้อัตโนมัติ</p>
      </div><span className="fs-student-mark" aria-hidden="true">✓</span></header>
      <section className="fs-progress-card" aria-label="ความคืบหน้าการประเมิน">
        <div className="fs-progress-heading"><div><strong>ความคืบหน้า</strong><span>{answered} จาก {data.pairs.length} คู่</span></div>
          <span className={data.readOnly ? "fs-status-badge" : "fs-status-badge is-open"}>{data.readOnly ? "อ่านได้อย่างเดียว" : saving ? "กำลังบันทึก…" : "บันทึกอัตโนมัติ"}</span></div>
        <div className="fs-progress-track" role="progressbar" aria-label="ตอบแล้ว" aria-valuemin={0} aria-valuemax={data.pairs.length} aria-valuenow={answered}>
          <span style={{ width: `${data.pairs.length ? answered / data.pairs.length * 100 : 0}%` }} /></div>
        <div className="fs-deadline-line"><span>ครบกำหนด</span><strong>{data.deadline ? new Date(data.deadline).toLocaleString("th-TH", { timeZone: data.timezone }) : "ไม่กำหนด"}</strong><small>{data.timezone}</small></div>
      </section>
      {remaining !== null && remaining > 0 && remaining < 48 * 60 * 60 * 1000 &&
        <p className="evaluation-warning" role="status">เหลือเวลา {Math.floor(remaining / 3_600_000)} ชั่วโมง {Math.floor(remaining % 3_600_000 / 60_000)} นาที</p>}
      {message && <p className="fs-save-status" role="status" aria-live="polite">{message}</p>}
      {data.syntheticTimingEnabled && <p className="fs-timing-notice">ข้อมูลเวลาที่ใช้ดูหน้านี้เก็บเพื่อทบทวนต้นแบบเท่านั้น</p>}
      {data.latestSubmission && <p className="notice">ส่งคำตอบแล้ว · ครั้งที่ {data.latestSubmission.revision} · ยังส่งฉบับแก้ไขได้ก่อนครบกำหนด</p>}
      {data.disabledReason && <p className="notice">{data.disabledReason}</p>}
      <details className="fs-score-explainer"><summary>คำตอบของฉันถูกนำไปใช้คำนวณอย่างไร</summary>
        <p>ระบบใช้เฉพาะฉบับที่ส่งแล้วในการคำนวณคะแนนส่วนตัว โดยพิจารณาร่วมกับอัตราการส่งงาน (p) และตัวคูณ (M) ฉบับร่างยังไม่นำไปคำนวณ</p>
      </details>
      {data.criteria.map(criterion => <section className="criterion-section" key={criterion.id}>
        <div className="criterion-heading"><h2>{criterion.name}</h2><span>{data.pairs.filter(pair => pair.criterionId === criterion.id && pair.choice !== null).length} / {data.pairs.filter(pair => pair.criterionId === criterion.id).length}</span></div>
        {criterion.description && <p>{criterion.description}</p>}
        {data.pairs.filter(pair => pair.criterionId === criterion.id).map((pair, index) => <fieldset className="evaluation-pair fs-evaluation-pair" key={pair.id}
          data-pair-id={pair.id} onPointerEnter={() => timing.current?.select(pair.id)} onFocusCapture={() => timing.current?.select(pair.id)}>
          <legend>คู่ที่ {index + 1} · {criterion.name}: {pair.leftName} เทียบกับ {pair.rightName}</legend><div className="candidate-labels">
            <div className="fs-candidate-card is-left"><span>ผลงาน A</span><strong>{pair.leftName}</strong>{pair.leftArtifactUrl ? <a href={pair.leftArtifactUrl} target="_blank" rel="noopener noreferrer">เปิดผลงาน ↗</a> : <small>ยังไม่มีลิงก์ผลงาน</small>}</div>
            <span className="fs-versus-label">เทียบกับ</span>
            <div className="fs-candidate-card is-right"><span>ผลงาน B</span><strong>{pair.rightName}</strong>{pair.rightArtifactUrl ? <a href={pair.rightArtifactUrl} target="_blank" rel="noopener noreferrer">เปิดผลงาน ↗</a> : <small>ยังไม่มีลิงก์ผลงาน</small>}</div>
          </div><div className="rating-options">{labels.map((label, index) => <label key={index}>
            <input type="radio" name={pair.id} checked={pair.choice === index + 1} disabled={data.readOnly || busy}
              onChange={() => answer(pair.id, index + 1)} aria-label={`${index + 1} ${label}`} />
            <span className="rating-number">{index + 1}</span><small>{label}</small></label>)}</div>
          <p className="fs-scale-hint"><span>1 = ผลงาน A ดีกว่ามาก</span><span>6 = ผลงาน B ดีกว่ามาก</span></p>
          {!data.readOnly && <button className="clear-choice" type="button" onClick={() => answer(pair.id, null)}>ล้างคำตอบ</button>}
        </fieldset>)}
      </section>)}
      <footer className="fs-submit-bar"><div><strong>{answered}/{data.pairs.length} คู่</strong><span>{data.readOnly ? "พ้นกำหนดส่งแล้ว" : saving ? "กำลังบันทึกคำตอบ…" : "ฉบับร่างบันทึกอัตโนมัติ"}</span></div>
        <div className="fs-submit-actions">{!data.readOnly && <button className="primary-button" disabled={busy || saving} onClick={submit}>{busy ? "กำลังส่ง…" : data.latestSubmission ? "ส่งฉบับแก้ไข" : "ยืนยันส่งคำตอบ"}</button>}
          <a className="secondary-button" href={`/full-system/assignments/${id}/my-score`}>ดูคะแนนของฉัน</a></div>
      </footer>
    </>}
  </main>;
}
