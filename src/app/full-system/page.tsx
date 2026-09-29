"use client";

import { useEffect, useState } from "react";

type Session = { email: string; platformRole: string; canCreateClassroom: boolean; privacyAccepted: boolean };
type Classroom = { id: string; name: string; role: string; status: string; rosterVersion: number };

export default function FullSystemHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await fetch("/api/auth/session", { cache: "no-store" });
        if (auth.status === 401) return;
        if (!auth.ok) throw new Error("SESSION_UNAVAILABLE");
        const actor = (await auth.json()).data as Session;
        if (!active) return;
        setSession(actor);
        if (actor.privacyAccepted) {
          const rooms = await fetch("/api/full-system/classrooms", { cache: "no-store" });
          if (!rooms.ok) throw new Error("CLASSROOMS_UNAVAILABLE");
          const data = (await rooms.json()).data as Classroom[];
          if (active) setClassrooms(data);
        }
      } catch {
        if (active) setMessage("ไม่สามารถโหลดข้อมูลระบบเต็มได้ในขณะนี้");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  return <main className="home-shell"><section className="home-card">
    <span className="eyebrow">PairEval Full System · Staging</span>
    <h1>ห้องเรียนและรายชื่อ</h1>
    {loading ? <p className="lead">กำลังตรวจการเข้าสู่ระบบ…</p> : session === null ? <>
      <p className="lead">เข้าสู่ระบบด้วยบัญชี Google ที่ได้รับสิทธิ์ใน PairEval</p>
      <a className="primary-button" href="/api/auth/oidc/start">เข้าสู่ระบบด้วย Google</a>
    </> : !session.privacyAccepted ? <>
      <p className="notice" role="status">ระบบยังรอ Privacy Notice ที่ระบุข้อมูล ผู้เห็นข้อมูล และระยะเวลาเก็บรักษาให้ครบตาม PRD จึงยังไม่เปิดข้อมูลห้องเรียน</p>
      <p className="fine-print">บัญชีที่ตรวจพบ: {session.email}</p>
      <form action="/api/auth/logout" method="post"><button className="secondary-button" type="submit">ออกจากระบบ</button></form>
    </> : <>
      <p className="lead">บัญชี {session.email}</p>
      {classrooms.length === 0 ? <p>ยังไม่มีห้องเรียนที่บัญชีนี้เข้าถึงได้</p> :
        <ul className="plain-list">{classrooms.map(room => <li key={room.id}>
          <strong>{room.name}</strong><small>บทบาท {room.role} · รุ่นรายชื่อ {room.rosterVersion}</small>
          {(["OWNER", "CO_TEACHER"].includes(room.role)) && <a className="text-link" href={`/full-system/classrooms/${room.id}/assignments`}>จัดการงานและดูแผนจับคู่ →</a>}
        </li>)}</ul>}
      {session.canCreateClassroom && <p className="fine-print">บัญชีนี้มีสิทธิ์สร้างห้องเรียนผ่าน API ของระบบเต็ม</p>}
      <form action="/api/auth/logout" method="post"><button className="secondary-button" type="submit">ออกจากระบบ</button></form>
    </>}
    {message && <p className="error-box" role="alert">{message}</p>}
    <p className="fine-print">พื้นที่ staging นี้ใช้ข้อมูลทดสอบเท่านั้น</p>
  </section></main>;
}
