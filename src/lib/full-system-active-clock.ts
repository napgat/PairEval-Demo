/** Monotonic conservative time: hidden, blurred, idle and throttled gaps contribute zero. */
export class ActiveComparisonClock {
  last: number; activity: number;
  constructor(now: number) { this.last = now; this.activity = now; }
  touch(now: number) { this.activity = now; }
  advance(now: number, available: boolean) {
    const previous = this.last; this.last = now;
    if (!available || now < previous || now - previous > 1500) return 0;
    return Math.max(0, Math.min(now, this.activity + 30000) - previous);
  }
}
export function installSyntheticTiming(path: string) {
  type Lease = { pairId: string; start: Promise<string>; sequence: number; pending: number; closed: boolean; failed: boolean };
  let active: Lease | null = null, wanted: string | null = null, accepting = true;
  let clock = new ActiveComparisonClock(performance.now());
  let chain: Promise<void> = Promise.resolve();
  const visible = new Set<string>();
  const available = () => document.visibilityState === "visible" && document.hasFocus() && !!active && visible.has(active.pairId);
  const send = async (body: object, keepalive = false) => {
    const response = await fetch(`${path}/timing`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive });
    if (!response.ok) throw new Error("Synthetic timing segment unacknowledged");
  };
  const flush = (close: boolean, keepalive = false) => {
    const lease = active; if (!lease || lease.closed) return;
    lease.pending += clock.advance(performance.now(), available());
    // Sample frequently but send bounded batches to avoid a request backlog on slow staging.
    if (!close && lease.pending < 3000) return;
    const deltaMs = Math.floor(lease.pending); lease.pending -= deltaMs;
    if (!close && !deltaMs) return;
    const sequence = ++lease.sequence; if (close) lease.closed = true;
    chain = chain.then(async () => {
      if (lease.failed) return;
      try {
        const leaseId = await lease.start;
        const body = { pairId: lease.pairId, leaseId, sequence, deltaMs, close };
        try { await send(body, keepalive); } catch { await send(body, keepalive); }
      } catch { lease.failed = true; } // Open/unacknowledged leases become NA, never fabricated zeros.
    });
  };
  const start = (pairId: string) => {
    if (!accepting) return;
    if (active && !active.closed && active.pairId === pairId) return;
    flush(true); wanted = pairId; clock = new ActiveComparisonClock(performance.now());
    const promise = fetch(`${path}/timing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairId }) })
      .then(async r => { if (!r.ok) throw new Error("Synthetic timing disabled"); return (await r.json()).data.leaseId as string; });
    void promise.catch(() => {});
    active = { pairId, start: promise, sequence: 0, pending: 0, closed: false, failed: false };
  };
  const resume = () => { if (wanted && visible.has(wanted) && document.visibilityState === "visible" && document.hasFocus()) start(wanted); };
  const suspend = () => flush(true, true);
  const visibility = () => document.visibilityState === "hidden" ? suspend() : resume();
  const activity = () => clock.touch(performance.now());
  const interval = setInterval(() => flush(false), 500);
  const observer = new IntersectionObserver(entries => {
    for (const e of entries) { const id = (e.target as HTMLElement).dataset.pairId!;
      if (e.isIntersecting && e.intersectionRatio >= .25) visible.add(id); else visible.delete(id);
    }
    if (active && !visible.has(active.pairId)) suspend();
    if (!wanted && !active && visible.size) wanted = [...visible][0];
    resume();
  }, { threshold: [.25] });
  document.querySelectorAll("fieldset[data-pair-id]").forEach(node => observer.observe(node));
  document.addEventListener("visibilitychange", visibility); document.addEventListener("pointermove", activity);
  document.addEventListener("keydown", activity); window.addEventListener("focus", resume); window.addEventListener("blur", suspend);
  window.addEventListener("pagehide", suspend);
  return {
    select(pairId: string) { if (!accepting) return; wanted = pairId; if (visible.has(pairId) && document.hasFocus() && document.visibilityState === "visible") start(pairId); activity(); },
    complete(pairId: string) { if (active?.pairId === pairId) { flush(true); wanted = null; } },
    async settle() { await chain; },
    async finish() { accepting = false; flush(true); wanted = null; await chain; },
    resumeRecording() { accepting = true; },
    destroy() { suspend(); clearInterval(interval); observer.disconnect();
      document.removeEventListener("visibilitychange", visibility); document.removeEventListener("pointermove", activity);
      document.removeEventListener("keydown", activity); window.removeEventListener("focus", resume); window.removeEventListener("blur", suspend); window.removeEventListener("pagehide", suspend);
    },
  };
}
