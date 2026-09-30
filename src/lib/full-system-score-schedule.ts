const formatters = new Map<string, Intl.DateTimeFormat>();
const cached = new Map<string, number>();
function wall(date: Date, zone: string) {
  let f = formatters.get(zone);
  if (!f) { f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); formatters.set(zone, f); }
  const p = f.formatToParts(date);
  const get = (key: string) => p.find(v => v.type === key)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
/** First occurrence of 02:00; on a DST gap use the first valid wall minute after 02:00. */
export function localScoreDue(date: string, zone: string): Date {
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) throw new Error("Invalid schedule date");
  const key = `${zone}:${date}`;
  const prior = cached.get(key); if (prior !== undefined) return new Date(prior);
  const nominal = Date.parse(`${date}T02:00:00Z`);
  if (!Number.isFinite(nominal)) throw new Error("Invalid schedule date");
  for (let t = nominal - 16 * 3600000; t <= nominal + 16 * 3600000; t += 60000) {
    const stamp = wall(new Date(t), zone);
    if (stamp.startsWith(date) && stamp >= `${date}T02:00`) {
      if (cached.size > 500) cached.clear(); cached.set(key, t); return new Date(t);
    }
  }
  throw new Error("Classroom local date does not exist");
}
/** Missed days coalesce to the latest due day; no fabricated historical snapshots. */
export function latestScoreDue(now: Date, zone: string, publishedAt: Date) {
  if (![now.getTime(), publishedAt.getTime()].every(Number.isFinite)) throw new Error("Invalid schedule clock");
  let date = wall(now, zone).slice(0, 10); let due = localScoreDue(date, zone);
  if (due > now) {
    date = new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
    due = localScoreDue(date, zone);
  }
  return due.getTime() >= publishedAt.getTime() ? { localDate: date, scheduledFor: due.toISOString(), timezone: zone } : null;
}
