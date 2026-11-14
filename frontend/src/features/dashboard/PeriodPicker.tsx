import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, Segmented } from "../../components/ui";
import { currentMonthKey, monthLabel } from "../../utils/month";

/** A dashboard period: a month ("2026-10") or a whole year ("2026"). */
export const isYearPeriod = (period: string) => period.length === 4;

/**
 * Period selector: [Month | Year]  ‹ [October 2026 ▾] ›
 * `months` / `years` are newest first; the arrows step through the list for the current view.
 */
export function PeriodPicker({
  value,
  months,
  years,
  onChange,
}: {
  value: string;
  months: string[];
  years: string[];
  onChange: (value: string) => void;
}) {
  const yearView = isYearPeriod(value);
  const list = yearView ? years : months;
  // Make sure the current selection is always present, even before the lists have loaded.
  const options = list.includes(value) ? list : [value, ...list];
  const idx = options.indexOf(value);
  const older = options[idx + 1];
  const newer = options[idx - 1];
  const unit = yearView ? "year" : "month";

  function switchView(view: "month" | "year") {
    if (view === "year") return onChange(value.slice(0, 4));
    // Back to months: the current month for this year, otherwise December of that year.
    const thisMonth = currentMonthKey();
    onChange(value === thisMonth.slice(0, 4) ? thisMonth : `${value}-12`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Dashboard view"
        value={yearView ? "year" : "month"}
        onChange={switchView}
        options={[
          { value: "month", label: "Month" },
          { value: "year", label: "Year" },
        ]}
      />
      <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
        <IconButton label={`Previous ${unit}`} size="sm" disabled={!older} onClick={() => older && onChange(older)} className="ml-0.5">
          <ChevronLeft />
        </IconButton>
        <label className="relative flex items-center">
          <span className="sr-only">Dashboard {unit}</span>
          <CalendarDays className="pointer-events-none absolute left-2 size-4 text-gray-500" />
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 min-w-[11rem] appearance-none bg-transparent pr-2 pl-8 text-sm font-semibold text-gray-900 outline-none dark:text-gray-100 dark:[color-scheme:dark]"
          >
            {options.map((p) => (
              <option key={p} value={p}>
                {yearView ? p : monthLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <IconButton label={`Next ${unit}`} size="sm" disabled={!newer} onClick={() => newer && onChange(newer)} className="mr-0.5">
          <ChevronRight />
        </IconButton>
      </div>
    </div>
  );
}
