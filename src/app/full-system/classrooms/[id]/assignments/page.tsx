"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { classroomInputToUtc, utcToClassroomInput } from "@/lib/full-system-timezone";

type Criterion = { side: "GROUP" | "INDIVIDUAL"; name: string; weightPct: number };
type Artifact = { side: "GROUP" | "INDIVIDUAL"; itemId: string; url: string };
type Input = { name: string; description: string; artifactOverviewUrl: string; groupMaxScore: number;
  individualMaxScore: number; groupDeadline: string | null; individualDeadline: string | null;
  targetCoverage: number; maxWorkload: number; instructorWeight: number; scoreFloor: number; scoreCeiling: number;
  criteria: Criterion[]; artifacts: Artifact[] };
type Assignment = Input & { id: string; status: string; generation: number;
  generations: Array<{ generation: number; status: string; invalidated_reason: string | null }>;
  persistedAssignments: Array<{ generation: number; side: string; n: number }>;
  currentPairs: Array<{ id: string; side: string; criterion_name: string;
    group_a_id: string | null; group_b_id: string | null;
    student_a_id: string | null; student_b_id: string | null; evaluator_count: string }> };
type Plan = { feasible: boolean; parts: Array<{ side: string; groupId?: string; pairCount: number;
  coverage: number; requested: number; assignmentCount: number; reason: string | null; lowConfidence: boolean }> };
type RosterRow = { id: string; displayName: string; groupId: string; groupName: string };
type RosterPreview = { errors: string[]; warnings: string[]; digest: string; version: number;
  diff: { added: number; moved: number; unchanged: number } };
const empty: Input = { name: "", description: "", artifactOverviewUrl: "", groupMaxScore: 10,
  individualMaxScore: 0, groupDeadline: null, individualDeadline: null, targetCoverage: 5,
  maxWorkload: 8, instructorWeight: 1, scoreFloor: .6, scoreCeiling: 1,
  criteria: [{ side: "GROUP", name: "", weightPct: 100 }], artifacts: [] };
const url = (id: string) => `/api/full-system/assignments/${id}`;
const displayDate = (value: string | null, timeZone: string) => value ? new Date(value).toLocaleString("th-TH", { timeZone }) : "ยังไม่กำหนด";
const toInput = (assignment: Assignment): Input => ({ name: assignment.name, description: assignment.description ?? "",
  artifactOverviewUrl: assignment.artifactOverviewUrl ?? "", groupMaxScore: assignment.groupMaxScore,
  individualMaxScore: assignment.individualMaxScore, groupDeadline: assignment.groupDeadline,
  individualDeadline: assignment.individualDeadline, targetCoverage: assignment.targetCoverage,
  maxWorkload: assignment.maxWorkload, instructorWeight: assignment.instructorWeight,
  scoreFloor: assignment.scoreFloor, scoreCeiling: assignment.scoreCeiling,
  criteria: assignment.criteria, artifacts: assignment.artifacts });

export default function AssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const router=useRouter();
  const { id: classroomId } = use(params);
  const [rows, setRows] = useState<Array<{ id: string; name: string; status: string; generation: number }>>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterVersion, setRosterVersion] = useState(0);
  const [owner, setOwner] = useState(false);
  const [withdrawUser, setWithdrawUser] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [rosterCsv, setRosterCsv] = useState("");
  const [rosterPreview, setRosterPreview] = useState<RosterPreview | null>(null);
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [form, setForm] = useState<Input>(empty);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [seed, setSeed] = useState("1");
  const [extraPairId, setExtraPairId] = useState("");
  const [extraCount, setExtraCount] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(path, { method, cache: "no-store", headers: method === "GET" ? {} :
      { "Content-Type": "application/json", Origin: window.location.origin }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json();
    if (response.status === 202) throw new Error("ยังรอยืนยันบันทึก audit โปรดโหลดข้อมูลใหม่ก่อนทำรายการซ้ำ");
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? `HTTP ${response.status}`);
    return payload.data;
  }, []);
  const refresh = useCallback(async () => {
    const [assignments, people, classrooms] = await Promise.all([
      request(`/api/full-system/classrooms/${classroomId}/assignments`),
      request(`/api/full-system/classrooms/${classroomId}/roster`),
      request("/api/full-system/classrooms")]);
    setRows(assignments); setRoster(people);
    setRosterVersion(classrooms.find((room: { id: string }) => room.id === classroomId)?.rosterVersion ?? 0);
    setOwner(classrooms.find((room: { id: string }) => room.id === classroomId)?.role === "OWNER");
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
          setOwner(classrooms.find((room: { id: string }) => room.id === classroomId)?.role === "OWNER");
          setRosterVersion(classrooms.find((room: { id: string }) => room.id === classroomId)?.rosterVersion ?? 0);
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
  const addEvaluators = (mode: "STUDENT" | "INSTRUCTOR") => action(async () => {
    if (!selected || !extraPairId) throw new Error("เลือกคู่ก่อนเพิ่มผู้ประเมิน");
    await request(`${url(selected.id)}/evaluators`, "POST", {
      pairId: extraPairId, mode, count: mode === "INSTRUCTOR" ? 1 : extraCount });
    await open(selected.id);
    setMessage(mode === "INSTRUCTOR" ? "เพิ่มคู่ประเมินของผู้สอนแล้ว" : "เพิ่มผู้ประเมินและแจ้งเตือนแล้ว");
  });
  const previewCsv = () => action(async () => {
    setRosterPreview(await request(`/api/full-system/classrooms/${classroomId}/roster/preview`,
      "POST", { csv: rosterCsv }));
  });
  const importCsv = () => action(async () => {
    if (!rosterPreview || rosterPreview.version !== rosterVersion) throw new Error("ตรวจ CSV ใหม่ก่อนนำเข้า");
    await request(`/api/full-system/classrooms/${classroomId}/roster/import`, "POST", {
      csv: rosterCsv, expectedVersion: rosterPreview.version, confirmDigest: rosterPreview.digest });
    setRosterPreview(null);
    await refresh();
    if (selected) await open(selected.id);
    setMessage("นำเข้ารายชื่อแล้ว ตรวจ feasibility และเผยแพร่ generation ใหม่");
  });
  const change = <K extends keyof Input>(key: K, value: Input[K]) => { setForm(current => ({ ...current, [key]: value })); setPlan(null); };
  const groups = [...new Map(roster.map(person => [person.groupId, person.groupName])).entries()];
  return <main className="fs-page fs-instructor-page">
    <a className="fs-back-link" href="/full-system"><span aria-hidden="true">←</span> กลับไปหน้าห้องเรียน</a>
    <header className="fs-page-heading"><div><span className="eyebrow">พื้นที่อาจารย์ · จัดการห้องเรียน</span>
      <h1>งานประเมินและแผนจับคู่</h1><p>สร้างงาน ตรวจแผนการจับคู่ แล้วเผยแพร่ให้นักศึกษาทำ</p></div>
      <span className="fs-teacher-mark" aria-hidden="true">▣</span></header>
    {owner&&<details className="form-panel"><summary>เก็บห้องเรียนเมื่อจบรายวิชา</summary><p>ห้องเรียนจะเป็นแบบอ่านอย่างเดียวและย้ายไปหน้าห้องเรียนที่เก็บแล้ว</p><button className="secondary-button" onClick={()=>{if(window.confirm("เก็บห้องเรียนนี้เป็นแบบอ่านอย่างเดียวหรือไม่?"))void action(async()=>{await request(`/api/full-system/classrooms/${classroomId}/archive`,"POST",{archived:true});router.push("/full-system/archive")})}}>เก็บห้องเรียน</button></details>}
    {message && <p className="notice" role="status">{message}</p>}
    <section className="form-panel fs-assignment-list"><div className="fs-section-heading"><div><span className="eyebrow">ขั้นที่ 1</span><h2>งานในห้องเรียน</h2></div>
      <button className="primary-button" onClick={() => { setSelected(null); setForm(empty); setPlan(null); }}>＋ สร้างงานใหม่</button></div>
      {rows.length === 0 && <p className="fs-muted-copy">ยังไม่มีงาน สร้างงานแรกของห้องเรียนได้จากปุ่มด้านบน</p>}
      <div className="fs-assignment-picker">
        {rows.map(row => <button className="secondary-button" key={row.id} onClick={() => action(() => open(row.id))}>
          <span>{row.name}</span><small>{row.status === "OPEN" ? "กำลังเปิดรับ" : row.status === "DRAFT" ? "ฉบับร่าง" : row.status} · รุ่น {row.generation}</small></button>)}</div>
    </section>
    <details className="fs-roster-tools"><summary><span><strong>จัดการรายชื่อนักศึกษาและกลุ่ม</strong><small>{roster.length} คน · รุ่นรายชื่อ {rosterVersion}</small></span><span aria-hidden="true">⌄</span></summary>
      <section className="form-panel"><h2>นำเข้ารายชื่อหรือปรับกลุ่ม</h2>
        <p className="fine-print">ต้องยกเลิกเผยแพร่งานที่ยังใช้งานอยู่ก่อน · คู่และคำตอบรุ่นเดิมจะยังอยู่ในประวัติ</p>
        <label className="field">CSV รายชื่อ<textarea value={rosterCsv} placeholder="email,group_name,student_id,display_name"
          onChange={e => { setRosterCsv(e.target.value); setRosterPreview(null); }} /></label>
        <div className="actions"><button className="secondary-button" disabled={busy || !rosterCsv.trim()} onClick={previewCsv}>ตรวจข้อมูลและดูการเปลี่ยนกลุ่ม</button>
          <button className="primary-button" disabled={busy || !rosterPreview || selected?.status !== "DRAFT"} onClick={importCsv}>ยืนยันนำเข้ารายชื่อ</button></div>
        {rosterPreview && <p role="status" className="notice">เพิ่ม {rosterPreview.diff.added} · ย้ายกลุ่ม {rosterPreview.diff.moved} · คงเดิม {rosterPreview.diff.unchanged}
          {rosterPreview.warnings.length ? ` · ${rosterPreview.warnings.join("; ")}` : ""}</p>}
      </section>
      {owner && <section className="form-panel fs-synthetic-tools"><h2>เครื่องมือทดสอบข้อมูลตัวอย่าง</h2>
        <p className="fine-print">ใช้สำหรับทดสอบการถอนสมาชิกและจัดสรรงานใหม่ในข้อมูลสังเคราะห์เท่านั้น</p>
        <label className="field">นักศึกษาที่จะถอน<select value={withdrawUser} onChange={e => setWithdrawUser(e.target.value)}>
          <option value="">เลือกนักศึกษา</option>{roster.map(student => <option key={student.id} value={student.id}>{student.displayName} · {student.groupName}</option>)}
        </select></label>
        <label className="field">เหตุผลถอน<textarea value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} /></label>
        <button className="secondary-button" disabled={busy || !withdrawUser || withdrawReason.trim().length < 10}
          onClick={() => action(async () => {
            if (!window.confirm("ยืนยันถอนสมาชิกข้อมูลตัวอย่างและจัดสรรงานปัจจุบันใหม่? ประวัติเดิมยังอยู่")) return;
            await request(`/api/full-system/classrooms/${classroomId}/members/${withdrawUser}/withdraw`, "POST",
              { reason: withdrawReason, effectiveAt: new Date().toISOString(), expectedRosterVersion: rosterVersion });
            setWithdrawUser(""); setWithdrawReason("");
            if (selected) await open(selected.id);
            setMessage("ถอนสมาชิกข้อมูลตัวอย่างและบันทึกคะแนนปัจจุบันใหม่แล้ว");
          })}>ถอนสมาชิกข้อมูลตัวอย่าง</button>
      </section>}
    </details>
    <section className="form-panel fs-editor-panel"><div className="fs-section-heading"><div><span className="eyebrow">ขั้นที่ 2</span>
      <h2>{selected ? `แก้ไข ${selected.name}` : "ตั้งค่างานประเมิน"}</h2></div>
      {selected && <span className="fs-status-badge">{selected.status === "DRAFT" ? "ฉบับร่าง" : selected.status} · รุ่น {selected.generation}</span>}</div>
      {!selected && <p className="fs-muted-copy">กรอกข้อมูลงาน เกณฑ์ และกำหนดส่ง จากนั้นบันทึกฉบับร่างก่อนตรวจแผนจับคู่</p>}
      {selected && <p className="fine-print">สถานะ {selected.status} · generation {selected.generation}</p>}
      <label className="field">ชื่องาน<input value={form.name} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("name", e.target.value)} /></label>
      <label className="field">คำอธิบาย<textarea value={form.description} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("description", e.target.value)} /></label>
      <label className="field">ลิงก์ภาพรวมไฟล์งาน HTTPS<input type="url" value={form.artifactOverviewUrl} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("artifactOverviewUrl", e.target.value)} /></label>
      <div className="form-grid">
        {(["groupMaxScore", "individualMaxScore", "targetCoverage", "maxWorkload"] as const).map(key => <label className="field" key={key}>{({ groupMaxScore: "คะแนนกลุ่ม", individualMaxScore: "คะแนนรายบุคคล", targetCoverage: "ผู้ประเมินต่อคู่ที่ต้องการ", maxWorkload: "งานสูงสุดต่อผู้ประเมิน" })[key]}<input type="number" min="0" value={form[key]} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change(key, Number(e.target.value))} /></label>)}
      </div>
      <label className="field">น้ำหนักคำตอบผู้สอน (0–99.99; นักศึกษา = 1)<input type="number" min="0" max="99.99" step="0.01"
        value={form.instructorWeight} disabled={selected?.status !== undefined && selected.status !== "DRAFT"}
        onChange={e => change("instructorWeight", Number(e.target.value))} /></label>
      <div className="form-grid">{(["groupDeadline", "individualDeadline"] as const).map(key => <label className="field" key={key}>{key === "groupDeadline" ? "กำหนดส่งกลุ่ม" : "กำหนดส่งรายบุคคล"} ({timezone})<input type="datetime-local" value={utcToClassroomInput(form[key], timezone)} disabled={selected?.status !== undefined && !["DRAFT", "OPEN", "CLOSED"].includes(selected.status)} onChange={e => change(key, classroomInputToUtc(e.target.value, timezone))} /></label>)}</div>
      <h2>เกณฑ์และน้ำหนัก</h2><p className="fine-print">แต่ละด้านที่เปิดใช้ต้องรวม 100%</p>
      {form.criteria.map((criterion, index) => <div className="criteria-row" key={index}>
        <label>ด้าน<select value={criterion.side} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("criteria", form.criteria.map((row, i) => i === index ? { ...row, side: e.target.value as Criterion["side"] } : row))}><option value="GROUP">กลุ่ม</option><option value="INDIVIDUAL">รายบุคคล</option></select></label>
        <label>ชื่อเกณฑ์<input value={criterion.name} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("criteria", form.criteria.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /></label>
        <label>น้ำหนัก %<input type="number" min="0" max="100" value={criterion.weightPct} disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("criteria", form.criteria.map((row, i) => i === index ? { ...row, weightPct: Number(e.target.value) } : row))} /></label>
        <button className="remove-button" disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onClick={() => change("criteria", form.criteria.filter((_, i) => i !== index))}>ลบ</button>
      </div>)}
      <button className="secondary-button" disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onClick={() => change("criteria", [...form.criteria, { side: "GROUP", name: "", weightPct: 0 }])}>เพิ่มเกณฑ์</button>
      <div className="form-grid">
        <label className="field">สัดส่วนคะแนนต่ำสุด<input type="number" min="0" max="1" step=".001" value={form.scoreFloor}
          disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("scoreFloor", Number(e.target.value))} /></label>
        <label className="field">สัดส่วนคะแนนสูงสุด<input type="number" min="0" max="1" step=".001" value={form.scoreCeiling}
          disabled={selected?.status !== undefined && selected.status !== "DRAFT"} onChange={e => change("scoreCeiling", Number(e.target.value))} /></label>
      </div><p className="fine-print">คะแนน = คะแนนเต็ม × น้ำหนักเกณฑ์ × (ค่าต่ำสุด + (ค่าสูงสุด − ค่าต่ำสุด) × q) · ค่าเริ่มต้น 0.6–1</p>
      <h2>ลิงก์ไฟล์งานรายชิ้น</h2><p className="fine-print">ใส่ลิงก์ HTTPS เฉพาะรายการที่มีไฟล์</p>
      {[...groups.map(([itemId, name]) => ({ side: "GROUP" as const, itemId, name: `กลุ่ม ${name}` })),
        ...roster.map(person => ({ side: "INDIVIDUAL" as const, itemId: person.id, name: person.displayName }))].map(item => <label className="field" key={`${item.side}:${item.itemId}`}>{item.name}<input type="url" placeholder="https://…" disabled={selected?.status !== undefined && selected.status !== "DRAFT"} value={form.artifacts.find(row => row.side === item.side && row.itemId === item.itemId)?.url ?? ""} onChange={e => change("artifacts", [...form.artifacts.filter(row => row.side !== item.side || row.itemId !== item.itemId), ...(e.target.value ? [{ side: item.side, itemId: item.itemId, url: e.target.value }] : [])])} /></label>)}
      <div className="actions">{(!selected || selected.status === "DRAFT") && <button className="primary-button" disabled={busy} onClick={save}>บันทึก DRAFT</button>}
        {selected && ["OPEN", "CLOSED"].includes(selected.status) && <button className="primary-button" disabled={busy} onClick={saveDeadlines}>บันทึกกำหนดส่ง</button>}
        {selected && <button className="secondary-button" disabled={busy} onClick={clone}>คัดลอกเป็น DRAFT</button>}
        {selected && selected.status !== "DRAFT" && <button className="secondary-button" disabled={busy} onClick={unpublish}>ยกเลิกเผยแพร่</button>}</div>
    </section>
    {selected && <section className="form-panel fs-pairing-panel"><div className="fs-section-heading"><div><span className="eyebrow">ขั้นที่ 3</span><h2>ตรวจแผนจับคู่</h2></div></div>
      <label className="field">Seed สำหรับผลที่ทำซ้ำได้<input value={seed} onChange={e => { setSeed(e.target.value); setPlan(null); }} /></label>
      {selected.status === "DRAFT" && <button className="secondary-button" disabled={busy} onClick={feasible}>คำนวณ feasibility</button>}
      {plan && <div className={plan.feasible ? "preview-box" : "error-box"}>
        <strong>{plan.feasible ? "พร้อมเผยแพร่" : "ยังจับคู่ไม่ได้"}</strong>
        <div className="table-wrap"><table><thead><tr><th>ด้าน</th><th>จำนวนคู่</th><th>Coverage</th><th>งานที่แจก</th><th>เหตุผล/ข้อควรระวัง</th></tr></thead><tbody>
          {plan.parts.map((part, index) => <tr key={index}><td>{part.side}{part.groupId ? ` · ${groups.find(group => group[0] === part.groupId)?.[1] ?? part.groupId}` : ""}</td><td>{part.pairCount}</td><td>{part.coverage}/{part.requested}</td><td>{part.assignmentCount}</td><td>{part.reason ?? (part.lowConfidence ? "กลุ่ม 3 คน: ความเชื่อมั่นต่ำ" : "พร้อม")}</td></tr>)}
        </tbody></table></div></div>}
      {selected.status === "DRAFT" && plan?.feasible && <button className="primary-button" disabled={busy} onClick={publish}>เผยแพร่และบันทึกคู่</button>}
      {selected.status === "OPEN" && selected.currentPairs.length > 0 && <div className="preview-box">
        <h3>ประเมินเองหรือเพิ่มผู้ประเมิน</h3>
        <label className="field">คู่และเกณฑ์<select value={extraPairId} onChange={e => setExtraPairId(e.target.value)}>
          <option value="">เลือกคู่</option>
          {[...new Map(selected.currentPairs.map(pair => [
            `${pair.side}:${pair.criterion_name}:${pair.group_a_id}:${pair.group_b_id}:${pair.student_a_id}:${pair.student_b_id}`, pair])).values()].map(pair =>
            <option key={pair.id} value={pair.id}>{pair.side} · {pair.criterion_name} · {
              pair.side === "GROUP" ? `${groups.find(g => g[0] === pair.group_a_id)?.[1] ?? "?"} / ${groups.find(g => g[0] === pair.group_b_id)?.[1] ?? "?"}` :
                `${roster.find(p => p.id === pair.student_a_id)?.displayName ?? "?"} / ${roster.find(p => p.id === pair.student_b_id)?.displayName ?? "?"}`}
              {` · ผู้ประเมิน ${pair.evaluator_count} คน`}</option>)}</select></label>
        <label className="field">จำนวนผู้ประเมินนักศึกษาเพิ่ม<input type="number" min="1" max="20" value={extraCount}
          onChange={e => setExtraCount(Number(e.target.value))} /></label>
        <div className="actions"><button className="secondary-button" disabled={busy || !extraPairId} onClick={() => addEvaluators("STUDENT")}>เพิ่มผู้ประเมิน</button>
          <button className="secondary-button" disabled={busy || !extraPairId} onClick={() => addEvaluators("INSTRUCTOR")}>มอบคู่ให้ตนเอง</button>
          <a className="secondary-button" href={`/full-system/assignments/${selected.id}/evaluate/group`}>ประเมินกลุ่ม</a>
          <a className="secondary-button" href={`/full-system/assignments/${selected.id}/evaluate/individual`}>ประเมินรายบุคคล</a></div>
      </div>}
      <p><a href={`/full-system/assignments/${selected.id}/reports`}>ดูรายงานและตัดสินคะแนน →</a></p>
      <h2>ประวัติ generation</h2><ul className="plain-list">{selected.generations.map(row => <li key={row.generation}>รุ่น {row.generation} · {row.status}{row.invalidated_reason ? ` · ${row.invalidated_reason}` : ""}</li>)}</ul>
      <p className="fine-print">เวลาเส้นตายกลุ่ม: {displayDate(selected.groupDeadline, timezone)} · รายบุคคล: {displayDate(selected.individualDeadline, timezone)} ({timezone})</p>
    </section>}
  </main>;
}
