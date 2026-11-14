/*
 * Calendar-month helpers. Months are keyed "YYYY-MM" in the server's local calendar — the same
 * convention the dashboard, forecasting and export all use.
 */

export const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" → { year: 2026, month: 10, key: "2026-10" }; null if malformed. */
export function parseMonth(value: unknown): { year: number; month: number; key: string } | null {
  if (typeof value !== "string") return null;
  const m = MONTH_KEY_RE.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]), key: value } : null;
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m, 1));
}

/**
 * The time window a month covers. `asOf` is the month end — or `now` while the month is still
 * running — and is the cut-off for "what had happened by then".
 */
export function monthWindow(year: number, month: number, now = new Date()) {
  const w = periodWindow(monthKeyOf(new Date(year, month - 1, 1)), new Date(year, month - 1, 1), new Date(year, month, 1), now);
  return { ...w, endOfMonth: w.end, isCurrentMonth: w.isCurrent, inMonth: w.inPeriod };
}

/** A calendar year ("2026"), same shape as a month window. */
export function yearWindow(year: number, now = new Date()) {
  return periodWindow(String(year), new Date(year, 0, 1), new Date(year + 1, 0, 1), now);
}

export type PeriodWindow = ReturnType<typeof periodWindow>;

/** `start` up to (not including) `nextStart`; cut off at `now` while the period is still running. */
function periodWindow(key: string, start: Date, nextStart: Date, now: Date) {
  const end = new Date(nextStart.getTime() - 1);
  const isCurrent = end.getTime() > now.getTime();
  const asOf = isCurrent ? now : end;
  /** Date falls between the start and the cut-off. */
  const inPeriod = (d: Date | string | null | undefined) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= asOf.getTime();
  };
  return { key, start, end, isCurrent, asOf, inPeriod };
}

/** "2026" → 2026; null if it isn't a plausible year. */
export function parseYear(value: unknown): number | null {
  return typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : null;
}
