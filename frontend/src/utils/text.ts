/** "1 job", "3 jobs" — appends "s" unless the count is exactly 1. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
