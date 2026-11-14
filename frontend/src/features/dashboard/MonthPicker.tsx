import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, cn } from "../../components/ui";

export const ALL_TIME = "all";

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

/**
 * Month selector: ‹ [October 2026 ▾] ›, plus "All time".
 * `months` is newest first; the arrows step through it.
 */
export function MonthPicker({
  value,
  months,
  onChange,
}: {
  value: string;
  months: string[];
  onChange: (value: string) => void;
}) {
  // Make sure the current selection is always present, even before the list has loaded.
  const options = months.includes(value) || value === ALL_TIME ? months : [value, ...months];
  const idx = options.indexOf(value);
  const isAll = value === ALL_TIME;
  const older = isAll ? undefined : options[idx + 1];
  const newer = isAll ? undefined : options[idx - 1];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
        <IconButton label="Previous month" size="sm" disabled={!older} onClick={() => older && onChange(older)} className="ml-0.5">
          <ChevronLeft />
        </IconButton>
        <label className="relative flex items-center">
          <span className="sr-only">Dashboard period</span>
          <CalendarDays className="pointer-events-none absolute left-2 size-4 text-gray-500" />
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 min-w-[11rem] appearance-none bg-transparent pr-2 pl-8 text-sm font-semibold text-gray-900 outline-none dark:text-gray-100 dark:[color-scheme:dark]"
          >
            {options.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
            <option value={ALL_TIME}>All time</option>
          </select>
        </label>
        <IconButton label="Next month" size="sm" disabled={!newer} onClick={() => newer && onChange(newer)} className="mr-0.5">
          <ChevronRight />
        </IconButton>
      </div>
      <button
        type="button"
        onClick={() => onChange(isAll ? currentMonthKey() : ALL_TIME)}
        className={cn(
          "h-9 rounded-lg px-3 text-sm font-semibold transition-colors",
          isAll
            ? "bg-yellow text-gray-900 hover:bg-yellow-hover"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        )}
      >
        {isAll ? "This month" : "All time"}
      </button>
    </div>
  );
}
