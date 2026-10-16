"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CalendarDays, Search, ArrowRight } from "lucide-react";
import { assignmentStatus, friendlyError } from "@/lib/full-system-ui";

type Assignment = { id: string; name: string; description: string | null; status: string;
  groupEnabled: boolean; individualEnabled: boolean; individualDisabledReason: string | null;
  groupDeadline: string | null; individualDeadline: string | null };
export default function StudentWork({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ timezone: string; assignments: Assignment[] } | null>(null);
  const [error, setError] = useState(""), [roomName, setRoomName] = useState("");
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    (async () => { try {
      const [response, rooms] = await Promise.all([
        fetch(`/api/full-system/classrooms/${id}/student-assignments`, { cache: "no-store" }),
        fetch("/api/full-system/classrooms", { cache: "no-store" })]);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.code ?? "โหลดงานไม่สำเร็จ");
      if (active) setData(payload.data);
      if (rooms.ok) { const list = (await rooms.json()).data; if (active) setRoomName(list.find((r: {id:string}) => r.id === id)?.name ?? ""); }
    } catch (failure) { if (active) setError(friendlyError(failure)); } })();
    return () => { active = false; };
  }, [id]);
  const editable = (item: Assignment, deadline: string | null) => item.status === "OPEN" && (!deadline || Date.parse(deadline) > now);
  const isOpen = (item: Assignment) => (item.groupEnabled && editable(item, item.groupDeadline)) || (item.individualEnabled && editable(item, item.individualDeadline));
  const date = (value: string | null) => value ? new Date(value).toLocaleString("th-TH", { timeZone: data?.timezone ?? "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "ไม่กำหนดวันส่ง";
  const items = data?.assignments ?? [];
  const visible = items.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
    (filter === "all" || (filter === "open" ? isOpen(item) : item.status === "FINALIZED")))
    .sort((a,b) => Number(isOpen(b)) - Number(isOpen(a)));
  return <main className="fs-page fs-work-page">
    <Link className="fs-back-link" href="/full-system">← กลับไปหน้าห้องเรียน</Link>
    <header className="fs-page-heading"><div><span className="eyebrow">{roomName || "พื้นที่นักศึกษา"}</span>
      <h1>งานประเมินของฉัน</h1><p>เลือกงานเพื่อประเมินผลงาน หรือเปิดดูคำตอบและคะแนนที่ส่งแล้ว</p></div></header>
    {error && <p className="error-box" role="alert">{error}</p>}
    {!data && !error ? <div className="fs-loading-card" role="status">กำลังโหลดงานของคุณ…</div> : data && <>
      <div className="fs-list-toolbar"><div className="fs-filter-group" role="group" aria-label="กรองงานประเมิน">
        {[{id:"all",label:"ทั้งหมด",count:items.length},{id:"open",label:"เปิดรับอยู่",count:items.filter(isOpen).length},
          {id:"final",label:"ประกาศคะแนนแล้ว",count:items.filter(a=>a.status === "FINALIZED").length}].map(f =>
          <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span>{f.count}</span></button>)}
      </div><label className="fs-search"><Search size={18} aria-hidden="true" /><span className="sr-only">ค้นหางานประเมิน</span>
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่องาน" /></label></div>
      {visible.length === 0 ? <div className="fs-empty-state"><h2>{items.length ? "ไม่พบงานที่ตรงกับการค้นหา" : "ยังไม่มีงานประเมิน"}</h2>
        <p>{items.length ? "ลองเปลี่ยนคำค้นหาหรือเลือกดูงานทั้งหมด" : "เมื่องานพร้อม อาจารย์จะเผยแพร่งานไว้ที่หน้านี้"}</p>
        {items.length > 0 && <button className="secondary-button" onClick={()=>{setSearch("");setFilter("all");}}>ดูงานทั้งหมด</button>}</div> : <div className="fs-work-list">
      {visible.map(item => <article className="fs-work-card" key={item.id}>
        <div className="fs-work-card-heading"><div><span className="fs-assignment-tag">งานประเมิน</span><h2>{item.name}</h2></div>
          <span className={`fs-status-badge ${isOpen(item) ? "is-open" : ""}`}>{isOpen(item) ? "เปิดรับการประเมิน" : item.status === "FINALIZED" ? assignmentStatus(item.status) : "ปิดรับแล้ว"}</span></div>
        {item.description && <p className="fs-work-description">{item.description.replace(/^\[synthetic-final-demo:v\d+\]\s*/, "")}</p>}
        <div className="fs-deadline-grid">
          {item.groupEnabled && <div className="fs-deadline-card"><span><CalendarDays size={15} aria-hidden="true" />กำหนดส่งกลุ่ม</span><strong>{date(item.groupDeadline)}</strong></div>}
          {item.individualEnabled && <div className="fs-deadline-card"><span><CalendarDays size={15} aria-hidden="true" />กำหนดส่งรายบุคคล</span><strong>{date(item.individualDeadline)}</strong></div>}
        </div>
        {item.individualDisabledReason && <p className="notice">{item.individualDisabledReason}</p>}
        <div className="fs-work-actions">
          {item.groupEnabled && <Link className={editable(item,item.groupDeadline) ? "primary-button" : "secondary-button"} href={`/full-system/assignments/${item.id}/evaluate/group?classroom=${encodeURIComponent(id)}`}>
            {editable(item,item.groupDeadline) ? "ประเมินกลุ่ม" : "ดูคำตอบกลุ่ม"}<ArrowRight size={16} aria-hidden="true" /></Link>}
          {item.individualEnabled && <Link className="secondary-button" href={`/full-system/assignments/${item.id}/evaluate/individual?classroom=${encodeURIComponent(id)}`}>
            {editable(item,item.individualDeadline) ? "ประเมินรายบุคคล" : "ดูคำตอบรายบุคคล"}<ArrowRight size={16} aria-hidden="true" /></Link>}
          <Link className="fs-inline-link" href={`/full-system/assignments/${item.id}/my-score?classroom=${encodeURIComponent(id)}`}>ดูคะแนนของฉัน →</Link>
        </div>
      </article>)}</div>}
      <p className="fs-page-note">เวลาทั้งหมดแสดงตามเขตเวลาของห้องเรียน ({data.timezone}) · คำตอบจะนับคะแนนเมื่อยืนยันส่งแล้ว</p>
    </>}
  </main>;
}
