"use client";
import { useEffect, useState } from "react";
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
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function open(id: string) {
    const r = await fetch(`/api/full-system/classrooms/${id}/archive`),
      p = await r.json();
    if (r.ok) setDetail(p.data);
    else setMessage(p.error?.message ?? "โหลดไม่สำเร็จ");
  }
  async function restore() {
    if (!detail || !confirm("นำห้องเรียนนี้กลับมาใช้งานหรือไม่?")) return;
    const r = await fetch(
      `/api/full-system/classrooms/${detail.room.id}/archive`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      },
    );
    if (r.ok) router.push("/full-system");
    else setMessage("นำห้องเรียนกลับมาไม่สำเร็จ");
  }
  return (
    <main className="fs-page">
      <a href="/full-system">← กลับไปห้องเรียน</a>
      <h1>ห้องเรียนที่เก็บแล้ว</h1>
      <p>
        เปิดอ่านข้อมูลเดิมได้ การแก้ไขและการส่งคำตอบปิดไว้จนกว่า Owner
        จะนำห้องกลับมาใช้งาน
      </p>
      {message && <p role="status">{message}</p>}
      {!rooms.length && <p>ยังไม่มีห้องเรียนที่เก็บแล้ว</p>}
      <div className="actions">
        {rooms.map((r) => (
          <button
            className="secondary-button"
            key={r.id}
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
            <button className="secondary-button" onClick={restore}>
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
                <div className="table-wrap">
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
    </main>
  );
}
