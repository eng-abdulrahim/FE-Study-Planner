// Small shared helpers (pure).

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** Parse an ISO yyyy-mm-dd string into a local Date at midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Whole calendar days from `fromISO` to `toISO` (toISO - fromISO). */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO).getTime();
  const b = parseISODate(toISO).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function formatHours(hours: number): string {
  return `${round1(Math.max(0, Number.isFinite(hours) ? hours : 0))}h`;
}

/** Whole-percent label from a 0..1 fraction, clamped to 0..100: "12%". */
export function formatPercent(fraction: number): string {
  return `${clamp(Math.round((Number.isFinite(fraction) ? fraction : 0) * 100), 0, 100)}%`;
}

/** Compact "done/total" progress label, e.g. "3/7". Safe when total is 0. */
export function formatWeekProgress(done: number, total: number): string {
  const t = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  const d = clamp(Math.round(Number.isFinite(done) ? done : 0), 0, t);
  return `${d}/${t}`;
}

/** Compact minutes label: "45m", "1h", "1h 30m". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
