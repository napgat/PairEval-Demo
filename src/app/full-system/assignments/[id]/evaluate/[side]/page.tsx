"use client";
import Link from "next/link";
import ConfirmationDialog from "@/app/full-system/components/confirmation-dialog";
import { friendlyError } from "@/lib/full-system-ui";
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
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
    setData(null); setLoadFailed(false);
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
  } catch (error) { if (active) { setMessage(friendlyError(error)); setLoadFailed(true); } } })();
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
      setMessage(friendlyError(error));
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
    setBusy(true);
    try { await timing.current?.finish(); await flush();
      submitKey.current ??= crypto.randomUUID();
      const response = await fetch(path, { method: "POST",
        headers: { "Idempotency-Key": submitKey.current } }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "ส่งไม่สำเร็จ");
      submitKey.current = null;
      await load(); setMessage(`ส่งคำตอบรุ่น ${payload.data.revision} แล้ว (${payload.data.answered}/${payload.data.assigned})`);
    } catch (error) { setMessage(friendlyError(error)); }
    finally { timing.current?.resumeRecording(); setBusy(false); }
  };
  const answered = data?.pairs.filter(pair => pair.choice !== null).length ?? 0;
  const remaining = data?.deadline ? Date.parse(data.deadline) - clock : null;
  return <main className="fs-page fs-evaluation-page">
    <Link className="fs-back-link" href={returnHref}><span aria-hidden="true">←</span> กลับไปงานประเมิน</Link>
    {!data ? loadFailed ? <section className="form-panel"><h1>เปิดแบบประเมินไม่ได้</h1>
      <p className="error-box" role="alert">{message}</p>
      <button className="secondary-button" onClick={() => window.location.reload()}>ลองโหลดใหม่</button>
    </section> : <div className="fs-loading-card" role="status">กำลังเตรียมแบบประเมิน…</div> : <>
      <header className="fs-page-heading fs-evaluation-heading"><div>
        <span className="eyebrow">แบบประเมิน · {side === "group" ? "ประเมินกลุ่ม" : "ประเมินรายบุคคล"}</span>
        <h1>{side === "group" ? "เปรียบเทียบผลงานกลุ่ม" : "เปรียบเทียบผลงานรายบุคคล"}</h1>
        <p>เลือกผลงานที่ทำได้ดีกว่าในแต่ละคู่ เกณฑ์แต่ละข้อจะบันทึกคำตอบให้อัตโนมัติ</p>
      </div></header>
      <ol className="fs-review-guide" aria-label="วิธีประเมิน"><li>เปิดดูผลงานทั้งสองชิ้น</li><li>เปรียบเทียบตามเกณฑ์</li><li>ยืนยันส่งเมื่อเรียบร้อย</li></ol>
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

      {data.latestSubmission && <p className="notice">ส่งคำตอบแล้ว · ครั้งที่ {data.latestSubmission.revision} · {data.readOnly ? "ปิดรับการแก้ไขแล้ว" : "แก้ไขและส่งใหม่ได้ก่อนครบกำหนด"}</p>}
      {data.disabledReason && <p className="notice">{data.disabledReason}</p>}
      <details className="fs-score-explainer"><summary>คำตอบของฉันถูกนำไปใช้คำนวณอย่างไร</summary>
        <p>ระบบใช้คำตอบฉบับล่าสุดที่คุณยืนยันส่ง ร่วมกับสัดส่วนงานที่ส่งครบ ฉบับร่างที่บันทึกอัตโนมัติยังไม่นำไปคำนวณคะแนน</p>
      </details>
      {data.pairs.length === 0 && <div className="fs-empty-state"><h2>ยังไม่มีคู่ที่ต้องประเมิน</h2><p>กลับไปหน้างานเพื่อตรวจงานอื่น หรือติดต่ออาจารย์หากคาดว่ามีงานที่ต้องทำ</p></div>}
      {data.criteria.map(criterion => <section className="criterion-section" key={criterion.id}>
        <div className="criterion-heading"><h2>{criterion.name}</h2><span>{data.pairs.filter(pair => pair.criterionId === criterion.id && pair.choice !== null).length} / {data.pairs.filter(pair => pair.criterionId === criterion.id).length}</span></div>
        {criterion.description && <p>{criterion.description}</p>}
        {data.pairs.filter(pair => pair.criterionId === criterion.id).map((pair, index) => <fieldset className="evaluation-pair fs-evaluation-pair" key={pair.id}
          data-pair-id={pair.id} onPointerEnter={() => { if (!busy && !confirming) timing.current?.select(pair.id); }} onFocusCapture={() => { if (!busy && !confirming) timing.current?.select(pair.id); }}>
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
        <div className="fs-submit-actions">{!data.readOnly && <button className="primary-button" disabled={busy || saving || data.pairs.length === 0} onClick={() => setConfirming(true)}>{busy ? "กำลังส่ง…" : data.latestSubmission ? "ส่งฉบับแก้ไข" : "ยืนยันส่งคำตอบ"}</button>}
          <Link className="secondary-button" href={`/full-system/assignments/${id}/my-score${classroom ? `?classroom=${encodeURIComponent(classroom)}` : ""}`}>ดูคะแนนของฉัน</Link></div>
      </footer>
      <ConfirmationDialog open={confirming} title={data.latestSubmission ? "ส่งคำตอบฉบับแก้ไข?" : "ยืนยันส่งคำตอบ?"}
        confirmLabel={data.latestSubmission ? "ส่งฉบับแก้ไข" : "ยืนยันส่งคำตอบ"} onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); void submit(); }}>
        <p>ตอบแล้ว {answered} จาก {data.pairs.length} คู่{answered < data.pairs.length ? ` ยังเหลือ ${data.pairs.length - answered} คู่ที่ไม่ได้ตอบ` : " ครบทุกคู่แล้ว"}</p>
        <p>{data.latestSubmission ? "ระบบจะใช้คำตอบฉบับนี้แทนฉบับก่อนหน้าในการคำนวณ และเก็บประวัติฉบับเดิมไว้" : "เมื่อยืนยันแล้ว คำตอบจะถูกนำไปคำนวณคะแนน คุณยังแก้ไขและส่งใหม่ได้ก่อนกำหนด"}</p>
      </ConfirmationDialog>
    </>}
  </main>;
}
