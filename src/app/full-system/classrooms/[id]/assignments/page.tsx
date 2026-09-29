"use client";

import { use, useCallback, useEffect, useState } from "react";
import { classroomInputToUtc, utcToClassroomInput } from "@/lib/full-system-timezone";

type Criterion = { side: "GROUP" | "INDIVIDUAL"; name: string; weightPct: number };
type Artifact = { side: "GROUP" | "INDIVIDUAL"; itemId: string; url: string };
type Input = { name: string; description: string; artifactOverviewUrl: string; groupMaxScore: number;
  individualMaxScore: number; groupDeadline: string | null; individualDeadline: string | null;
  targetCoverage: number; maxWorkload: number; criteria: Criterion[]; artifacts: Artifact[] };
type Assignment = Input & { id: string; status: string; generation: number;
  generations: Array<{ generation: number; status: string; invalidated_reason: string | null }>;
  persistedAssignments: Array<{ generation: number; side: string; n: number }> };
type Plan = { feasible: boolean; parts: Array<{ side: string; groupId?: string; pairCount: number;
  coverage: number; requested: number; assignmentCount: number; reason: string | null; lowConfidence: boolean }> };
type RosterRow = { id: string; displayName: string; groupId: string; groupName: string };
const empty: Input = { name: "", description: "", artifactOverviewUrl: "", groupMaxScore: 10,
  individualMaxScore: 0, groupDeadline: null, individualDeadline: null, targetCoverage: 5,
  maxWorkload: 8, criteria: [{ side: "GROUP", name: "", weightPct: 100 }], artifacts: [] };
const url = (id: string) => `/api/full-system/assignments/${id}`;
const displayDate = (value: string | null, timeZone: string) => value ? new Date(value).toLocaleString("th-TH", { timeZone }) : "ยังไม่กำหนด";
const toInput = (assignment: Assignment): Input => ({ name: assignment.name, description: assignment.description ?? "",
  artifactOverviewUrl: assignment.artifactOverviewUrl ?? "", groupMaxScore: assignment.groupMaxScore,
  individualMaxScore: assignment.individualMaxScore, groupDeadline: assignment.groupDeadline,
  individualDeadline: assignment.individualDeadline, targetCoverage: assignment.targetCoverage,
  maxWorkload: assignment.maxWorkload, criteria: assignment.criteria, artifacts: assignment.artifacts });

export default function AssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = use(params);
  const [rows, setRows] = useState<Array<{ id: string; name: string; status: string; generation: number }>>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [form, setForm] = useState<Input>(empty);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [seed, setSeed] = useState("1");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(path, { method, cache: "no-store", headers: method === "GET" ? {} :
      { "Content-Type": "application/json", Origin: window.location.origin }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`);
    return payload.data;
  }, []);
  const refresh = useCallback(async () => {
    const [assignments, people] = await Promise.all([
      request(`/api/full-system/classrooms/${classroomId}/assignments`),
      request(`/api/full-system/classrooms/${classroomId}/roster`)]);
    setRows(assignments); setRoster(people);
  }, [classroomId, request]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [assignments, people, classrooms] = await Promise.all([
          request(`/api/full-system/classrooms/${classroomId}/assignments`),
          request(`/api/full-system/classrooms/${classroomId}/roster`),
          request("/api/full-system/classrooms")]);
        if (active) { setRows(assignments); setRoster(people);
          setTimezone(classrooms.find((room: { id: string }) => room.id === classroomId)?.timezone ?? "Asia/Bangkok"); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ"); }
    })();
    return () => { active = false; };
  }, [classroomId, request]);
  const open = async (id: string) => {
    const detail = await request(url(id)) as Assignment;
    setSelected(detail); setForm(toInput(detail)); setPlan(null); setMessage("");
  };
  const action = async (job: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await job(); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const save = () => action(async () => {
    const result = selected ? await request(url(selected.id), "PUT", form) :
      await request(`/api/full-system/classrooms/${classroomId}/assignments`, "POST", form);
    await open(result.id); setMessage("บันทึก DRAFT แล้ว");
  });
  const feasible = () => action(async () => {
    if (!selected) throw new Error("บันทึก DRAFT ก่อนตรวจแผน");
    setPlan(await request(`${url(selected.id)}/feasibility?seed=${encodeURIComponent(seed)}`));
  });
  const publish = () => action(async () => {
    if (!selected || !plan?.feasible) throw new Error("ตรวจแผนที่เป็นไปได้ก่อนเผยแพร่");
    await request(`${url(selected.id)}/publish`, "POST", { seed }); await open(selected.id);
    setMessage("เผยแพร่และบันทึกคู่แล้ว");
  });
  const saveDeadlines = () => action(async () => {
    if (!selected) return;
    await request(`${url(selected.id)}/deadlines`, "PATCH", {
      ...(form.groupMaxScore > 0 ? { groupDeadline: form.groupDeadline } : {}),
      ...(form.individualMaxScore > 0 ? { individualDeadline: form.individualDeadline } : {}),
    });
    await open(selected.id); setMessage("บันทึกกำหนดส่งแล้ว");
  });
  const unpublish = () => action(async () => {
    if (!selected) return;
    const reason = window.prompt("เหตุผลที่ยกเลิกการเผยแพร่ (อย่างน้อย 5 ตัวอักษร)");
    if (reason === null) return;
    await request(`${url(selected.id)}/unpublish`, "POST", { reason }); await open(selected.id);
    setMessage("กลับเป็น DRAFT; คู่รุ่นเดิมยังอยู่ในประวัติ");
  });
  const clone = () => action(async () => {
    if (!selected) return;
    const name = window.prompt("ชื่องานที่คัดลอก", `${selected.name} (สำเนา)`);
    if (name === null) return;
    const result = await request(`${url(selected.id)}/clone`, "POST", { name }); await open(result.id);
    setMessage("คัดลอกเฉพาะการตั้งค่าเป็น DRAFT; ตรวจวันครบกำหนดและไฟล์ก่อนเผยแพร่");
  });
  const change = <K extends keyof Input>(key: K, value: Input[K]) => { setForm(current => ({ ...current, [key]: value })); setPlan(null); };
  const groups = [...new Map(roster.map(person => [person.groupId, person.groupName])).entries()];
  return <main className="assignment-shell">
    <p><a href="/full-system">← ห้องเรียน</a></p><span className="eyebrow">PairEval Full System · FS05–FS07</span>
    <h1>งานประเมินและแผนจับคู่</h1>
    <p className="lead">สร้างงานฉบับร่าง ตรวจจำนวนคู่และภาระงาน แล้วจึงเผยแพร่</p>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="form-panel"><h2>งานในห้องเรียน</h2>
      <div className="actions"><button className="secondary-button" onClick={() => { setSelected(null); setForm(empty); setPlan(null); }}>สร้างงานใหม่</button>
        {rows.map(row => <button className="secondary-button" key={row.id} onClick={() => action(() => open(row.id))}>
          {row.name} · {row.status} · รุ่น {row.generation}</button>)}</div>
    </section>
    <section className="form-panel"><h2>{selected ? `แก้ไข ${selected.name}` : "สร้าง DRAFT"}</h2>
      {selected && <p className="fine-print">สถานะ {selected.status} · generation {selected.generation}</p>}
      <label className="field">ชื่องาน<input value={form.name} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("name", e.target.value)} /></label>
      <label className="field">คำอธิบาย<textarea value={form.description} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("description", e.target.value)} /></label>
      <label className="field">ลิงก์ภาพรวมไฟล์งาน HTTPS<input type="url" value={form.artifactOverviewUrl} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("artifactOverviewUrl", e.target.value)} /></label>
      <div className="form-grid">
        {(["groupMaxScore", "individualMaxScore", "targetCoverage", "maxWorkload"] as const).map(key => <label className="field" key={key}>{({ groupMaxScore: "คะแนนกลุ่ม", individualMaxScore: "คะแนนรายบุคคล", targetCoverage: "ผู้ประเมินต่อคู่ที่ต้องการ", maxWorkload: "งานสูงสุดต่อผู้ประเมิน" })[key]}<input type="number" min="0" value={form[key]} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change(key, Number(e.target.value))} /></label>)}
      </div>
      <div className="form-grid">{(["groupDeadline", "individualDeadline"] as const).map(key => <label className="field" key={key}>{key === "groupDeadline" ? "กำหนดส่งกลุ่ม" : "กำหนดส่งรายบุคคล"} ({timezone})<input type="datetime-local" value={utcToClassroomInput(form[key], timezone)} disabled={selected?.status !== undefined && !["DRAFT", "OPEN", "CLOSED"].includes(selected.status)} onChange={e => change(key, classroomInputToUtc(e.target.value, timezone))} /></label>)}</div>
      <h2>เกณฑ์และน้ำหนัก</h2><p className="fine-print">แต่ละด้านที่เปิดใช้ต้องรวม 100%</p>
      {form.criteria.map((criterion, index) => <div className="criteria-row" key={index}>
        <label>ด้าน<select value={criterion.side} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("criteria", form.criteria.map((row, i) => i === index ? { ...row, side: e.target.value as Criterion["side"] } : row))}><option value="GROUP">กลุ่ม</option><option value="INDIVIDUAL">รายบุคคล</option></select></label>
        <label>ชื่อเกณฑ์<input value={criterion.name} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("criteria", form.criteria.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /></label>
        <label>น้ำหนัก %<input type="number" min="0" max="100" value={criterion.weightPct} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("criteria", form.criteria.map((row, i) => i === index ? { ...row, weightPct: Number(e.target.value) } : row))} /></label>
        <button className="remove-button" disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onClick={() => change("criteria", form.criteria.filter((_, i) => i !== index))}>ลบ</button>
      </div>)}
      <button className="secondary-button" disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onClick={() => change("criteria", [...form.criteria, { side: "GROUP", name: "", weightPct: 0 }])}>เพิ่มเกณฑ์</button>
      <h2>ลิงก์ไฟล์งานรายชิ้น</h2><p className="fine-print">ใส่ลิงก์ HTTPS เฉพาะรายการที่มีไฟล์</p>
      {[...groups.map(([itemId, name]) => ({ side: "GROUP" as const, itemId, name: `กลุ่ม ${name}` })),
        ...roster.map(person => ({ side: "INDIVIDUAL" as const, itemId: person.id, name: person.displayName }))].map(item => <label className="field" key={`${item.side}:${item.itemId}`}>{item.name}<input type="url" placeholder="https://…" disabled={selected?.status !== undefined && selected.status !== "DRAFT"} value={form.artifacts.find(row => row.side === item.side && row.itemId === item.itemId)?.url ?? ""} onChange={e => change("artifacts", [...form.artifacts.filter(row => row.side !== item.side || row.itemId !== item.itemId), ...(e.target.value ? [{ side: item.side, itemId: item.itemId, url: e.target.value }] : [])])} /></label>)}
      <div className="actions">{(!selected || selected.status === "DRAFT") && <button className="primary-button" disabled={busy} onClick={save}>บันทึก DRAFT</button>}
        {selected && ["OPEN", "CLOSED"].includes(selected.status) && <button className="primary-button" disabled={busy} onClick={saveDeadlines}>บันทึกกำหนดส่ง</button>}
        {selected && <button className="secondary-button" disabled={busy} onClick={clone}>คัดลอกเป็น DRAFT</button>}
        {selected && selected.status !== "DRAFT" && <button className="secondary-button" disabled={busy} onClick={unpublish}>ยกเลิกเผยแพร่</button>}</div>
    </section>
    {selected && <section className="form-panel"><h2>ตรวจแผนจับคู่</h2>
      <label className="field">Seed สำหรับผลที่ทำซ้ำได้<input value={seed} onChange={e => { setSeed(e.target.value); setPlan(null); }} /></label>
      {selected.status === "DRAFT" && <button className="secondary-button" disabled={busy} onClick={feasible}>คำนวณ feasibility</button>}
      {plan && <div className={plan.feasible ? "preview-box" : "error-box"}>
        <strong>{plan.feasible ? "พร้อมเผยแพร่" : "ยังจับคู่ไม่ได้"}</strong>
        <div className="table-wrap"><table><thead><tr><th>ด้าน</th><th>จำนวนคู่</th><th>Coverage</th><th>งานที่แจก</th><th>เหตุผล/ข้อควรระวัง</th></tr></thead><tbody>
          {plan.parts.map((part, index) => <tr key={index}><td>{part.side}{part.groupId ? ` · ${groups.find(group => group[0] === part.groupId)?.[1] ?? part.groupId}` : ""}</td><td>{part.pairCount}</td><td>{part.coverage}/{part.requested}</td><td>{part.assignmentCount}</td><td>{part.reason ?? (part.lowConfidence ? "กลุ่ม 3 คน: ความเชื่อมั่นต่ำ" : "พร้อม")}</td></tr>)}
        </tbody></table></div></div>}
      {selected.status === "DRAFT" && plan?.feasible && <button className="primary-button" disabled={busy} onClick={publish}>เผยแพร่และบันทึกคู่</button>}
      <h2>ประวัติ generation</h2><ul className="plain-list">{selected.generations.map(row => <li key={row.generation}>รุ่น {row.generation} · {row.status}{row.invalidated_reason ? ` · ${row.invalidated_reason}` : ""}</li>)}</ul>
      <p className="fine-print">เวลาเส้นตายกลุ่ม: {displayDate(selected.groupDeadline, timezone)} · รายบุคคล: {displayDate(selected.individualDeadline, timezone)} ({timezone})</p>
    </section>}
  </main>;
}
