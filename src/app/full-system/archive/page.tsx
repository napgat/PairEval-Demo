"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmationDialog from "../components/confirmation-dialog";
import { friendlyError } from "@/lib/full-system-ui";
import { useRouter } from "next/navigation";
type Room = { id: string; name: string; role: string };
type Detail = {
  room: Room;
  assignments: Array<{
    id: string;
    name: string;
    status: string;
    students: Array<{ name: string; total: number | null; kind: string }>;
  }>;
};
export default function Archive() {
  const router = useRouter();
  const [loading,setLoading] = useState(true), [confirming,setConfirming] = useState(false), [busy,setBusy] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/full-system/classrooms/archive")
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw Error(p.error?.message ?? "โหลดไม่สำเร็จ");
        if (active) setRooms(p.data);
      })
      .catch((e) => {
        if (active) setMessage(friendlyError(e));
      }).finally(()=>{if(active)setLoading(false);});
    return () => {
      active = false;
    };
  }, []);
  async function open(id: string) {
    setMessage(""); setBusy(true);
    try {
      const response = await fetch(`/api/full-system/classrooms/${id}/archive`), payload = await response.json();
      if (!response.ok) throw Error(payload.error?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      setDetail(payload.data);
    } catch (failure) { setMessage(friendlyError(failure)); } finally { setBusy(false); }
  }
  async function restore() {
    if (!detail || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/full-system/classrooms/${detail.room.id}/archive`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) });
      if (!response.ok) throw Error("นำห้องเรียนกลับมาไม่สำเร็จ กรุณาลองอีกครั้ง");
      router.push("/full-system");
    } catch (failure) { setMessage(friendlyError(failure)); } finally { setBusy(false); }
  }
  return (
    <main className="fs-page">
      <Link className="fs-back-link" href="/full-system">← กลับไปหน้าห้องเรียน</Link>
      <header className="fs-page-heading"><div><span className="eyebrow">ประวัติห้องเรียน</span><h1>ห้องเรียนที่เก็บแล้ว</h1><p>เปิดดูงานและคะแนนของห้องเรียนที่จบไปแล้ว</p></div></header>
      <p>
        เปิดอ่านข้อมูลเดิมได้ การแก้ไขและการส่งคำตอบปิดไว้จนกว่าอาจารย์เจ้าของห้อง
        จะนำห้องกลับมาใช้งาน
      </p>
      {message && <p role="status">{message}</p>}
      {loading ? <div className="fs-loading-card" role="status">กำลังโหลดห้องเรียน…</div> : !rooms.length && !message && <div className="fs-empty-state"><h2>ยังไม่มีห้องเรียนที่เก็บแล้ว</h2><p>ห้องเรียนที่อาจารย์เก็บเมื่อจบรายวิชาจะแสดงที่นี่</p><Link className="secondary-button" href="/full-system">กลับไปห้องเรียนของฉัน</Link></div>}
      <div className="actions">
        {rooms.map((r) => (
          <button
            className="secondary-button"
            key={r.id}
            disabled={busy}
            aria-pressed={detail?.room.id === r.id}
            onClick={() => open(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>
      {detail && (
        <section className="form-panel">
          <h2>{detail.room.name}</h2>
          {detail.room.role === "OWNER" && (
            <button className="secondary-button" disabled={busy} onClick={()=>setConfirming(true)}>
              นำห้องกลับมาใช้งาน
            </button>
          )}
          {detail.assignments.map((a) => (
            <section key={a.id}>
              <h3>{a.name}</h3>
              <p>
                {a.status === "FINALIZED"
                  ? "คะแนนยืนยันแล้ว"
                  : "ชั่วคราว — อาจเปลี่ยนแปลงได้"}
              </p>
              {a.students.length > 0 && (
                <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางคะแนนห้องเรียนที่เก็บแล้ว">
                  <table>
                    <thead>
                      <tr>
                        <th>ชื่อ</th>
                        <th>คะแนนรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.students.map((s, i) => (
                        <tr key={i}>
                          <td>{s.name}</td>
                          <td>
                            {s.total === null
                              ? "ยังมีข้อมูลไม่พอ"
                              : s.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </section>
      )}
      <ConfirmationDialog open={confirming} title="นำห้องเรียนกลับมาใช้งาน?" confirmLabel="นำห้องกลับมาใช้งาน" onCancel={()=>setConfirming(false)} onConfirm={()=>{setConfirming(false);void restore();}}><p>{detail?.room.name} จะกลับไปแสดงในหน้าห้องเรียน และใช้งานได้ตามสิทธิ์เดิม</p></ConfirmationDialog>
    </main>
  );
}
