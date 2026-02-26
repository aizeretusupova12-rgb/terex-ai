export type DayKey = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Mon..Sun

export const DAY_LABEL: Record<DayKey, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const js = d.getDay(); // 0 Sun..6 Sat
  const diff = js === 0 ? -6 : 1 - js;
  d.setDate(d.getDate() + diff);
  return d;
}

export function dayKeyFromDate(date: Date): DayKey {
  const js = date.getDay(); // 0 Sun
  if (js === 0) return 7;
  return js as DayKey; // 1..6 => Mon..Sat
}

export function parseHHMM(s: string) {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return { hh: Number.isFinite(h) ? h : 9, mm: Number.isFinite(m) ? m : 0 };
}

export function fmtTimeFromMinutes(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function daysUntil(deadlineISO: string, fromISO: string) {
  const a = fromISODate(fromISO).getTime();
  const b = fromISODate(deadlineISO).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}