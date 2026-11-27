// The demo story is set on Dec 6, 2026. Unless RELAY_DEMO_NOW is "off", the clock starts at that
// moment when the server boots and then runs forward in real time, so new activity still orders.

const DEFAULT_DEMO_NOW = "2026-12-06T09:00:00Z";
const raw = process.env.RELAY_DEMO_NOW ?? DEFAULT_DEMO_NOW;
let anchor: number | null = raw === "off" || raw === "" ? null : Date.parse(raw);
let boot = Date.now();

export function now(): Date {
  return anchor === null ? new Date() : new Date(anchor + (Date.now() - boot));
}

/** For tests and the demo reset: pin the clock to a moment. */
export function setNow(iso: string | null) {
  anchor = iso === null ? null : Date.parse(iso);
  boot = Date.now();
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return isoDate(now());
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export function fmt(date: string | Date | null | undefined): string {
  if (!date) return "–";
  const d = typeof date === "string" ? new Date(date.length === 10 ? date + "T00:00:00Z" : date) : date;
  return fmtDate.format(d);
}

export function fmtLong(d: Date): string {
  return fmtDay.format(d);
}

export function fmtDateTime(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${fmtDate.format(x)}, ${fmtTime.format(x)}`;
}

/** When a person's next batch of asks goes out: 9:00 UTC on the next day (or next Monday for weekly). */
export function nextBatchAt(cadence: string, from: Date = now()): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 9, 0, 0));
  if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
  if (cadence === "weekly") while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
