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
  return <main className="assignment-shell"><p><a href="/full-system">← ห้องเรียน</a></p>
    <span className="eyebrow">PairEval Full System · Student</span><h1>งานประเมินของฉัน</h1>
    {error && <p className="error-box" role="alert">{error}</p>}
    {!data ? <p>กำลังโหลด…</p> : data.assignments.length === 0 ? <p>ยังไม่มีงานที่เผยแพร่</p> :
      data.assignments.map(item => <section className="form-panel" key={item.id}><h2>{item.name}</h2>
        <p>{item.description}</p><p className="fine-print">สถานะ {item.status} · เวลา {data.timezone}</p>
        <p className="fine-print">คะแนนของผู้ประเมินจะปรับด้วยอัตราการส่งงาน p และตัวคูณ M; คะแนนชั่วคราวอาจเปลี่ยนได้</p>
        <div className="actions">{item.groupEnabled && <a className="primary-button" href={`/full-system/assignments/${item.id}/evaluate/group`}>ประเมินกลุ่ม · {date(item.groupDeadline)}</a>}
          {item.individualEnabled && <a className="primary-button" href={`/full-system/assignments/${item.id}/evaluate/individual`}>ประเมินรายบุคคล · {date(item.individualDeadline)}</a>}
          <a className="secondary-button" href={`/full-system/assignments/${item.id}/my-score`}>คะแนนของฉัน</a></div>
        {item.individualDisabledReason && <p className="notice">{item.individualDisabledReason}</p>}
      </section>)}
  </main>;
}
