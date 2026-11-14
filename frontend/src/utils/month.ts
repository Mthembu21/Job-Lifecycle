/** Calendar months keyed "YYYY-MM" (local time) — matches the backend's month keys. */

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" → "October 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

/** Month keys from `from` to `to` months relative to this month (e.g. -2..12), oldest first. */
export function monthRange(from: number, to: number, now = new Date()): string[] {
  const months: string[] = [];
  for (let i = from; i <= to; i++) months.push(currentMonthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  return months;
}
