"use client";
import { useEffect } from "react";
export default function SessionRefresh() {
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void fetch("/api/auth/session", { method: "POST" }).catch(() => {}); };
    const timer = setInterval(refresh, 30 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return null;
}
