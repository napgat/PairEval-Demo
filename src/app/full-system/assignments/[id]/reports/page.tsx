"use client";
import Link from "next/link";

import ConfirmationDialog from "@/app/full-system/components/confirmation-dialog";
import { assignmentStatus, sideName, appealStatus, scoreFlag, friendlyError } from "@/lib/full-system-ui";
import { use, useCallback, useEffect, useState } from "react";
import type { ScoreRun } from "@/lib/full-system-score-runs";
import type { ComparisonReview } from "@/lib/full-system-comparison-review";
import { formatClassroomDateTime } from "@/lib/full-system-timezone";

type Snapshot = { id: string; snapshotNo: number; kind: "INTERIM" | "FINAL"; assignmentStatus: string;
  inputHash: string; createdAt: string; output: ScoreRun };
type Appeal = { id: string; studentId: string; message: string; status: string;
  resolution: string | null; createdAt: string };
type AuditRow = { action: string; resourceType: string; resourceId: string;
  requestId: string; occurredAt: string };
type Tab = "group" | "individual" | "coverage" | "quality";
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "group", label: "คะแนนกลุ่ม" }, { id: "individual", label: "คะแนนรายบุคคล" },
  { id: "coverage", label: "ความครอบคลุมคู่" }, { id: "quality", label: "คุณภาพคำตอบ" }];
const show = (value: number | null) => value === null ? "ยังมีข้อมูลไม่พอ" : value.toFixed(3);
const signalName = { "QS-02": "QS-02 เลือกค่าเดิม", "QS-03": "QS-03 เลือกฝั่งเดียว", "QS-04": "QS-04 คำตอบวนขัดกัน",
  "QS-05": "QS-05 เวลาทำคำถาม", "QS-06": "QS-06 ให้คะแนนเพื่อนสังเคราะห์", "QS-07": "QS-07 ความเห็นตรงกัน" };
const qualityReason: Record<string, string> = {
  REAL_TELEMETRY_DISABLED: "ไม่เปิดเก็บเวลาของผู้ใช้จริง", INCOMPLETE_ACTIVE_DURATION: "เวลาบางคำตอบยังไม่ครบหรือไม่ได้รับการยืนยัน",
  SYNTHETIC_FRIEND_SOURCE_REQUIRED: "ไม่มีชุดความสัมพันธ์เพื่อนสังเคราะห์", NO_EXPLICIT_FRIENDS: "ไม่มีความสัมพันธ์เพื่อนที่ระบุไว้",
  MIN_3_MATCHED_COMPARISONS: "ต้องมีคำตอบตรงคู่กันอย่างน้อย 3 คู่", MIN_5_REFERENCE_RATERS: "ต้องมีผู้ประเมินอ้างอิงอย่างน้อย 5 คน",
  ZERO_REFERENCE_VARIANCE: "ผู้ประเมินอ้างอิงให้ค่าเท่ากันทั้งหมด", MIN_3_COMPLETE_RATERS: "ต้องมีผู้ประเมินที่ตอบครบชุดอย่างน้อย 3 คน",
  ALL_TIED_PANEL: "ทุกอันดับเสมอกันจึงคำนวณความเห็นตรงกันไม่ได้", INCOMPLETE_RANK_PANEL: "คำตอบยังไม่เป็นชุดรายการร่วมที่ครบทุกคู่",
};

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirming, setConfirming] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [rawExportReady, setRawExportReady] = useState(false);
  const [canRevealIdentities, setCanRevealIdentities] = useState(false);
  const [canManageFinalScores, setCanManageFinalScores] = useState(false);
  const [identityReason, setIdentityReason] = useState("");
  const [tab, setTab] = useState<Tab>("group");
  const [chartCriterion, setChartCriterion] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrideSide, setOverrideSide] = useState<"GROUP" | "INDIVIDUAL">("GROUP");
  const [overrideItem, setOverrideItem] = useState("");
  const [overrideValue, setOverrideValue] = useState(0);
  const [reason, setReason] = useState("");
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [qualityFeedback, setQualityFeedback] = useState<Array<{criterion:string;side:string;assignments:number}>>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [classroomTimezone, setClassroomTimezone] = useState<string | null>(null);
  const [appealId, setAppealId] = useState("");
  const [resolution, setResolution] = useState("");
  const [reviews, setReviews] = useState<ComparisonReview[]>([]);
  const [reviewCursor, setReviewCursor] = useState<string | null>(null);
  const [reviewPair, setReviewPair] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const endpoint = `/api/full-system/assignments/${id}`;
  const refresh = useCallback(async () => {
    const [response, appealResponse, auditResponse, reviewResponse] = await Promise.all([
      fetch(`${endpoint}/score-runs`, { cache: "no-store" }),
      fetch(`${endpoint}/appeals`, { cache: "no-store" }),
      fetch(`${endpoint}/audit`, { cache: "no-store" }),
      fetch(`${endpoint}/comparison-reviews`, { cache: "no-store" })]);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.code ?? `HTTP ${response.status}`);
    setSnapshot(payload.data);
    setRawExportReady(payload.meta?.rawExportReady === true);
    setCanRevealIdentities(payload.meta?.canRevealIdentities === true);
    setCanManageFinalScores(payload.meta?.canManageFinalScores === true);
    setQualityFeedback(payload.meta?.qualityFeedback ?? []);
    if (appealResponse.ok) setAppeals((await appealResponse.json()).data.appeals);
    if (auditResponse.ok) {
      const audit = await auditResponse.json();
      setAuditRows(audit.data); setClassroomTimezone(audit.meta?.timezone ?? null);
    } else { setAuditRows([]); setClassroomTimezone(null); }
    if (reviewResponse.ok) {
      const reviewData = (await reviewResponse.json()).data;
      setReviews(reviewData.items); setReviewCursor(reviewData.nextCursor);
    }
  }, [endpoint]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadError("");
      try { await refresh(); if (active) setLoadedId(id); }
      catch (error) { if (active) setLoadError(friendlyError(error)); }
    })();
    return () => { active = false; };
  }, [refresh, id]);
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${endpoint}/${path}`, { method: "POST",
      headers: { "Content-Type": "application/json", Origin: window.location.origin },
      body: JSON.stringify(body) });
    const payload = await response.json();
    if (response.status === 202) throw new Error("รายการยังรอยืนยัน กรุณาโหลดข้อมูลใหม่ก่อนทำรายการซ้ำ");
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`);
    return payload.data;
  };
  const action = async (task: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await task(); await refresh(); } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  };
  const run = (kind: "INTERIM" | "FINAL") => action(async () => {
    await post("score-runs", { kind }); setMessage(kind === "FINAL" ? "ยืนยันผลคะแนนแล้ว" : "คำนวณคะแนนชั่วคราวแล้ว");
  });
  const reopen = () => action(async () => {
    await post("score-runs/reopen", { reason }); setReason(""); setMessage("เปิดทบทวนคะแนนแล้ว เก็บคะแนนฉบับก่อนหน้าไว้ครบ");
  });
  const override = () => action(async () => {
    await post("score-runs/override", { side: overrideSide, itemId: overrideItem,
      value: overrideValue, reason });
    await post("score-runs", { kind: "INTERIM" });
    setReason(""); setMessage("ปรับคะแนนและบันทึกเหตุผลแล้ว");
  });
  const resolveAppeal = (status: "RESOLVED" | "REJECTED") => action(async () => {
    await fetch(`${endpoint}/appeals`, { method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: window.location.origin },
      body: JSON.stringify({ appealId, status, resolution }) }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`);
    });
    setResolution(""); setAppealId(""); setMessage("บันทึกคำตอบอุทธรณ์แล้ว");
  });
  const selectedReview = reviews.find(row => row.pairId === reviewPair);
  const reviewComparison = () => action(async () => {
    if (!selectedReview) return;
    await post("comparison-reviews", { pairId: selectedReview.pairId, excluded: !selectedReview.excluded,
      reason: reviewReason, expectedReviewId: selectedReview.reviewId });
    setReviewPair(""); setReviewReason(""); setMessage("บันทึกการทบทวนคำตอบและคำนวณ คะแนนฉบับใหม่แล้ว");
  });
  const loadMoreReviews = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}/comparison-reviews?cursor=${reviewCursor}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.code ?? `HTTP ${response.status}`);
      setReviews(current => [...current, ...payload.data.items]); setReviewCursor(payload.data.nextCursor);
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  };
  const download = async (format: "csv" | "xlsx", raw = false, includeIdentities = false) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${endpoint}/exports${raw ? "/raw" : ""}`, { method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ format, report: tab, includeIdentities, confirmed: includeIdentities, reason: includeIdentities ? identityReason : undefined }) });
      if (!response.ok) { const payload = await response.json();
        throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`); }
      const file = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = file;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `paireval.${format}`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(file);
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  };
  const output = snapshot?.output;
  const quality = [...(output?.groups.map(g => ({ name: g.name, flags: g.flags })) ?? []),
    ...(output?.students.map(s => ({ name: s.displayName, flags: s.flags })) ?? [])];
  const chartCriteria = [...new Map([...(output?.groups.flatMap(g => g.criteria) ?? []),
    ...(output?.students.flatMap(s => s.criteria) ?? [])].map(c => [c.criterionId, c.name])).entries()];
  const chartValues = [...(output?.groups.flatMap(g => g.criteria) ?? []),
    ...(output?.students.flatMap(s => s.criteria) ?? [])]
    .filter(c => c.criterionId === (chartCriterion || chartCriteria[0]?.[0]) && c.q !== null)
    .map(c => c.q!);
  const distribution = [0, 1, 2, 3, 4].map(index => chartValues.filter(value =>
    Math.min(4, Math.floor(value * 5)) === index).length);
  if (loadedId !== id) return <main className="fs-page fs-report-page">
    <Link className="fs-back-link" href="/full-system">← กลับไปหน้าห้องเรียน</Link>
    <h1>{loadError ? "ไม่สามารถเปิดรายงาน" : "กำลังโหลดรายงาน…"}</h1>
    <p className={loadError ? "error-box" : "fs-muted-copy"} role={loadError ? "alert" : "status"}>
      {loadError || "กำลังตรวจสิทธิ์และเตรียมข้อมูลคะแนน"}
    </p>
    {loadError && <button className="secondary-button" onClick={() => window.location.reload()}>ลองโหลดใหม่</button>}
  </main>;
  return <main className="fs-page fs-report-page">
    <Link className="fs-back-link" href="/full-system"><span aria-hidden="true">←</span> กลับไปหน้าห้องเรียน</Link>
    <header className="fs-page-heading"><div><span className="eyebrow">พื้นที่อาจารย์ · ผลการประเมิน</span>
      <h1>รายงานและตัดสินคะแนน</h1><p>ตรวจผล แบ่งดูตามด้าน และคำนวณคะแนนฉบับที่ต้องการ</p></div>
      </header>
    {message && <p className="notice" role="status">{message}</p>}
    {output && <div className="fs-report-summary"><span><strong>{output.students.length}</strong> นักศึกษา</span><span><strong>{output.groups.length}</strong> กลุ่ม</span><span><strong>{appeals.filter(a=>a.status === "OPEN").length}</strong> คำขอรอพิจารณา</span></div>}
    <section className="form-panel fs-snapshot-panel">
      <div className="fs-section-heading"><div><span className="eyebrow">สถานะคะแนน</span><h2>ผลคำนวณล่าสุด</h2></div>
        {snapshot && <span className={`fs-status-badge ${snapshot.assignmentStatus === "FINALIZED" ? "is-open" : ""}`}>{snapshot.assignmentStatus === "FINALIZED" ? "ยืนยันแล้ว" : snapshot.kind === "FINAL" ? "กำลังทบทวนคะแนน" : "คะแนนชั่วคราว"}</span>}</div>
      <p>{snapshot ? `คะแนนฉบับที่ ${snapshot.snapshotNo} · ${assignmentStatus(snapshot.assignmentStatus)} · อัปเดต ${classroomTimezone ? `${formatClassroomDateTime(snapshot.createdAt, classroomTimezone)} (${classroomTimezone})` : "ยังโหลดเขตเวลาห้องเรียนไม่ได้"}` :
        "ยังไม่มีผลคำนวณ — เริ่มจากคำนวณผลระหว่างดำเนินงาน"}</p>
      {snapshot?.assignmentStatus !== "FINALIZED" && <div className="actions">
        <button className="secondary-button" disabled={busy} onClick={() => run("INTERIM")}>คำนวณผลระหว่างดำเนินงานใหม่</button>
        {canManageFinalScores && <button className="primary-button" disabled={busy || !snapshot}
          onClick={() => setConfirming(true)}>ยืนยันผลคะแนน</button>}
      </div>}
      {snapshot?.assignmentStatus === "FINALIZED" && canManageFinalScores && <details className="fs-disclosure"><summary>เปิดทบทวนคะแนนที่ยืนยันแล้ว</summary><div className="fs-disclosure-body"><p className="fine-print">ใช้เมื่อต้องแก้คะแนน โดยระบุเหตุผล ระบบจะเก็บคะแนนฉบับเดิมไว้</p>
        <label className="field">เหตุผลที่เปิดคะแนนใหม่<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="secondary-button" disabled={busy || reason.trim().length < 10} onClick={reopen}>เปิดคะแนนให้แก้ไข</button>
      </div></details>}
    </section>
    {output && <>
      <section className="form-panel"><h2>รายงาน</h2>
        <div className="actions" role="tablist" aria-label="ประเภทรายงาน" onKeyDown={event => {
          const keys = ["ArrowRight", "ArrowLeft", "Home", "End"]; if (!keys.includes(event.key)) return;
          event.preventDefault(); const current = tabs.findIndex(t=>t.id === tab);
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : (current+(event.key === "ArrowRight" ? 1 : -1)+tabs.length)%tabs.length;
          setTab(tabs[next].id); (event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next])?.focus();
        }}>{tabs.map(item =>
          <button key={item.id} role="tab" id={`report-tab-${item.id}`} aria-controls="report-panel" tabIndex={tab === item.id ? 0 : -1} aria-selected={tab === item.id} className="secondary-button"
            onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
        <div role="tabpanel" id="report-panel" aria-labelledby={`report-tab-${tab}`} tabIndex={0}>
        {tab === "group" && <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางคะแนนกลุ่ม"><table><thead><tr><th>กลุ่ม</th><th>เกณฑ์</th><th>ค่าเปรียบเทียบ (q)</th><th>จำนวน</th><th>คะแนนถ่วง</th><th>รวมกลุ่ม</th><th>หมายเหตุ</th></tr></thead><tbody>
          {output.groups.flatMap(g => g.criteria.map(c => <tr key={`${g.id}:${c.criterionId}`}>
            <td>{g.name}</td><td>{c.name}</td><td>{show(c.q)}</td><td>{c.comparisons}</td>
            <td>{show(c.weightedScore)}</td><td>{show(g.component)}</td><td>{g.flags.map(scoreFlag).join(", ")}</td></tr>))}
        </tbody></table></div>}
        {tab === "individual" && <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางคะแนนรายบุคคล"><table><thead><tr><th>นักศึกษา</th><th>กลุ่ม</th><th>รายบุคคล</th><th>ส่ง/มอบหมาย</th><th>ตัวคูณ (M)</th><th>รวม</th><th>หมายเหตุ</th></tr></thead><tbody>
          {output.students.map(s => <tr key={s.id}><td>{s.displayName}</td><td>{show(s.groupComponent)}</td>
            <td>{show(s.individualComponent)}</td><td>{s.answered}/{s.assigned}</td><td>{s.M.toFixed(3)}</td>
            <td>{show(s.total)}</td><td>{s.flags.map(scoreFlag).join(", ")}</td></tr>)}
        </tbody></table></div>}
        {tab === "coverage" && <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางความครอบคลุมคู่"><table><thead><tr><th>ด้าน</th><th>เกณฑ์</th><th>คู่ A / B</th><th>ส่ง/มอบหมาย</th><th>ตัดออก</th><th>ค่าเฉลี่ยของ A</th></tr></thead><tbody>
          {output.pairSummary?.map(p => <tr key={`${p.side}:${p.criterionId}:${p.aId}:${p.bId}`}><td>{sideName(p.side)}</td>
            <td>{chartCriteria.find(c=>c[0] === p.criterionId)?.[1] ?? "เกณฑ์เดิม"}</td><td>{output.groups.find(g=>g.id === p.aId)?.name ?? output.students.find(s=>s.id === p.aId)?.displayName ?? "รายการ A"} / {output.groups.find(g=>g.id === p.bId)?.name ?? output.students.find(s=>s.id === p.bId)?.displayName ?? "รายการ B"}</td>
            <td>{p.answered}/{p.assigned}</td><td>{p.excluded ?? 0}</td><td>{show(p.meanForA)}</td></tr>)}
        </tbody></table>{!output.pairSummary && <p>ผลคำนวณฉบับนี้ยังไม่มีผลรวมต่อคู่ โปรดคำนวณคะแนนชั่วคราวใหม่หากต้องการข้อมูลนี้</p>}</div>}
        {tab === "quality" && <>
          <p>สัญญาณใช้ช่วยทบทวนคำตอบ ไม่ลดน้ำหนักหรือลบคำตอบอัตโนมัติ</p>
          <ul className="plain-list">{quality.flatMap(row => row.flags.map(flag =>
            <li key={`${row.name}:${flag}`}>{row.name}: {scoreFlag(flag)}</li>))}</ul>
          {qualityFeedback.map(row=><p className="notice" key={`${row.side}:${row.criterion}`}>เกณฑ์ {row.criterion} มีความเห็นแตกต่างกันสูงติดต่อกัน {row.assignments} งาน ควรทบทวนคำอธิบายเกณฑ์</p>)}
          {output.quality ? <>
            <p className="fine-print">รหัสผู้ประเมินใช้เฉพาะ คะแนนฉบับนี้ QS-02/03 แยกตามด้านและใช้คำตอบที่ส่งล่าสุด;
              QS-04 แยกตามเกณฑ์และนับเฉพาะชุดสามรายการที่ตอบครบ สัญญาณจากคำตอบจำนวนน้อยต้องทบทวนด้วยความระมัดระวัง</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางสัญญาณคุณภาพ"><table><caption>{output.quality.version === "qs-02-04-v1" ? "สัญญาณคุณภาพ QS-02–04" : "สัญญาณคุณภาพ QS-02–07"}</caption><thead><tr>
              <th>สัญญาณ</th><th>รหัสผู้ประเมิน</th><th>ด้าน / เกณฑ์</th><th>พบ / ตรวจได้</th><th>สัดส่วน</th><th>เกณฑ์</th><th>ผล</th>
            </tr></thead><tbody>{output.quality.measures.map(row => <tr
              key={`${row.id}:${row.evaluatorCode}:${row.side}:${row.criterionId}`}>
              <td>{signalName[row.id]}</td>
              <td>{row.evaluatorCode}</td><td>{row.side}{row.criterionId ? ` / ${chartCriteria.find(c => c[0] === row.criterionId)?.[1] ?? row.criterionId.slice(0, 8)}` : ""}</td>
              <td>{row.id === "QS-05" ? `บันทึกเวลา ${row.count}/${row.total} คำตอบ` : row.id === "QS-06" ? `${row.count} คู่ / อ้างอิง ${row.total} คน` : row.id === "QS-07" ? `${row.count} คน / ${row.total} รายการ` : `${row.count} / ${row.total}`}</td>
              <td>{row.ratio === null ? "ข้อมูลไม่พอ" : row.id === "QS-05" ? `${row.ratio.toFixed(3)} วินาที` : row.id === "QS-06" ? `z = ${row.ratio.toFixed(3)}` : row.id === "QS-07" ? `W = ${row.ratio.toFixed(3)}` : `${(row.ratio * 100).toFixed(1)}%`}</td>
              <td>{row.operator ?? ">"} {row.id === "QS-05" ? `${row.threshold} วินาที` : row.id === "QS-06" || row.id === "QS-07" ? row.threshold : `${row.threshold * 100}%`}</td>
              <td>{row.ratio === null ? `ตรวจไม่ได้ — ${qualityReason[row.reason ?? ""] ?? "ข้อมูลไม่พอ"}` : row.flagged ? "ควรทบทวน" : "ไม่พบสัญญาณ"}</td>
            </tr>)}</tbody></table></div>
            {output.quality.measures.length === 0 && <p>ยังไม่มีคำตอบที่ส่งสำหรับตรวจ QS-02–04</p>}
          </> : <p>ผลคำนวณฉบับนี้ยังไม่มี QS-02–04 โปรดคำนวณคะแนนชั่วคราวใหม่หากต้องการตรวจ</p>}
          <p className="fine-print">QS-05 เปิดเฉพาะชุดทดสอบสังเคราะห์ที่ระบุไว้และต้องมีเวลาครบทุกคำตอบ; QS-06 ใช้ความสัมพันธ์เพื่อนสังเคราะห์ที่ระบุโดยตรง;
            QS-07 ใช้ผู้ประเมินอย่างน้อย 3 คนที่ตอบครบทุกคู่ในชุดรายการเดียวกัน ไม่มีการเติมคำตอบที่ขาด สัญญาณทั้งหมดต้องทบทวนด้วยตา</p>
          <h3>คำตอบที่ผู้สอนตัดออกจากคะแนน</h3>
          {output.exclusions?.length ? <ul className="plain-list">{output.exclusions.map(row =>
            <li key={row.pairId}>{row.side} · {row.pairId.slice(0, 8)} · {row.reason}</li>)}</ul> : <p>ไม่มีคำตอบที่ถูกตัดออกใน คะแนนฉบับนี้</p>}
        </>}
        </div>
        <div className="actions"><button className="secondary-button" disabled={busy} onClick={() => download("csv")}>ดาวน์โหลด CSV</button>
          <button className="secondary-button" disabled={busy} onClick={() => download("xlsx")}>ดาวน์โหลด Excel (4 แผ่นงาน)</button>
        </div>
        {rawExportReady && <details className="fs-disclosure"><summary>ส่งออกคำตอบรายคู่สำหรับตรวจสอบ</summary><div className="fs-disclosure-body">
          <button className="secondary-button" disabled={busy} onClick={() => download("csv", true)}>ดาวน์โหลดคำตอบดิบแบบรหัสผู้ประเมิน</button>
        <p className="fine-print">ไฟล์คำตอบใช้รหัสแทนผู้ประเมิน และบันทึกประวัติการส่งออกทุกครั้ง</p>
        {rawExportReady && canRevealIdentities && <details className="form-panel"><summary>เปิดเผยตัวผู้ประเมิน (เจ้าของห้องเท่านั้น)</summary>
          <p>ใช้เพื่อการตรวจสอบทางวิชาการ ระบบบันทึกการเข้าถึงและการส่งออกทุกครั้ง ไฟล์จะมีชื่อและอีเมลผู้ประเมิน</p>
          <label className="field">เหตุผลเปิดเผยตัวผู้ประเมิน<textarea value={identityReason} onChange={e => setIdentityReason(e.target.value)} minLength={10} maxLength={2000} /></label>
          <button disabled={busy || identityReason.trim().length < 10} onClick={() => {
            if (window.confirm("ยืนยันดาวน์โหลดชื่อและอีเมลผู้ประเมินเพื่อเหตุผลที่ระบุ? การดำเนินการนี้จะถูกบันทึก audit")) void download("csv", true, true);
          }}>ยืนยันและดาวน์โหลดพร้อมชื่อผู้ประเมิน</button>
        </details>}
        </div></details>}
      </section>
      {tab === "quality" && snapshot.assignmentStatus !== "FINALIZED" && <section className="form-panel">
        <h2>ทบทวนคำตอบที่ส่ง</h2>
        <p>ผู้สอนตัดคำตอบออกจากคะแนนหรือคืนคำตอบได้พร้อมเหตุผล ระบบเก็บประวัติและคำนวณ คะแนนฉบับใหม่
          จำนวนงานที่ส่งและตัวคูณการมีส่วนร่วมยังนับคำตอบที่ส่งแล้ว</p>
        <label className="field">คำตอบที่จะทบทวน<select value={reviewPair} onChange={e => setReviewPair(e.target.value)}>
          <option value="">เลือกคำตอบ</option>{reviews.map(row => <option key={row.pairId} value={row.pairId}>
            {row.side} · {row.criterion} · {row.itemA} / {row.itemB} · {row.pairId.slice(0, 8)}{row.excluded ? " · EXCLUDED" : ""}
          </option>)}</select></label>
        {selectedReview && <p>ค่าที่เลือก: {selectedReview.choice} · ฝั่งซ้ายแสดงรายการ {selectedReview.displayLeft}
          {selectedReview.reason ? ` · เหตุผลครั้งล่าสุด: ${selectedReview.reason}` : ""}</p>}
        {reviewCursor && <button className="secondary-button" disabled={busy} onClick={loadMoreReviews}>โหลดคำตอบเพิ่ม</button>}
        <label className="field">เหตุผลทบทวน (อย่างน้อย 10 ตัวอักษร)<textarea value={reviewReason} onChange={e => setReviewReason(e.target.value)} /></label>
        <p className="fine-print">หลีกเลี่ยงการใส่ชื่อผู้ประเมินในเหตุผล เพราะเหตุผลจะแสดงในรายงานของผู้สอนและไฟล์ส่งออก</p>
        <button className="primary-button" disabled={busy || !selectedReview || reviewReason.trim().length < 10} onClick={reviewComparison}>
          {selectedReview?.excluded ? "คืนคำตอบและคำนวณใหม่" : "ตัดคำตอบออกและคำนวณใหม่"}</button>
      </section>}
      <details className="form-panel fs-disclosure"><summary>ดูการกระจายคะแนนเปรียบเทียบตามเกณฑ์</summary><div className="fs-disclosure-body">
        <label className="field">เกณฑ์<select value={chartCriterion || chartCriteria[0]?.[0] || ""}
          onChange={e => setChartCriterion(e.target.value)}>{chartCriteria.map(([criterionId, name]) =>
            <option key={criterionId} value={criterionId}>{name}</option>)}</select></label>
        <p className="fine-print">จำนวนผลงานที่มีข้อมูลในช่วง q 0–20%, 20–40%, 40–60%, 60–80%, 80–100%</p>
        <div role="img" aria-label={`การกระจายค่า q ${distribution.join(", ")}`}>
          <div className="fs-histogram">{distribution.map((count, index) => <div key={index}><strong>{count}</strong><span style={{height: `${Math.max(4, count / Math.max(1, ...distribution) * 100)}px`}} /><small>{index*20}–{(index+1)*20}%</small></div>)}</div></div>
      </div></details>
      {snapshot.assignmentStatus !== "FINALIZED" && <details className="form-panel fs-disclosure"><summary>ปรับคะแนนพร้อมเหตุผล</summary><div className="fs-disclosure-body"><p className="fine-print">เลือกกลุ่มหรือนักศึกษาที่ต้องการปรับคะแนน และอธิบายเหตุผลทุกครั้ง</p>
        <label className="field">ด้าน<select value={overrideSide} onChange={e => { setOverrideSide(e.target.value as typeof overrideSide); setOverrideItem(""); }}><option value="GROUP">กลุ่ม</option><option value="INDIVIDUAL">รายบุคคล</option></select></label>
        <label className="field">รายการ<select value={overrideItem} onChange={e => setOverrideItem(e.target.value)}><option value="">เลือก</option>
          {(overrideSide === "GROUP" ? output.groups : output.students).map(row =>
            <option key={row.id} value={row.id}>{"name" in row ? row.name : row.displayName}</option>)}</select></label>
        <label className="field">คะแนนใหม่<input type="number" min="0" step="0.0001" value={overrideValue} onChange={e => setOverrideValue(Number(e.target.value))} /></label>
        <label className="field">เหตุผล (อย่างน้อย 10 ตัวอักษร)<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="primary-button" disabled={busy || !overrideItem || reason.trim().length < 10} onClick={override}>บันทึกการปรับคะแนน</button>
      </div></details>}
      <section className="form-panel"><h2>คำขอทบทวนคะแนน</h2>
        {appeals.length === 0 ? <p className="fs-muted-copy">ยังไม่มีคำขอทบทวนคะแนน</p> : <div className="fs-teacher-appeals">
          {appeals.map(row => <article className="fs-appeal-item" key={row.id}>
            <div className="fs-section-heading"><strong>{output.students.find(student=>student.id === row.studentId)?.displayName ?? "นักศึกษาที่ไม่อยู่ในรายชื่อปัจจุบัน"}</strong><span className={`fs-status-badge ${row.status === "OPEN" ? "is-pending" : "is-open"}`}>{appealStatus(row.status)}</span></div>
            <p>{row.message}</p>{row.resolution && <div className="fs-appeal-response"><strong>คำตอบจากอาจารย์</strong><p>{row.resolution}</p></div>}
          </article>)}
        </div>}
        {appeals.some(row => row.status === "OPEN") && <>
          {(snapshot.assignmentStatus !== "FINALIZED" || snapshot.kind !== "FINAL") && <p className="notice" role="status">
            ยังตอบกลับหรือปิดคำขอไม่ได้ ขณะนี้กำลังทบทวนคะแนน หากต้องปรับคะแนน ให้บันทึกการปรับคะแนนแล้วกด “ยืนยันผลคะแนน” ด้านบนก่อนกลับมาตอบคำขอ
          </p>}
          <label className="field">คำอุทธรณ์<select value={appealId} onChange={e => setAppealId(e.target.value)}><option value="">เลือก</option>
            {appeals.filter(row => row.status === "OPEN").map(row => <option key={row.id} value={row.id}>{output.students.find(s=>s.id === row.studentId)?.displayName ?? "นักศึกษา"} · {row.message.slice(0, 45)}</option>)}</select></label>
          <label className="field">คำตอบ (อย่างน้อย 10 ตัวอักษร)<textarea value={resolution} onChange={e => setResolution(e.target.value)} /></label>
          <div className="actions"><button className="primary-button" disabled={busy || snapshot.assignmentStatus !== "FINALIZED" || snapshot.kind !== "FINAL" || !appealId || resolution.trim().length < 10}
            onClick={() => resolveAppeal("RESOLVED")}>ยืนยัน/ตอบกลับ</button>
          <button className="secondary-button" disabled={busy || snapshot.assignmentStatus !== "FINALIZED" || snapshot.kind !== "FINAL" || !appealId || resolution.trim().length < 10}
            onClick={() => resolveAppeal("REJECTED")}>ปฏิเสธพร้อมเหตุผล</button></div>
          <p className="fine-print">หากต้องปรับคะแนน ให้เปิดทบทวนคะแนน ปรับคะแนน และยืนยันผลใหม่ก่อนตอบกลับ</p>
        </>}
      </section>
      <details className="form-panel fs-disclosure"><summary>ประวัติการทำรายการของห้องเรียน</summary><div className="fs-disclosure-body">
        <p className="fine-print">ใช้ตรวจสอบย้อนหลัง โดยไม่แสดงชื่อผู้ประเมิน · {classroomTimezone ? `เวลาแสดงตามเขตเวลาห้องเรียน ${classroomTimezone}` : "ยังโหลดเขตเวลาห้องเรียนไม่ได้ กรุณาลองโหลดหน้าใหม่"}</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางประวัติการทำรายการ"><table><thead><tr><th>เวลา{classroomTimezone ? ` (${classroomTimezone})` : ""}</th><th>เหตุการณ์</th><th>รายการอ้างอิง</th><th>รหัสอ้างอิง</th></tr></thead><tbody>
          {auditRows.map(row => <tr key={`${row.requestId}:${row.action}`}>
            <td>{classroomTimezone ? <time dateTime={row.occurredAt}>{formatClassroomDateTime(row.occurredAt, classroomTimezone)}</time> : "—"}</td><td>{row.action}</td>
            <td>{row.resourceType} {row.resourceId.slice(0, 8)}</td>
            <td>{row.requestId.slice(0, 8)}</td></tr>)}
        </tbody></table></div>
      </div></details>
    </>}
    <ConfirmationDialog open={confirming} title="ยืนยันผลคะแนนของงานนี้?" confirmLabel="ยืนยันผลคะแนน" onCancel={() => setConfirming(false)}
      onConfirm={() => { setConfirming(false); void run("FINAL"); }}>
      <p>นักศึกษาจะเห็นผลนี้เป็นคะแนนที่อาจารย์ยืนยันแล้ว ระบบจะเก็บคะแนนฉบับก่อนหน้าไว้</p>
      <p>หากต้องแก้ไขภายหลัง อาจารย์เจ้าของห้องต้องเปิดทบทวนคะแนนพร้อมระบุเหตุผล</p>
    </ConfirmationDialog>
  </main>;
}
