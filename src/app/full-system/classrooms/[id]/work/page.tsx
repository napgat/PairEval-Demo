"use client";
import { use, useEffect, useState } from "react";

type Assignment = { id: string; name: string; description: string | null; status: string;
  groupEnabled: boolean; individualEnabled: boolean; individualDisabledReason: string | null;
  groupDeadline: string | null; individualDeadline: string | null };
export default function StudentWork({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ timezone: string; assignments: Assignment[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => { try {
      const response = await fetch(`/api/full-system/classrooms/${id}/student-assignments`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.code ?? "โหลดงานไม่สำเร็จ");
      if (active) setData(payload.data);
    } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "โหลดงานไม่สำเร็จ"); } })();
    return () => { active = false; };
  }, [id]);
  const date = (value: string | null) => value ? new Date(value).toLocaleString("th-TH", { timeZone: data?.timezone ?? "Asia/Bangkok" }) : "ไม่กำหนด";
  return <main className="fs-page">
    <a className="fs-back-link" href="/full-system"><span aria-hidden="true">←</span> กลับไปหน้าห้องเรียน</a>
    <header className="fs-page-heading"><div><span className="eyebrow">พื้นที่นักศึกษา</span>
      <h1>งานประเมินของฉัน</h1><p>เลือกงานที่ต้องทำ และตรวจคะแนนส่วนตัวได้จากที่นี่</p></div>
      <span className="fs-student-mark" aria-hidden="true">✓</span></header>
    {error && <p className="error-box" role="alert">{error}</p>}
    {!data ? <div className="fs-loading-card" role="status">กำลังโหลดงานของคุณ…</div> : data.assignments.length === 0 ?
      <div className="fs-empty-state"><span aria-hidden="true">☷</span><h2>ยังไม่มีงานที่เผยแพร่</h2>
        <p>เมื่องานพร้อมทำ งานนั้นจะแสดงที่หน้านี้</p></div> : <div className="fs-work-list">
      {data.assignments.map(item => <article className="fs-work-card" key={item.id}>
        <div className="fs-work-card-heading"><div><span className="fs-assignment-tag">งานประเมิน</span><h2>{item.name}</h2></div>
          <span className={`fs-status-badge ${item.status === "OPEN" ? "is-open" : ""}`}>{item.status === "OPEN" ? "กำลังเปิดรับ" : item.status === "CLOSED" ? "ปิดรับแล้ว" : item.status}</span></div>
        {item.description && <p className="fs-work-description">{item.description}</p>}
        <div className="fs-deadline-grid">
          {item.groupEnabled && <div className="fs-deadline-card"><span>ประเมินผลงานกลุ่ม</span>
            <strong>{date(item.groupDeadline)}</strong><small>เขตเวลา {data.timezone}</small></div>}
          {item.individualEnabled && <div className="fs-deadline-card"><span>ประเมินรายบุคคล</span>
            <strong>{date(item.individualDeadline)}</strong><small>เขตเวลา {data.timezone}</small></div>}
        </div>
        {item.individualDisabledReason && <p className="notice">{item.individualDisabledReason}</p>}
        <div className="fs-work-actions">
          {item.groupEnabled && <a className="primary-button" href={`/full-system/assignments/${item.id}/evaluate/group?classroom=${encodeURIComponent(id)}`}>เริ่มประเมินกลุ่ม <span aria-hidden="true">→</span></a>}
          {item.individualEnabled && <a className="primary-button" href={`/full-system/assignments/${item.id}/evaluate/individual?classroom=${encodeURIComponent(id)}`}>เริ่มประเมินรายบุคคล <span aria-hidden="true">→</span></a>}
          <a className="secondary-button" href={`/full-system/assignments/${item.id}/my-score`}>ดูคะแนนของฉัน</a>
        </div>
        <details className="fs-score-explainer"><summary>คะแนนคิดอย่างไร</summary>
          <p>คะแนนส่วนตัวคำนวณจากผลประเมินที่ส่งแล้วร่วมกับอัตราการส่งงาน (p) และตัวคูณ (M) ฉบับร่างยังไม่นำไปคำนวณ คะแนนอาจเปลี่ยนได้ก่อนสรุปผล</p>
        </details>
      </article>)}
    </div>}
  </main>;
}
