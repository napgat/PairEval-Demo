"use client";

import { useEffect, useState } from "react";
import { NOTICE_VERSION } from "@/lib/full-system-notice-version";

type Session = { email: string; platformRole: string; canCreateClassroom: boolean; privacyAccepted: boolean };
type Classroom = { id: string; name: string; role: string; status: string; rosterVersion: number };
type Notice = { id: string; event: string; message: string; deepLink: string; createdAt: string; readAt: string | null };

export default function FullSystemHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [acknowledging, setAcknowledging] = useState(false);

  async function acknowledgeNotice() {
    setAcknowledging(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/privacy-notice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeVersion: NOTICE_VERSION }),
      });
      if (response.status !== 200) throw new Error("notice failed");
      window.location.reload();
    } catch {
      setMessage("บันทึกการรับทราบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setAcknowledging(false);
    }
  }

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
          const notifications = await fetch("/api/full-system/notifications", { cache: "no-store" });
          if (notifications.ok && active) setNotices((await notifications.json()).data as Notice[]);
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
      <section className="notice" aria-labelledby="staging-notice-title">
        <h2 id="staging-notice-title">การใช้ข้อมูลสำหรับ staging ของโครงงาน</h2>
        <p>พื้นที่นี้ใช้สาธิตด้วยห้องเรียน งาน และคะแนนตัวอย่างเท่านั้น ไม่ใช่ระบบบันทึกคะแนนจริงของสถาบัน</p>
        <p>เมื่อเข้าสู่ระบบ PairEval เก็บอีเมล ตัวระบุบัญชี Google เซสชัน เวลาเข้าสู่ระบบ และบันทึกการกระทำที่จำเป็นเพื่อยืนยันตัวตนและตรวจสิทธิ์ ผู้ที่มีบทบาทในห้องตัวอย่างเห็นข้อมูลตามสิทธิ์ของตน</p>
        <p>ข้อมูลบัญชีและบันทึก staging ยังไม่มีระบบลบตามกำหนดอัตโนมัติ ผู้ดูแลโครงงานจะลบข้อมูลสาธิตเมื่อสิ้นสุดการทดสอบหรือตามคำขอ นโยบายสำหรับใช้กับนักศึกษาจริงยังไม่ผ่านการอนุมัติ</p>
        <p>การกดรับทราบจะบันทึกเวอร์ชันและเวลาที่กด หากไม่ต้องการดำเนินการต่อ ให้ออกจากระบบได้</p>
      </section>
      <p className="fine-print">บัญชีที่ตรวจพบ: {session.email}</p>
      <button className="primary-button" type="button" disabled={acknowledging} onClick={acknowledgeNotice}>
        {acknowledging ? "กำลังบันทึก…" : "รับทราบและเข้าดูข้อมูลสาธิต"}
      </button>
      <form action="/api/auth/logout" method="post"><button className="secondary-button" type="submit">ออกจากระบบ</button></form>
    </> : <>
      <p className="lead">บัญชี {session.email}</p>
      {notices.length > 0 && <section aria-label="การแจ้งเตือน"><h2>การแจ้งเตือน</h2>
        <ul className="plain-list">{notices.map(notice => <li key={notice.id}>
          <a className="text-link" href={notice.deepLink}>{notice.message}</a>
          {!notice.readAt && <small>ใหม่</small>}
        </li>)}</ul></section>}
      {classrooms.length === 0 ? <p>ยังไม่มีห้องเรียนที่บัญชีนี้เข้าถึงได้</p> :
        <ul className="plain-list">{classrooms.map(room => <li key={room.id}>
          <strong>{room.name}</strong><small>บทบาท {room.role} · รุ่นรายชื่อ {room.rosterVersion}</small>
          {(["OWNER", "CO_TEACHER"].includes(room.role)) && <a className="text-link" href={`/full-system/classrooms/${room.id}/assignments`}>จัดการงานและดูแผนจับคู่ →</a>}
          {room.role === "STUDENT" && <a className="text-link" href={`/full-system/classrooms/${room.id}/work`}>งานประเมินและคะแนนของฉัน →</a>}
        </li>)}</ul>}
      {session.canCreateClassroom && <p className="fine-print">บัญชีนี้มีสิทธิ์สร้างห้องเรียนผ่าน API ของระบบเต็ม</p>}
      <form action="/api/auth/logout" method="post"><button className="secondary-button" type="submit">ออกจากระบบ</button></form>
    </>}
    {message && <p className="error-box" role="alert">{message}</p>}
    <p className="fine-print">พื้นที่ staging นี้ใช้ข้อมูลทดสอบเท่านั้น</p>
  </section></main>;
}
