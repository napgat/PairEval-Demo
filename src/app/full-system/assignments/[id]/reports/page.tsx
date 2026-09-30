"use client";

import { use, useCallback, useEffect, useState } from "react";
import type { ScoreRun } from "@/lib/full-system-score-runs";

type Snapshot = { id: string; snapshotNo: number; kind: "INTERIM" | "FINAL"; assignmentStatus: string;
  inputHash: string; createdAt: string; output: ScoreRun };
type Appeal = { id: string; studentId: string; message: string; status: string;
  resolution: string | null; createdAt: string };
type AuditRow = { action: string; resourceType: string; resourceId: string;
  requestId: string; occurredAt: string };
type Tab = "group" | "individual" | "coverage" | "quality";
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "group", label: "Group Summary" }, { id: "individual", label: "Individual Summary" },
  { id: "coverage", label: "Pair Coverage" }, { id: "quality", label: "Quality" }];
const show = (value: number | null) => value === null ? "NO_DATA" : value.toFixed(3);

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [rawExportReady, setRawExportReady] = useState(false);
  const [tab, setTab] = useState<Tab>("group");
  const [chartCriterion, setChartCriterion] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrideSide, setOverrideSide] = useState<"GROUP" | "INDIVIDUAL">("GROUP");
  const [overrideItem, setOverrideItem] = useState("");
  const [overrideValue, setOverrideValue] = useState(0);
  const [reason, setReason] = useState("");
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [appealId, setAppealId] = useState("");
  const [resolution, setResolution] = useState("");
  const endpoint = `/api/full-system/assignments/${id}`;
  const refresh = useCallback(async () => {
    const [response, appealResponse, auditResponse] = await Promise.all([
      fetch(`${endpoint}/score-runs`, { cache: "no-store" }),
      fetch(`${endpoint}/appeals`, { cache: "no-store" }),
      fetch(`${endpoint}/audit`, { cache: "no-store" })]);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.code ?? `HTTP ${response.status}`);
    setSnapshot(payload.data);
    setRawExportReady(payload.meta?.rawExportReady === true);
    if (appealResponse.ok) setAppeals((await appealResponse.json()).data.appeals);
    if (auditResponse.ok) setAuditRows((await auditResponse.json()).data);
  }, [endpoint]);
  useEffect(() => {
    void (async () => { try { await refresh(); } catch (error) { setMessage(String(error)); } })();
  }, [refresh]);
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${endpoint}/${path}`, { method: "POST",
      headers: { "Content-Type": "application/json", Origin: window.location.origin },
      body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`);
    return payload.data;
  };
  const action = async (task: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await task(); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const run = (kind: "INTERIM" | "FINAL") => action(async () => {
    if (kind === "FINAL" && !window.confirm("ยืนยัน Finalize คะแนนจากข้อมูลที่ส่งล่าสุด? Snapshot เดิมจะถูกเก็บไว้")) return;
    await post("score-runs", { kind }); setMessage(kind === "FINAL" ? "บันทึก Final snapshot แล้ว" : "คำนวณ Interim snapshot แล้ว");
  });
  const reopen = () => action(async () => {
    await post("score-runs/reopen", { reason }); setReason(""); setMessage("เปิดคะแนนใหม่แล้ว; Final snapshot เดิมยังอยู่");
  });
  const override = () => action(async () => {
    await post("score-runs/override", { side: overrideSide, itemId: overrideItem,
      value: overrideValue, reason });
    await post("score-runs", { kind: "INTERIM" });
    setReason(""); setMessage("บันทึกเหตุผลและคำนวณ snapshot ใหม่แล้ว");
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
  const download = async (format: "csv" | "xlsx", raw = false) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${endpoint}/exports${raw ? "/raw" : ""}`, { method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ format, report: tab, includeIdentities: false }) });
      if (!response.ok) { const payload = await response.json();
        throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`); }
      const file = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = file;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `paireval.${format}`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(file);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
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
  return <main className="assignment-shell">
    <p><a href="/full-system">← ห้องเรียน</a></p>
    <span className="eyebrow">PairEval Full System · FS11–FS18</span>
    <h1>รายงานและตัดสินคะแนน</h1>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="form-panel">
      <h2>Score snapshot</h2>
      <p>{snapshot ? `รุ่น ${snapshot.snapshotNo} · ${snapshot.kind} · สถานะ ${snapshot.assignmentStatus} · ${new Date(snapshot.createdAt).toLocaleString("th-TH")}` :
        "ยังไม่มี snapshot — คำนวณก่อนดูรายงาน"}</p>
      <div className="actions">
        <button className="secondary-button" disabled={busy || snapshot?.assignmentStatus === "FINALIZED"} onClick={() => run("INTERIM")}>คำนวณ Interim ใหม่</button>
        <button className="primary-button" disabled={busy || !snapshot || snapshot.assignmentStatus === "FINALIZED"}
          onClick={() => run("FINAL")}>Finalize</button>
      </div>
      {snapshot?.assignmentStatus === "FINALIZED" && <div>
        <label className="field">เหตุผลที่เปิดคะแนนใหม่<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="secondary-button" disabled={busy || reason.trim().length < 10} onClick={reopen}>Reopen</button>
      </div>}
    </section>
    {output && <>
      <section className="form-panel"><h2>รายงาน</h2>
        <div className="actions" role="tablist" aria-label="ประเภทรายงาน">{tabs.map(item =>
          <button key={item.id} role="tab" aria-selected={tab === item.id} className="secondary-button"
            onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
        {tab === "group" && <div className="table-wrap"><table><thead><tr><th>กลุ่ม</th><th>เกณฑ์</th><th>q</th><th>จำนวน</th><th>คะแนนถ่วง</th><th>รวมกลุ่ม</th><th>Flags</th></tr></thead><tbody>
          {output.groups.flatMap(g => g.criteria.map(c => <tr key={`${g.id}:${c.criterionId}`}>
            <td>{g.name}</td><td>{c.name}</td><td>{show(c.q)}</td><td>{c.comparisons}</td>
            <td>{show(c.weightedScore)}</td><td>{show(g.component)}</td><td>{g.flags.join(", ")}</td></tr>))}
        </tbody></table></div>}
        {tab === "individual" && <div className="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>กลุ่ม</th><th>รายบุคคล</th><th>ส่ง/มอบหมาย</th><th>M</th><th>รวม</th><th>Flags</th></tr></thead><tbody>
          {output.students.map(s => <tr key={s.id}><td>{s.displayName}</td><td>{show(s.groupComponent)}</td>
            <td>{show(s.individualComponent)}</td><td>{s.answered}/{s.assigned}</td><td>{s.M.toFixed(3)}</td>
            <td>{show(s.total)}</td><td>{s.flags.join(", ")}</td></tr>)}
        </tbody></table></div>}
        {tab === "coverage" && <div className="table-wrap"><table><thead><tr><th>ด้าน</th><th>Criterion ID</th><th>คู่ A / B</th><th>ส่ง/มอบหมาย</th><th>ค่าเฉลี่ยของ A</th></tr></thead><tbody>
          {output.pairSummary?.map(p => <tr key={`${p.side}:${p.criterionId}:${p.aId}:${p.bId}`}><td>{p.side}</td>
            <td>{p.criterionId.slice(0, 8)}</td><td>{p.aId.slice(0, 8)} / {p.bId.slice(0, 8)}</td>
            <td>{p.answered}/{p.assigned}</td><td>{show(p.meanForA)}</td></tr>)}
        </tbody></table>{!output.pairSummary && <p>Snapshot รุ่นนี้ยังไม่มีผลรวมต่อคู่ โปรดคำนวณ Interim ใหม่หากต้องการข้อมูลนี้</p>}</div>}
        {tab === "quality" && <>
          <p>สัญญาณใช้ช่วยทบทวนคำตอบ ไม่ลดน้ำหนักหรือลบคำตอบอัตโนมัติ</p>
          <ul className="plain-list">{quality.flatMap(row => row.flags.map(flag =>
            <li key={`${row.name}:${flag}`}>{row.name}: {flag}</li>))}</ul>
          {output.quality ? <>
            <p className="fine-print">รหัสผู้ประเมินใช้เฉพาะ snapshot นี้ QS-02/03 แยกตามด้านและใช้คำตอบที่ส่งล่าสุด;
              QS-04 แยกตามเกณฑ์และนับเฉพาะชุดสามรายการที่ตอบครบ สัญญาณจากคำตอบจำนวนน้อยต้องทบทวนด้วยความระมัดระวัง</p>
            <div className="table-wrap"><table><caption>สัญญาณคุณภาพ QS-02–04</caption><thead><tr>
              <th>สัญญาณ</th><th>รหัสผู้ประเมิน</th><th>ด้าน / เกณฑ์</th><th>พบ / ตรวจได้</th><th>สัดส่วน</th><th>เกณฑ์</th><th>ผล</th>
            </tr></thead><tbody>{output.quality.measures.map(row => <tr
              key={`${row.id}:${row.evaluatorCode}:${row.side}:${row.criterionId}`}>
              <td>{row.id === "QS-02" ? "QS-02 เลือกค่าเดิม" : row.id === "QS-03" ? "QS-03 เลือกฝั่งเดียว" : "QS-04 คำตอบวนขัดกัน"}</td>
              <td>{row.evaluatorCode}</td><td>{row.side}{row.criterionId ? ` / ${chartCriteria.find(c => c[0] === row.criterionId)?.[1] ?? row.criterionId.slice(0, 8)}` : ""}</td>
              <td>{row.count} / {row.total}</td><td>{row.ratio === null ? "ข้อมูลไม่พอ" : `${(row.ratio * 100).toFixed(1)}%`}</td>
              <td>&gt; {row.threshold * 100}%</td><td>{row.ratio === null ? "ตรวจไม่ได้" : row.flagged ? "ควรทบทวน" : "ไม่พบสัญญาณ"}</td>
            </tr>)}</tbody></table></div>
            {output.quality.measures.length === 0 && <p>ยังไม่มีคำตอบที่ส่งสำหรับตรวจ QS-02–04</p>}
          </> : <p>Snapshot รุ่นนี้ยังไม่มี QS-02–04 โปรดคำนวณ Interim ใหม่หากต้องการตรวจ</p>}
          <p className="fine-print">QS-05 ยังไม่เก็บเวลา; QS-06 และ QS-07 ยังไม่คำนวณ จึงยังสรุปคุณภาพครบชุดไม่ได้</p>
        </>}
        <div className="actions"><button className="secondary-button" disabled={busy} onClick={() => download("csv")}>ดาวน์โหลด CSV</button>
          <button className="secondary-button" disabled={busy} onClick={() => download("xlsx")}>ดาวน์โหลด XLSX 4 sheet</button>
          {rawExportReady && <button className="secondary-button" disabled={busy}
            onClick={() => download("csv", true)}>ดาวน์โหลดคำตอบดิบแบบรหัสผู้ประเมิน</button>}</div>
        {rawExportReady && <p className="fine-print">ไฟล์คำตอบดิบใช้รหัสแทนตัวผู้ประเมินและบันทึก audit การส่งออก</p>}
      </section>
      <section className="form-panel"><h2>การกระจายค่า q ต่อเกณฑ์</h2>
        <label className="field">เกณฑ์<select value={chartCriterion || chartCriteria[0]?.[0] || ""}
          onChange={e => setChartCriterion(e.target.value)}>{chartCriteria.map(([criterionId, name]) =>
            <option key={criterionId} value={criterionId}>{name}</option>)}</select></label>
        <p className="fine-print">จำนวน item ที่มีข้อมูลในช่วง q 0–20%, 20–40%, 40–60%, 60–80%, 80–100%</p>
        <div role="img" aria-label={`การกระจายค่า q ${distribution.join(", ")}`}>
          {distribution.map((count, index) => <p key={index}>{index * 20}–{(index + 1) * 20}%: {"▰".repeat(count)} {count}</p>)}</div>
      </section>
      {snapshot.assignmentStatus !== "FINALIZED" && <section className="form-panel"><h2>Override คะแนน</h2>
        <label className="field">ด้าน<select value={overrideSide} onChange={e => { setOverrideSide(e.target.value as typeof overrideSide); setOverrideItem(""); }}><option value="GROUP">กลุ่ม</option><option value="INDIVIDUAL">รายบุคคล</option></select></label>
        <label className="field">รายการ<select value={overrideItem} onChange={e => setOverrideItem(e.target.value)}><option value="">เลือก</option>
          {(overrideSide === "GROUP" ? output.groups : output.students).map(row =>
            <option key={row.id} value={row.id}>{"name" in row ? row.name : row.displayName}</option>)}</select></label>
        <label className="field">คะแนนใหม่<input type="number" min="0" step="0.0001" value={overrideValue} onChange={e => setOverrideValue(Number(e.target.value))} /></label>
        <label className="field">เหตุผล (อย่างน้อย 10 ตัวอักษร)<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="primary-button" disabled={busy || !overrideItem || reason.trim().length < 10} onClick={override}>บันทึก Override</button>
      </section>}
      <section className="form-panel"><h2>อุทธรณ์</h2>
        {appeals.length === 0 ? <p>ยังไม่มีคำอุทธรณ์</p> : <ul className="plain-list">
          {appeals.map(row => <li key={row.id}>{output.students.find(s => s.id === row.studentId)?.displayName ?? row.studentId.slice(0, 8)}
            {` · ${row.status} · ${row.message}`}{row.resolution ? ` · ${row.resolution}` : ""}</li>)}
        </ul>}
        {appeals.some(row => row.status === "OPEN") && <>
          <label className="field">คำอุทธรณ์<select value={appealId} onChange={e => setAppealId(e.target.value)}><option value="">เลือก</option>
            {appeals.filter(row => row.status === "OPEN").map(row => <option key={row.id} value={row.id}>{row.id.slice(0, 8)}</option>)}</select></label>
          <label className="field">คำตอบ (อย่างน้อย 10 ตัวอักษร)<textarea value={resolution} onChange={e => setResolution(e.target.value)} /></label>
          <div className="actions"><button className="primary-button" disabled={busy || !appealId || resolution.trim().length < 10}
            onClick={() => resolveAppeal("RESOLVED")}>ยืนยัน/ตอบกลับ</button>
          <button className="secondary-button" disabled={busy || !appealId || resolution.trim().length < 10}
            onClick={() => resolveAppeal("REJECTED")}>ปฏิเสธพร้อมเหตุผล</button></div>
          <p className="fine-print">หากปรับคะแนน ให้ Reopen, Override และ Finalize snapshot ใหม่ก่อนตอบกลับ</p>
        </>}
      </section>
      <section className="form-panel"><h2>Audit timeline ของห้องเรียน</h2>
        <p className="fine-print">แสดงเหตุการณ์จากฐาน audit แยก โดยไม่แสดงตัวตนผู้ประเมิน</p>
        <div className="table-wrap"><table><thead><tr><th>เวลา UTC</th><th>เหตุการณ์</th><th>ทรัพยากร</th><th>Request</th></tr></thead><tbody>
          {auditRows.map(row => <tr key={`${row.requestId}:${row.action}`}>
            <td>{row.occurredAt}</td><td>{row.action}</td>
            <td>{row.resourceType} {row.resourceId.slice(0, 8)}</td>
            <td>{row.requestId.slice(0, 8)}</td></tr>)}
        </tbody></table></div>
      </section>
    </>}
  </main>;
}
