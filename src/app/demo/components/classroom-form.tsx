"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RosterPreview } from "@/lib/classroom-input";

export default function ClassroomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function inspect() {
    setBusy(true); setErrors([]);
    try {
      const response = await fetch("/api/classrooms/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
      const result = await response.json() as RosterPreview & { error?: string };
      setPreview(response.ok ? result : null);
      setErrors(result.errors ?? (result.error ? [result.error] : []));
    } catch { setErrors(["อ่านไฟล์ CSV ไม่สำเร็จ กรุณาลองใหม่"]); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!preview || preview.errors.length) { setErrors(["กรุณาตรวจตัวอย่าง CSV ให้ผ่านก่อนบันทึก"]); return; }
    setBusy(true); setErrors([]);
    try {
      const response = await fetch("/api/classrooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, csv }) });
      const result = await response.json() as { id?: string; error?: string; errors?: string[] };
      if (!response.ok || !result.id) { setErrors(result.errors ?? [result.error ?? "บันทึกห้องเรียนไม่สำเร็จ"]); return; }
      router.push(`/demo/instructor/classroom/${result.id}`);
      router.refresh();
    } catch { setErrors(["เชื่อมต่อ server ไม่สำเร็จ กรุณาลองใหม่"]); }
    finally { setBusy(false); }
  }

  return <form className="form-panel" onSubmit={submit}>
    <label className="field">ชื่อห้องเรียน<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="เช่น ห้องสาธิตวิศวกรรมซอฟต์แวร์" /></label>
    <label className="field">ไฟล์รายชื่อ CSV (email,groupname)
      <input type="file" accept=".csv,text/csv" onChange={async event => { const file = event.target.files?.[0]; setCsv(file ? await file.text() : ""); setPreview(null); setErrors([]); }} />
    </label>
    <p className="field-help">ใช้ข้อมูลสังเคราะห์ลงท้าย `.invalid` เท่านั้น สูงสุด 200 คน ตัวอย่าง: <code>student-a@demo.invalid,Orion</code></p>
    <label className="field">หรือวาง CSV ที่นี่<textarea rows={8} value={csv} onChange={event => { setCsv(event.target.value); setPreview(null); setErrors([]); }} placeholder={"email,groupname\nstudent-a@demo.invalid,Orion\nstudent-b@demo.invalid,Nova"} /></label>
    <div className="actions"><button type="button" className="secondary-button" onClick={inspect} disabled={busy || !csv.trim()}>ตรวจตัวอย่าง CSV</button><button type="submit" className="primary-button" disabled={busy || !preview || !!preview.errors.length || !name.trim()}>สร้างห้องและนำเข้ารายชื่อ</button></div>
    {errors.length > 0 && <div className="error-box" role="alert"><strong>กรุณาแก้ไขก่อนบันทึก</strong><ul>{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
    {preview && !preview.errors.length && <div className="preview-box"><strong>ตัวอย่างผ่าน: {preview.rows.length} คน / {preview.groups.length} กลุ่ม</strong><p>กลุ่ม: {preview.groups.join(", ")}</p><div className="table-wrap"><table><thead><tr><th>แถว</th><th>อีเมล</th><th>กลุ่ม</th></tr></thead><tbody>{preview.rows.slice(0, 20).map(row => <tr key={row.line}><td>{row.line}</td><td>{row.email}</td><td>{row.groupname}</td></tr>)}</tbody></table></div>{preview.rows.length > 20 && <p>แสดง 20 คนแรกจาก {preview.rows.length} คน</p>}</div>}
  </form>;
}
