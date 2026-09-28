"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type DraftCriterion = { name: string; weightPercent: string };
type Kind = "group" | "individual";

function defaultDeadline() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AssignmentForm({ classroomId, classroomName }: { classroomId: string; classroomName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [totalScore, setTotalScore] = useState("20");
  const [groupMax, setGroupMax] = useState("15");
  const [individualMax, setIndividualMax] = useState("5");
  const [groupDeadline, setGroupDeadline] = useState(defaultDeadline);
  const [individualDeadline, setIndividualDeadline] = useState(defaultDeadline);
  const [groupCriteria, setGroupCriteria] = useState<DraftCriterion[]>([{ name: "คุณภาพงาน", weightPercent: "100" }]);
  const [individualCriteria, setIndividualCriteria] = useState<DraftCriterion[]>([{ name: "การทำงานร่วมกัน", weightPercent: "100" }]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function updateCriterion(kind: Kind, index: number, key: keyof DraftCriterion, value: string) {
    const setter = kind === "group" ? setGroupCriteria : setIndividualCriteria;
    setter(previous => previous.map((criterion, position) => position === index ? { ...criterion, [key]: value } : criterion));
  }
  function addCriterion(kind: Kind) {
    const setter = kind === "group" ? setGroupCriteria : setIndividualCriteria;
    setter(previous => [...previous, { name: "", weightPercent: "" }]);
  }
  function removeCriterion(kind: Kind, index: number) {
    const setter = kind === "group" ? setGroupCriteria : setIndividualCriteria;
    setter(previous => previous.filter((_, position) => position !== index));
  }
  function renderCriteria(kind: Kind, items: DraftCriterion[]) {
    return <div className="criteria-list"><h3>เกณฑ์{kind === "group" ? "กลุ่ม" : "บุคคล"} <small>น้ำหนักรวมต้องเป็น 100%</small></h3>{items.map((criterion, index) => <div className="criteria-row" key={`${kind}-${index}`}><label>ชื่อเกณฑ์<input value={criterion.name} onChange={event => updateCriterion(kind, index, "name", event.target.value)} placeholder="ชื่อเกณฑ์" required /></label><label>น้ำหนัก %<input type="number" min="0.01" max="100" step="any" value={criterion.weightPercent} onChange={event => updateCriterion(kind, index, "weightPercent", event.target.value)} required /></label><button type="button" className="remove-button" onClick={() => removeCriterion(kind, index)} disabled={items.length === 1}>ลบ</button></div>)}<p>น้ำหนักรวมปัจจุบัน: <strong>{items.reduce((sum, item) => sum + Number(item.weightPercent || 0), 0)}%</strong></p><button type="button" className="secondary-button" onClick={() => addCriterion(kind)}>เพิ่มเกณฑ์</button></div>;
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setErrors([]);
    try {
      const payload = {
        classroomId, name, totalScore: Number(totalScore), groupMax: Number(groupMax), individualMax: Number(individualMax),
        groupDeadline: new Date(groupDeadline).toISOString(), individualDeadline: new Date(individualDeadline).toISOString(),
        groupCriteria: groupCriteria.map(item => ({ name: item.name, weightPercent: Number(item.weightPercent) })),
        individualCriteria: individualCriteria.map(item => ({ name: item.name, weightPercent: Number(item.weightPercent) })),
      };
      const response = await fetch("/api/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { id?: string; error?: string; errors?: string[] };
      if (!response.ok || !result.id) { setErrors(result.errors ?? [result.error ?? "บันทึกงานไม่สำเร็จ"]); return; }
      router.push(`/demo/instructor/assignment/${result.id}`);
      router.refresh();
    } catch { setErrors(["บันทึกงานไม่สำเร็จ กรุณาตรวจวันที่และการเชื่อมต่อ"]); }
    finally { setBusy(false); }
  }

  return <form className="form-panel" onSubmit={submit}><p className="field-help">ห้องเรียน: <strong>{classroomName}</strong></p><label className="field">ชื่องาน<input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} placeholder="เช่น ประเมินโครงงานครั้งที่ 1" /></label><div className="form-grid"><label className="field">คะแนนรวม<input type="number" min="0.01" step="any" value={totalScore} onChange={event => setTotalScore(event.target.value)} required /></label><label className="field">คะแนน Group<input type="number" min="0.01" step="any" value={groupMax} onChange={event => setGroupMax(event.target.value)} required /></label><label className="field">คะแนน Individual<input type="number" min="0.01" step="any" value={individualMax} onChange={event => setIndividualMax(event.target.value)} required /></label></div><div className="form-grid"><label className="field">กำหนดส่ง Group<input type="datetime-local" value={groupDeadline} onChange={event => setGroupDeadline(event.target.value)} required /></label><label className="field">กำหนดส่ง Individual<input type="datetime-local" value={individualDeadline} onChange={event => setIndividualDeadline(event.target.value)} required /></label></div>{renderCriteria("group", groupCriteria)}{renderCriteria("individual", individualCriteria)}<div className="actions"><button type="submit" className="primary-button" disabled={busy}>{busy ? "กำลังบันทึก..." : "สร้างงานประเมิน"}</button></div>{errors.length > 0 && <div className="error-box" role="alert"><strong>บันทึกไม่ได้</strong><ul>{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}</form>;
}
