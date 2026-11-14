import { ChevronRight } from "lucide-react";
import { YearForecast } from "../../api/dashboard";
import { formatCurrency } from "../../utils/currency";
import { monthLabel } from "../../utils/month";
import { plural } from "../../utils/text";
import { Badge, Button, Card, SectionHeading, cn } from "../../components/ui";
import { EmptyRow, STICKY_THEAD, TD, TH } from "../../components/ui/Table";
import { StatTile } from "./StatTile";

/** A year's forecast vs invoiced, month by month. Each row opens that month's full view. */
export function YearForecastSection({ data, onOpenMonth }: { data: YearForecast; onOpenMonth: (month: string) => void }) {
  const { totals } = data;
  const months = [...data.months].reverse(); // newest first

  return (
    <div className="mb-8">
      <SectionHeading>Forecast vs Invoiced — {data.year}</SectionHeading>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Each month is measured against its forecast as it stood when the previous month ended. Year totals cover the{" "}
        {plural(totals.trackedMonths, "month")} that had a forecast.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Forecast" value={formatCurrency(totals.forecastTotal)} sub={plural(totals.trackedMonths, "month")} />
        <StatTile label="Invoiced (in those months)" value={formatCurrency(totals.invoicedTotal)} />
        <StatTile
          label="Invoiced vs forecast"
          value={totals.achievedPercent === null ? "—" : `${totals.achievedPercent}%`}
          tone={totals.achievedPercent === null ? "default" : totals.achievedPercent >= 100 ? "good" : "default"}
        >
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={cn("h-full rounded-full", (totals.achievedPercent ?? 0) >= 100 ? "bg-success" : "bg-yellow")}
              style={{ width: `${Math.min(100, totals.achievedPercent ?? 0)}%` }}
            />
          </div>
        </StatTile>
      </div>

      <Card className="overflow-hidden">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className={TH}>Month</th>
                <th className={cn(TH, "text-right")}>Forecast</th>
                <th className={cn(TH, "text-right")}>Invoiced</th>
                <th className={cn(TH, "text-right")}>Invoiced vs forecast</th>
                <th className={cn(TH, "text-right")}>Not invoiced</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {months.length === 0 && <EmptyRow cols={6}>No months to show yet.</EmptyRow>}
              {months.map((m) => (
                <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className={TD}>
                    <span className="font-semibold text-gray-900 dark:text-gray-50">{monthLabel(m.month)}</span>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {m.isCurrentMonth && <Badge tone="brand">In progress</Badge>}
                      {m.backdatedTotal > 0 && <Badge tone="outline">Backdated</Badge>}
                    </span>
                  </td>
                  {m.tracked ? (
                    <>
                      <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(m.forecastTotal)}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(m.invoicedTotal)}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>{m.achievedPercent === null ? "—" : `${m.achievedPercent}%`}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>
                        {m.notInvoicedTotal > 0 ? formatCurrency(m.notInvoicedTotal) : "—"}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className={cn(TD, "text-right text-xs text-gray-500 dark:text-gray-400")}>
                      No forecast — before forecasting started
                    </td>
                  )}
                  <td className={cn(TD, "text-right")}>
                    <Button size="sm" variant="ghost" onClick={() => onOpenMonth(m.month)}>
                      View month <ChevronRight className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
