export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Adds `days` business days (skipping Saturdays/Sundays) to a date input
 * value ("YYYY-MM-DD") and returns the result in the same format.
 */
export function addBusinessDays(dateInputValue: string, days: number): string {
  if (!dateInputValue) return "";
  const date = new Date(`${dateInputValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const step = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    date.setDate(date.getDate() + step);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}
