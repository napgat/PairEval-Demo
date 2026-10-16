"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { friendlyError } from "@/lib/full-system-ui";
type Member = { id: string; displayName: string; email: string; groupName: string; studentId: string | null };
type Preview = { version: number; digest: string; diff: { added: number; moved: number; unchanged: number }; warnings: string[] };
export default function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rows, setRows] = useState<Member[]>([]), [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""), [room, setRoom] = useState<{name:string;role:string} | null>(null);
  const base = `/api/full-system/classrooms/${id}/roster`;
  async function request(url: string, body?: unknown) {
    const response = await fetch(url, body === undefined ? {} : { method: "POST", headers: {"Content-Type":"application/json"}, body:JSON.stringify(body) });
    const payload = await response.json();
    if (response.status === 202) throw Error("รายการยังรอยืนยัน กรุณาโหลดรายชื่อใหม่ก่อนทำรายการซ้ำ");
    if (!response.ok) throw Error(payload.error?.message ?? payload.errors?.join("; ") ?? "ไม่สามารถทำรายการได้");
    return payload.data;
  }
  const load = useCallback(async () => {
    const response = await fetch(base), payload = await response.json();
    if (!response.ok) throw Error("บัญชีนี้ไม่มีสิทธิ์จัดการรายชื่อของห้องนี้");
    setRows(payload.data);
  }, [base]);
  useEffect(() => {
    let active = true;
    void (async()=>{try{
      const [response, rooms] = await Promise.all([fetch(base),fetch("/api/full-system/classrooms")]);
      if (!response.ok) throw Error("บัญชีนี้ไม่มีสิทธิ์จัดการรายชื่อของห้องนี้");
      const payload = await response.json(); if(active) setRows(payload.data);
      if(rooms.ok){const list=(await rooms.json()).data;if(active)setRoom(list.find((r:{id:string})=>r.id===id)??null);}
    }catch(failure){if(active){setError(true);setMessage(friendlyError(failure));}}finally{if(active)setLoading(false);}})();
    return ()=>{active=false;};
  },[base,id]);
  async function action(job:()=>Promise<void>){setBusy(true);setError(false);setMessage("");try{await job();}catch(failure){setError(true);setMessage(friendlyError(failure));}finally{setBusy(false);}}
  const visible = rows.filter(row=>[row.displayName,row.email,row.studentId,row.groupName].some(value=>value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  return <main className="fs-page fs-roster-page">
    <Link className="fs-back-link" href="/full-system">← กลับไปหน้าห้องเรียน</Link>
    <header className="fs-page-heading"><div><span className="eyebrow">{room?.name ?? "ห้องเรียน"}</span><h1>รายชื่อและกลุ่ม</h1><p>ค้นหานักศึกษา ตรวจกลุ่ม และนำเข้ารายชื่อเพิ่มเติม</p></div></header>
    <nav className="fs-classroom-nav" aria-label="เมนูห้องเรียน">{room && ["OWNER","CO_TEACHER"].includes(room.role) && <Link href={`/full-system/classrooms/${id}/assignments`}>งานประเมิน</Link>}<Link href={`/full-system/classrooms/${id}/roster`} aria-current="page">รายชื่อและกลุ่ม</Link></nav>
    {message && <p className={error?"error-box":"notice"} role={error?"alert":"status"}>{message}</p>}
    <section className="form-panel"><div className="fs-section-heading"><h2>นักศึกษาในห้องเรียน</h2><span className="fs-count-badge">{rows.length} คน</span></div>
      <label className="fs-search"><Search size={18} aria-hidden="true"/><span className="sr-only">ค้นหานักศึกษา</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ รหัสนักศึกษา อีเมล หรือกลุ่ม"/></label>
      {loading ? <p role="status">กำลังโหลดรายชื่อ…</p> : <div className="table-wrap"><table><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>รหัสนักศึกษา</th><th>กลุ่ม</th></tr></thead><tbody>
        {visible.map(row=><tr key={row.id}><td>{row.displayName}</td><td>{row.email}</td><td>{row.studentId??"—"}</td><td>{row.groupName}</td></tr>)}
        {visible.length===0 && !error && <tr><td colSpan={4}>{search ? "ไม่พบรายชื่อที่ตรงกับการค้นหา" : "ยังไม่มีนักศึกษาในห้องนี้"}</td></tr>}
      </tbody></table></div>}
    </section>
    <details className="form-panel fs-disclosure"><summary>นำเข้าหรือปรับกลุ่มด้วยไฟล์ CSV</summary><div className="fs-disclosure-body">
      <p>วางรายชื่อในรูปแบบ CSV แล้วตรวจข้อมูลก่อนยืนยันนำเข้า หากมีงานที่เผยแพร่อยู่ ต้องยกเลิกเผยแพร่ก่อนเปลี่ยนกลุ่ม</p>
      <label className="field">CSV รายชื่อ<textarea value={csv} onChange={e=>{setCsv(e.target.value);setPreview(null);}} placeholder="email,group_name,student_id,display_name" aria-describedby="roster-format"/></label>
      <p id="roster-format" className="field-help">คอลัมน์: email, group_name, student_id, display_name · ตรวจอีเมลและกลุ่มให้ถูกต้องก่อนนำเข้า</p>
      <div className="actions"><button className="secondary-button" disabled={busy||!csv.trim()} onClick={()=>action(async()=>{const result=await request(base+"/preview",{csv});if(result.errors?.length)throw Error(result.errors.join("; "));setPreview(result);})}>ตรวจข้อมูล</button>
        <button className="primary-button" disabled={busy||!preview} onClick={()=>action(async()=>{await request(base+"/import",{csv,expectedVersion:preview!.version,confirmDigest:preview!.digest});setPreview(null);await load();setMessage("นำเข้ารายชื่อแล้ว");})}>ยืนยันนำเข้ารายชื่อ</button></div>
      {preview && <p className="notice" role="status">เพิ่ม {preview.diff.added} คน · ย้ายกลุ่ม {preview.diff.moved} คน · คงเดิม {preview.diff.unchanged} คน {preview.warnings.join("; ")}</p>}
    </div></details>
  </main>;
}
