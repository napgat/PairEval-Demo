"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, Download, LogOut, UserRound } from "lucide-react";

type Profile = { email: string; displayName?: string; privacyAccepted: boolean };
export default function WorkspaceNavigation() {
  const path = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exporting, setExporting] = useState(false), [message, setMessage] = useState("");
  const account = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" }).then(async response => {
      if (response.ok) { const data = (await response.json()).data; if (active) setProfile(data); }
    }).catch(() => {});
    return () => { active = false; };
  }, [path]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!account.current?.contains(event.target as Node)) account.current?.removeAttribute("open"); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function exportData() {
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/full-system/privacy/export", { method: "POST" });
      if (!response.ok) throw Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "paireval-my-data.json";
      link.click(); URL.revokeObjectURL(url); setMessage("ดาวน์โหลดสำเนาข้อมูลแล้ว");
    } catch { setMessage("ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setExporting(false); }
  }
  if (!profile?.privacyAccepted) return null;
  return <><a className="fs-skip-link" href="#workspace-content">ข้ามไปเนื้อหา</a>
    <header className="fs-workspace-nav"><div className="fs-nav-inner">
      <Link href="/full-system" className="fs-wordmark" aria-label="PairEval หน้าหลัก"><span><BookOpen size={20} aria-hidden="true" /></span>PairEval</Link>
      <nav aria-label="เมนูหลัก"><Link href="/full-system" aria-current={!path.startsWith("/full-system/archive") ? "page" : undefined}>ห้องเรียน</Link>
        <Link href="/full-system/archive" aria-current={path.startsWith("/full-system/archive") ? "page" : undefined}>ห้องเรียนที่เก็บแล้ว</Link></nav>
      <details ref={account} className="fs-account-menu" onKeyDown={event => {
        if (event.key === "Escape") { account.current?.removeAttribute("open"); account.current?.querySelector("summary")?.focus(); }
      }}><summary><UserRound size={18} aria-hidden="true" /><span>{profile.displayName || "บัญชีของฉัน"}</span><ChevronDown size={14} aria-hidden="true" /></summary>
        <div className="fs-account-popover"><strong>{profile.displayName || "บัญชีของฉัน"}</strong><p>{profile.email}</p>
          <button onClick={exportData} disabled={exporting}><Download size={16} aria-hidden="true" />{exporting ? "กำลังดาวน์โหลด…" : "ขอสำเนาข้อมูลของฉัน"}</button>
          <form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={16} aria-hidden="true" />ออกจากระบบ</button></form>
          {message && <p role="status">{message}</p>}
        </div>
      </details>
    </div></header>
  </>;
}
