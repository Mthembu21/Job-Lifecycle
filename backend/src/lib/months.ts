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
  const start = new Date(year, month - 1, 1);
  const endOfMonth = new Date(new Date(year, month, 1).getTime() - 1);
  const isCurrentMonth = endOfMonth.getTime() > now.getTime();
  const asOf = isCurrentMonth ? now : endOfMonth;
  /** Date falls between the 1st and the cut-off. */
  const inMonth = (d: Date | string | null | undefined) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= asOf.getTime();
  };
  return { key: monthKeyOf(start), start, endOfMonth, isCurrentMonth, asOf, inMonth };
}
