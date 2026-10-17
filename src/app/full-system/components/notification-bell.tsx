"use client";
import { Bell, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Notice = { id: string; message: string; classroomName: string; assignmentTitle: string;
  deepLink: string; createdAt: string; readAt: string | null };
type Feed = { data: Notice[]; meta: { unreadCount: number; totalCount: number } };
const endpoint = "/api/full-system/notifications";

export default function NotificationBell({ open, onOpenChange }: {
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const path = usePathname();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null), nextLoad = useRef(0);
  const retryAt = useRef(0);
  const mounted = useRef(true), mutation = useRef(false);

  const load = useCallback(async (force = false) => {
    if (request.current || mutation.current || Date.now() < retryAt.current || Date.now() < nextLoad.current && !force) return;
    const controller = new AbortController(); request.current = controller;
    nextLoad.current = Date.now() + 10_000;
    setLoading(true); setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
      if (response.status === 401 || response.status === 428) setFeed(null);
      if (response.status === 429) {
        const retry = response.headers.get("Retry-After");
        const seconds = Number(retry);
        retryAt.current = Math.max(nextLoad.current, Number.isFinite(seconds) && seconds > 0
          ? Date.now() + seconds * 1000 : Date.parse(retry ?? "") || Date.now() + 60_000);
        throw Error("มีการเรียกข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
      }
      if (!response.ok) throw Error("โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่");
      const payload = await response.json() as Feed;
      if (mounted.current) setFeed(payload);
    } catch (failure) {
      if (!controller.signal.aborted && mounted.current) setError(failure instanceof Error ? failure.message : "โหลดการแจ้งเตือนไม่สำเร็จ");
    } finally {
      if (request.current === controller) request.current = null;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [path, load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onOpenChange(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onOpenChange]);

  async function markRead(notice?: Notice) {
    if (mutation.current || notice?.readAt) return;
    if (Date.now() < retryAt.current) { setError("มีการเรียกข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"); return; }
    mutation.current = true; setSaving(true); setError("");
    // Prevent an older GET response from undoing a confirmed read state.
    request.current?.abort(); request.current = null;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notice ? { id: notice.id } : { all: true }), signal: AbortSignal.timeout(8000) });
      if (response.status === 429) {
        const seconds = Number(response.headers.get("Retry-After"));
        retryAt.current = Date.now() + (seconds > 0 ? seconds : 60) * 1000;
      }
      if (response.status === 401 || response.status === 428) setFeed(null);
      if (!response.ok) throw Error("บันทึกสถานะอ่านแล้วไม่สำเร็จ กรุณาลองใหม่");
      if (mounted.current) setFeed(current => current && ({
        data: current.data.map(item => !notice || item.id === notice.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item),
        meta: { ...current.meta, unreadCount: notice ? Math.max(0, current.meta.unreadCount - 1) : 0 },
      }));
    } catch { if (mounted.current) setError("บันทึกสถานะอ่านแล้วไม่สำเร็จ กรุณาลองใหม่"); }
    finally { mutation.current = false; if (mounted.current) setSaving(false); }
  }
  const unread = feed?.meta.unreadCount ?? 0;
  const close = () => { onOpenChange(false); trigger.current?.focus(); };
  return <div className="fs-notification-menu" ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); close(); }
  }}>
    <button ref={trigger} className="fs-bell-button" aria-label={`การแจ้งเตือน${unread ? ` ยังไม่อ่าน ${unread} รายการ` : ""}`}
      aria-expanded={open} aria-controls="notification-panel" onClick={() => { if (!open) void load(); onOpenChange(!open); }}>
      <Bell size={21} aria-hidden="true" />{unread > 0 && <span className="fs-bell-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section id="notification-panel" className="fs-notification-panel" aria-labelledby="notification-panel-title">
      <div className="fs-notification-header"><h2 id="notification-panel-title">การแจ้งเตือน</h2>
        <button className="fs-bell-button" aria-label="ปิดการแจ้งเตือน" onClick={close}><X size={18} aria-hidden="true" /></button></div>
      <div className="fs-notification-toolbar"><span aria-live="polite">ยังไม่อ่าน {unread} รายการ</span>
        <button disabled={!unread || saving || loading} onClick={() => void markRead()}><CheckCheck size={16} aria-hidden="true" />{saving ? "กำลังบันทึก…" : "อ่านทั้งหมดแล้ว"}</button></div>
      {error && <div className="fs-notification-error" role="alert"><p>{error}</p>
        <button className="secondary-button" onClick={() => void load(true)} disabled={loading}>ลองใหม่</button></div>}
      {loading && <p className="fs-notification-status" role="status">กำลังโหลดการแจ้งเตือน…</p>}
      {feed?.data.length ? <ul className="fs-bell-list">{feed.data.map(notice => <li key={notice.id} className={notice.readAt ? "is-read" : "is-unread"}>
        <a href={notice.deepLink} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); if (mutation.current) return;
          void markRead(notice).finally(() => window.location.assign(notice.deepLink));
        }}><strong>{notice.message}</strong><span>{notice.classroomName} · {notice.assignmentTitle}</span>
          <small><time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</time>{!notice.readAt && <b>ยังไม่อ่าน</b>}</small></a>
      </li>)}</ul> : feed && !loading && !error ? <p className="fs-notification-status">ยังไม่มีการแจ้งเตือน</p> : null}
      {feed && feed.meta.totalCount > feed.data.length && <p className="fs-notification-status">แสดง {feed.data.length} รายการล่าสุดจาก {feed.meta.totalCount} รายการ</p>}
    </section>}
  </div>;
}
