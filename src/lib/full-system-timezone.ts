const parts = (date: Date, timeZone: string) => {
  const values = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (name: string) => Number(values.find(part => part.type === name)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
};
export function formatClassroomDateTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("th-TH", { timeZone, hourCycle: "h23" });
}
export function utcToClassroomInput(value: string | null, timeZone: string): string {
  if (!value) return "";
  const p = parts(new Date(value), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
export function classroomInputToUtc(value: string, timeZone: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(value);
  if (!match) throw new Error("Invalid classroom local time");
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall;
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = parts(new Date(guess), timeZone);
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - observed;
  }
  if (utcToClassroomInput(new Date(guess).toISOString(), timeZone) !== value) {
    throw new Error("This local time does not exist in the classroom timezone");
  }
  return new Date(guess).toISOString();
}
