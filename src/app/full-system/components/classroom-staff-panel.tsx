"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmationDialog from "./confirmation-dialog";
import type { StaffMember } from "@/lib/full-system-members";

const roles = { OWNER: "เจ้าของห้อง", CO_TEACHER: "อาจารย์ร่วม", TA: "ผู้ช่วยสอน" };
const errors: Record<string, string> = {
  MEMBER_ACCOUNT_UNAVAILABLE: "ไม่พบบัญชีที่ใช้งานได้ กรุณาให้อาจารย์หรือผู้ช่วยสอนเข้าสู่ระบบก่อน แล้วตรวจอีเมลอีกครั้ง",
  MEMBER_CONFLICT: "บัญชีนี้มีบทบาทในห้องอยู่แล้ว หรือไม่สามารถเปลี่ยนเป็นผู้สอนได้",
  MEMBER_INVALID: "กรุณาตรวจอีเมลและบทบาทให้ถูกต้อง",
  NOT_FOUND: "ไม่พบข้อมูล หรือบัญชีนี้ไม่มีสิทธิ์จัดการผู้สอนในห้องนี้",
  UNAUTHENTICATED: "กรุณาเข้าสู่ระบบใหม่",
  PRIVACY_NOTICE_REQUIRED: "กรุณาอ่านและยอมรับประกาศความเป็นส่วนตัวก่อน",
  AUDIT_UNAVAILABLE: "ระบบบันทึกเหตุการณ์ไม่พร้อม จึงยังไม่ทำรายการ กรุณาลองใหม่ภายหลัง",
};

export default function ClassroomStaffPanel({ classroomId }: { classroomId: string }) {
  const base = `/api/full-system/classrooms/${classroomId}/members`;
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState(""), [role, setRole] = useState("CO_TEACHER");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState(false);
  const [target, setTarget] = useState<StaffMember | null>(null);
  const latch = useRef(false);
  const fetchRows = useCallback(async (signal?: AbortSignal): Promise<StaffMember[]> => {
    const response = await fetch(base, { cache: "no-store", signal });
    const payload = await response.json();
    if (!response.ok) throw Error(errors[payload.error?.code] ?? "โหลดรายชื่อผู้สอนไม่สำเร็จ กรุณาลองโหลดใหม่");
    return payload.data;
  }, [base]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchRows(controller.signal).then(setRows).catch(failure => {
      if (!controller.signal.aborted) { setMessage(failure.message); setError(true); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [fetchRows]);

  async function refresh() {
    if (latch.current) return;
    latch.current = true; setBusy(true); setError(false);
    try { setRows(await fetchRows()); setUncertain(false); setMessage("โหลดรายชื่อปัจจุบันแล้ว กรุณาตรวจรายชื่อก่อนทำรายการต่อ"); }
    catch (failure) { setError(true); setMessage((failure as Error).message); }
    finally { latch.current = false; setBusy(false); }
  }
  async function mutate(member?: StaffMember) {
    if (latch.current || uncertain) return;
    latch.current = true; setBusy(true); setError(false); setMessage(""); setTarget(null);
    let committed = false;
    try {
      const response = await fetch(member ? `${base}/${member.userId}` : base, {
        method: member ? "DELETE" : "POST",
        ...(member ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }) }),
      });
      if (response.status === 202) {
        setUncertain(true); setMessage("รายการยังรอยืนยัน กรุณาโหลดรายชื่อใหม่และตรวจผลก่อนทำรายการซ้ำ"); return;
      }
      if (!response.ok) {
        const payload = await response.json();
        if (response.status >= 500 && payload.error?.code !== "AUDIT_UNAVAILABLE") setUncertain(true);
        setError(true); setMessage(errors[payload.error?.code] ?? "ทำรายการไม่สำเร็จ กรุณาตรวจรายชื่อก่อนลองอีกครั้ง"); return;
      }
      committed = true;
      if (!member) setEmail("");
      setRows(await fetchRows());
      setMessage(member ? `ถอด ${member.displayName} ออกจากทีมผู้สอนแล้ว` : "เพิ่มสมาชิกผู้สอนแล้ว");
    } catch {
      setError(true); setUncertain(true);
      setMessage(committed ? "บันทึกแล้ว แต่โหลดรายชื่อไม่สำเร็จ กรุณาโหลดรายชื่อใหม่" : "ยังยืนยันผลไม่ได้ กรุณาโหลดรายชื่อใหม่ก่อนทำรายการซ้ำ");
    } finally { latch.current = false; setBusy(false); }
  }
  return <section className="form-panel" aria-labelledby="classroom-staff-title">
    <div className="fs-section-heading"><h2 id="classroom-staff-title">ทีมผู้สอน</h2><button className="secondary-button" disabled={busy || loading} onClick={refresh}>โหลดรายชื่อใหม่</button></div>
    <p>เจ้าของห้องเพิ่มอาจารย์ร่วมหรือผู้ช่วยสอนได้ โดยใช้บัญชีที่เคยเข้าสู่ระบบแล้ว</p>
    {message && <p className={error ? "error-box" : "notice"} role={error ? "alert" : "status"}>{message}</p>}
    {loading ? <p role="status">กำลังโหลดทีมผู้สอน…</p> : <div className="table-wrap" tabIndex={0} role="region" aria-label="ตารางทีมผู้สอน"><table>
      <caption className="sr-only">ทีมผู้สอนที่ยังอยู่ในห้องเรียน</caption>
      <thead><tr><th scope="col">ชื่อ</th><th scope="col">อีเมล</th><th scope="col">บทบาท</th><th scope="col">จัดการ</th></tr></thead>
      <tbody>{rows.map(member => <tr key={member.userId}><td>{member.displayName}</td><td>{member.email}</td><td>{roles[member.role]}</td><td>{member.role === "OWNER" ? "เจ้าของห้อง" : <button className="secondary-button" disabled={busy || uncertain} aria-label={`ถอด ${member.displayName} ออกจากทีมผู้สอน`} onClick={() => setTarget(member)}>ถอดออก</button>}</td></tr>)}</tbody>
    </table></div>}
    <form className="fs-staff-form" onSubmit={event => { event.preventDefault(); void mutate(); }}>
      <div className="form-grid">
        <label className="field">อีเมลผู้สอนหรือผู้ช่วยสอน<input type="email" required maxLength={254} value={email} disabled={busy || uncertain || loading} onChange={event => setEmail(event.target.value)} aria-describedby="staff-account-help" autoComplete="off" /></label>
        <label className="field">บทบาท<select aria-label="บทบาท" value={role} disabled={busy || uncertain || loading} onChange={event => setRole(event.target.value)}><option value="CO_TEACHER">อาจารย์ร่วม</option><option value="TA">ผู้ช่วยสอน</option></select></label>
      </div>
      <p id="staff-account-help" className="field-help">กรอกอีเมลที่ใช้เข้าสู่ระบบ การเพิ่มสมาชิกจะให้สิทธิ์ในห้องนี้ทันที</p>
      <div className="actions"><button className="primary-button" disabled={busy || uncertain || loading || !email.trim()} type="submit">{busy ? "กำลังทำรายการ…" : "เพิ่มสมาชิกผู้สอน"}</button></div>
    </form>
    <ConfirmationDialog open={!!target} title="ถอดสมาชิกผู้สอนออกจากห้อง?" confirmLabel="ยืนยันถอดออก" onCancel={() => setTarget(null)} onConfirm={() => { if (target) void mutate(target); }}>
      <p>{target?.displayName} ({target ? roles[target.role] : ""}) จะเข้าใช้ห้องนี้ในบทบาทเดิมไม่ได้ ประวัติการทำรายการยังคงอยู่ และสามารถเพิ่มบัญชีนี้กลับภายหลังได้</p>
    </ConfirmationDialog>
  </section>;
}
