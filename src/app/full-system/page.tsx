"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  const [feedbackError, setFeedbackError] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [classroomName, setClassroomName] = useState("");
  const [rosterCsv, setRosterCsv] = useState("");
  const [timezone, setTimezone] = useState("Asia/Bangkok");

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

  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      const response = await fetch("/api/full-system/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ name: classroomName, csv: rosterCsv, timezone }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error?.code ?? "สร้างห้องเรียนไม่สำเร็จ");
      if (response.status === 202) throw new Error("รายการยังรอยืนยันการบันทึก กรุณารอสักครู่แล้วโหลดหน้าใหม่ก่อนลองซ้ำ");
      const rooms = await fetch("/api/full-system/classrooms", { cache: "no-store" });
      if (rooms.ok) setClassrooms((await rooms.json()).data as Classroom[]);
      setClassroomName("");
      setRosterCsv("");
      setFeedbackError(false);
      setMessage(`สร้างห้องเรียนแล้ว · นักศึกษา ${payload.data.students} คน · ${payload.data.groups} กลุ่ม`);
    } catch (error) {
      setFeedbackError(true);
      setMessage(error instanceof Error ? error.message : "สร้างห้องเรียนไม่สำเร็จ");
    } finally {
      setCreating(false);
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
        if (active) { setFeedbackError(true); setMessage("ไม่สามารถโหลดข้อมูลระบบเต็มได้ในขณะนี้"); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <main className="fs-auth-shell"><section className="fs-auth-card">
    <span className="eyebrow">PairEval · พื้นที่โครงงาน</span><h1>กำลังตรวจสอบบัญชี</h1>
    <p className="lead">กำลังเตรียมพื้นที่ทำงานของคุณ…</p>
  </section></main>;

  if (session === null) return <main className="fs-auth-shell"><section className="fs-auth-card fs-login-card">
    <span className="fs-mark" aria-hidden="true">P</span>
    <span className="eyebrow">PairEval · พื้นที่โครงงาน</span>
    <h1>ประเมินผลงาน<br />อย่างเป็นระบบ</h1>
    <p className="lead">พื้นที่เดียวสำหรับจัดการงานประเมินของอาจารย์ และส่งคำประเมินของนักศึกษา</p>
    <a className="primary-button fs-login-button" href="/api/auth/oidc/start">เข้าสู่ระบบด้วย Google</a>
    <p className="fine-print">ใช้บัญชีที่ได้รับสิทธิ์ใน PairEval · ข้อมูลใน staging เป็นข้อมูลตัวอย่าง</p>
  </section></main>;

  if (!session.privacyAccepted) return <main className="fs-auth-shell"><section className="fs-auth-card fs-notice-card">
      <span className="eyebrow">ก่อนเริ่มใช้งาน</span>
      <h1>ข้อตกลงการใช้ข้อมูลตัวอย่าง</h1>
      <section className="fs-privacy-copy" aria-labelledby="staging-notice-title">
        <h2 id="staging-notice-title">การใช้ข้อมูลสำหรับ staging ของโครงงาน</h2>
        <p>พื้นที่นี้ใช้สาธิตด้วยห้องเรียน งาน และคะแนนตัวอย่างเท่านั้น ไม่ใช่ระบบบันทึกคะแนนจริงของสถาบัน</p>
        <p>เมื่อเข้าสู่ระบบ PairEval เก็บอีเมล ตัวระบุบัญชี Google เซสชัน เวลาเข้าสู่ระบบ และบันทึกการกระทำที่จำเป็นเพื่อยืนยันตัวตนและตรวจสิทธิ์ ผู้ที่มีบทบาทในห้องตัวอย่างเห็นข้อมูลตามสิทธิ์ของตน</p>
        <p>ข้อมูลห้องสาธิตเป็นข้อมูลสังเคราะห์ การนำไปใช้กับรายวิชาจริงต้องตั้งค่าบัญชีผู้ดูแลและระบบงานตามกำหนดของสถาบัน</p>
        <p>นโยบายกำหนดสองปีการศึกษาสำหรับข้อมูลตัวตน และหนึ่งปีการศึกษาสำหรับเวลาทำคำถาม โดยนับปีที่บันทึกเป็นปีแรก ค่าเริ่มต้นเริ่มปีการศึกษา 1 สิงหาคม ต้นแบบแทนตัวตนในบัญชีที่พ้นระยะและไม่มีกิจกรรมล่าสุดด้วยรหัสถาวร ส่วนข้อมูลเก่าของบัญชีที่ยังใช้เรียนต่ออยู่ต้องตรวจนโยบายแยกก่อนใช้กับรายวิชาจริง</p>
        <p>Owner เห็นตัวผู้ประเมินได้เมื่อยืนยันเหตุผลและมีบันทึกตรวจสอบ ผู้สอนร่วมเห็นรหัสแทนตัว ผู้ช่วยสอนจัดการรายชื่อ นักศึกษาเห็นเฉพาะคะแนนและข้อมูลของตน ขอสำเนาข้อมูลของตนได้จากหน้าห้องเรียนโดยระบบส่งให้ทันที ภายในกรอบ 30 วัน</p>
        <p>ระบบเก็บเวลาที่กำลังใช้งานหน้าประเมินเพื่อช่วยทบทวนคุณภาพคำตอบ ไม่มีการหักคะแนนอัตโนมัติจากสัญญาณนี้ การกดรับทราบจะบันทึกเวอร์ชันและเวลา หากไม่ต้องการดำเนินการต่อ ให้ออกจากระบบได้</p>
      </section>
      <p className="fine-print">บัญชีที่ตรวจพบ: {session.email}</p>
      <button className="primary-button" type="button" disabled={acknowledging} onClick={acknowledgeNotice}>
        {acknowledging ? "กำลังบันทึก…" : "รับทราบและเข้าดูข้อมูลสาธิต"}
      </button>
      <form action="/api/auth/logout" method="post"><button className="secondary-button" type="submit">ออกจากระบบ</button></form>
      {message && <p className="error-box" role="alert">{message}</p>}
  </section></main>;

  const roleLabel: Record<string, string> = {
    OWNER: "อาจารย์ผู้ดูแล", CO_TEACHER: "อาจารย์ร่วม", TA: "ผู้ช่วยสอน", STUDENT: "นักศึกษา",
  };
  const mayCreateClassroom = session.canCreateClassroom || session.platformRole === "SYSTEM_ADMIN";
  return <main className="fs-dashboard-shell">
    <header className="fs-topbar">
      <a href="/full-system" className="fs-wordmark" aria-label="PairEval หน้าหลัก"><span>P</span> PairEval</a>
      <div className="fs-account"><span className="fs-stage-badge">พื้นที่โครงงาน</span><span>{session.email}</span>
        <form action="/api/auth/logout" method="post"><button className="fs-logout" type="submit">ออกจากระบบ</button></form>
      </div>
    </header>
    <div className="fs-dashboard-content">
      <button className="secondary-button" onClick={async () => {
        const response = await fetch("/api/full-system/privacy/export", { method: "POST" });
        if (!response.ok) { setMessage("ขอสำเนาข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
        const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
        link.href = url; link.download = "paireval-my-data.json"; link.click(); URL.revokeObjectURL(url);
      }}>ขอสำเนาข้อมูลของฉัน</button>
      <section className="fs-welcome">
        <div><span className="eyebrow">พื้นที่ทำงาน</span><h1>สวัสดี, {session.email.split("@")[0]}</h1>
          <p>เลือกห้องเรียนเพื่อจัดการงาน หรือทำแบบประเมินที่ได้รับมอบหมาย</p></div>
        <div className="fs-welcome-icon" aria-hidden="true">✦</div>
      </section>
      {message && <p className={`${feedbackError ? "error-box" : "notice"} fs-feedback`} role={feedbackError ? "alert" : "status"}>{message}</p>}
      <div className="fs-dashboard-grid">
        <section className="fs-main-column" aria-labelledby="classrooms-title">
          <div className="fs-section-heading"><div><span className="eyebrow">ห้องเรียนของคุณ</span><h2 id="classrooms-title">เลือกห้องเรียน</h2></div>
            <span className="fs-count-badge">{classrooms.length} ห้อง</span></div>
          {classrooms.length === 0 ? <div className="fs-empty-state"><span aria-hidden="true">▣</span>
            <h3>ยังไม่มีห้องเรียน</h3><p>เมื่ออาจารย์เพิ่มคุณในห้องเรียน ห้องนั้นจะแสดงที่นี่</p></div> :
            <div className="fs-classroom-grid">{classrooms.map(room => {
              const isInstructor = ["OWNER", "CO_TEACHER"].includes(room.role);
              const isStudent = room.role === "STUDENT";
              const destination = isInstructor ? `/full-system/classrooms/${room.id}/assignments` :
                isStudent ? `/full-system/classrooms/${room.id}/work` : `/full-system/classrooms/${room.id}/roster`;
              return <article className="fs-classroom-card" key={room.id}>
                <div className="fs-classroom-card-top"><span className="fs-classroom-icon" aria-hidden="true">{isStudent ? "▤" : "▣"}</span>
                  <span className={`fs-role-badge ${isInstructor ? "is-instructor" : ""}`}>{roleLabel[room.role] ?? "สมาชิกห้องเรียน"}</span></div>
                <h3>{room.name}</h3><p>{isInstructor ? "ดูแลงานประเมิน รายชื่อ และผลสรุปของห้องนี้" :
                  isStudent ? "ดูงานที่ได้รับมอบหมายและคะแนนส่วนตัว" : "ดูข้อมูลห้องเรียนตามสิทธิ์ที่ได้รับ"}</p>
                {destination ? <a className="fs-card-link" href={destination}>{isInstructor ? "จัดการห้องเรียน" : isStudent ? "ดูงานของฉัน" : "จัดการรายชื่อและกลุ่ม"}<span aria-hidden="true">→</span></a> :
                  <span className="fs-card-link is-muted">เมนูบทบาทนี้ยังไม่พร้อมในต้นแบบ</span>}
              </article>;
            })}</div>}
          {mayCreateClassroom && <details className="fs-create-classroom">
            <summary><span><strong>สร้างห้องเรียนใหม่</strong><small>ตั้งชื่อห้องและเพิ่มรายชื่อนักศึกษาด้วย CSV</small></span><span className="fs-plus" aria-hidden="true">＋</span></summary>
            <form className="fs-create-form" onSubmit={createClassroom}>
              <label className="field">ชื่อห้องเรียน<input required minLength={2} maxLength={120} value={classroomName}
                onChange={event => setClassroomName(event.target.value)} placeholder="เช่น การออกแบบซอฟต์แวร์ 1/2569" /></label>
              <label className="field">เขตเวลาของห้องเรียน<select required value={timezone} onChange={event => setTimezone(event.target.value)}>
                <option value="Asia/Bangkok">Asia/Bangkok · เวลาไทย</option><option value="UTC">UTC</option>
              </select></label>
              <label className="field">รายชื่อนักศึกษา (CSV)<textarea required value={rosterCsv} onChange={event => setRosterCsv(event.target.value)}
                placeholder={'email,group_name,student_id,display_name\nstudent1@example.edu,Group A,S001,นักศึกษาตัวอย่าง 1\nstudent2@example.edu,Group A,S002,นักศึกษาตัวอย่าง 2'} /></label>
              <p className="fine-print">กลุ่มควรมีนักศึกษาอย่างน้อย 2 คน · รองรับสูงสุด 200 คน · ใช้ข้อมูลที่ได้รับอนุญาตเท่านั้น</p>
              <button className="primary-button" type="submit" disabled={creating}>{creating ? "กำลังสร้าง…" : "สร้างห้องเรียน"}</button>
            </form>
          </details>}
        </section>
        <aside className="fs-side-column">
          <section className="fs-side-card" aria-labelledby="notifications-title"><div className="fs-section-heading compact">
            <div><span className="eyebrow">อัปเดตล่าสุด</span><h2 id="notifications-title">การแจ้งเตือน</h2></div>
            <span className="fs-notification-count">{notices.filter(notice => !notice.readAt).length}</span></div>
            {notices.length ? <ul className="fs-notification-list">{notices.map(notice => <li key={notice.id}>
              <span className={`fs-notification-dot ${notice.readAt ? "is-read" : ""}`} aria-hidden="true" />
              <div><a href={notice.deepLink}>{notice.message}</a><small>{new Date(notice.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                {!notice.readAt && <b>ใหม่</b>}</small></div>
            </li>)}</ul> : <p className="fs-muted-copy">ยังไม่มีการแจ้งเตือน</p>}
          </section>
          <p><a href="/full-system/archive">ดูห้องเรียนที่เก็บแล้ว</a></p>
          <section className="fs-help-card"><span aria-hidden="true">?</span><div><h3>เริ่มต้นใช้งาน</h3>
            <p>อาจารย์จัดการงานจากการ์ดห้องเรียน ส่วนนักศึกษาเข้าไปทำแบบประเมินและดูคะแนนของตนเอง</p></div></section>
          <p className="fs-footer-note">พื้นที่นี้ใช้สำหรับสาธิตโครงงาน · ไม่ใช่ระบบบันทึกคะแนนจริง</p>
        </aside>
      </div>
    </div>
  </main>;
}
