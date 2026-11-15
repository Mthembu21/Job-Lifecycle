import { Link } from "react-router-dom";
import { Insights } from "../../api/dashboard";
import { STAGE_LABELS } from "../../constants";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import { useThemeMode } from "../../theme/ThemeProvider";
import { getCategoricalPalette, STATUS_COLORS } from "../../theme/chartPalette";
import { Badge, Card, CardTitle, SectionHeading, cn } from "../../components/ui";
import { EmptyRow, TH } from "../../components/ui/Table";
import { ChartCard } from "./charts/ChartCard";
import { CategoryBarChart } from "./charts/CategoryBarChart";
import { DashboardTable, TD, useJobRowLink } from "./DashboardTable";

/** A job-list link for the jobs behind a figure, or undefined when the list can't match it
 * (a past period: the job list always shows today). */
export type JobsLink = (params: Record<string, string>) => string | undefined;

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{children}</p>;
}

function ShowAll({ to, children }: { to: string | undefined; children: React.ReactNode }) {
  if (!to) return null;
  return (
    <Link to={to} className="mt-3 inline-block text-sm font-semibold text-gray-700 underline decoration-yellow decoration-2 underline-offset-4 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-50">
      {children} →
    </Link>
  );
}

/**
 * "Where are the delays, and why?" — the open jobs as they stood at the period's cut-off: delayed by
 * stage, how long they've been waiting, the worst ones, the recorded reasons, outwork and missing
 * WO numbers.
 */
export function DelayInsights({ insights, asOfLabel, jobsLink }: { insights: Insights; asOfLabel: string; jobsLink: JobsLink }) {
  const { mode } = useThemeMode();
  const categorical = getCategoricalPalette(mode);
  const row = useJobRowLink();
  const { delaysByStage, waitingTime, overdue, overdueCount, delayReasons, lateWithoutReason, outwork, awaitingWo } = insights;
  const maxReason = Math.max(1, ...delayReasons.map((r) => r.count));

  return (
    <>
      <SectionHeading>Where the delays are {asOfLabel}</SectionHeading>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Open jobs by stage — on track vs past target">
          <CategoryBarChart
            categories={delaysByStage.map((s) => `${s.label}${s.targetDays !== null ? ` (${s.targetDays}d)` : ""}`)}
            series={[
              { label: "On track", data: delaysByStage.map((s) => s.total - s.delayed), color: STATUS_COLORS.good },
              { label: "Past target", data: delaysByStage.map((s) => s.delayed), color: STATUS_COLORS.critical },
            ]}
          />
        </ChartCard>
        <ChartCard title="How long open jobs have been in their current stage">
          <CategoryBarChart
            categories={waitingTime.map((b) => b.label)}
            series={[{ label: "Open jobs", data: waitingTime.map((b) => b.value), color: categorical[0] }]}
          />
        </ChartCard>
      </div>

      <Card className="mb-4 p-5">
        <CardTitle>Furthest past target</CardTitle>
        <Note>
          {overdueCount === 0
            ? `No open jobs are past their stage target ${asOfLabel}.`
            : `${overdueCount} open job${overdueCount === 1 ? " is" : "s are"} past the target for the stage they're in. The ${Math.min(15, overdueCount)} longest overdue are listed — click one to open it.`}
        </Note>
        <DashboardTable
          head={
            <>
              <th className={TH}>Reference</th>
              <th className={TH}>Customer</th>
              <th className={TH}>Stage</th>
              <th className={cn(TH, "text-right")}>Days in stage</th>
              <th className={cn(TH, "text-right")}>Target</th>
              <th className={cn(TH, "text-right")}>Days over</th>
              <th className={TH}>Delay reason</th>
              <th className={cn(TH, "text-right")}>Value</th>
            </>
          }
        >
          {overdue.length === 0 && <EmptyRow cols={8}>Nothing overdue.</EmptyRow>}
          {overdue.map((r) => (
            <tr key={r.id} {...row(r.id)}>
              <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
              <td className={TD}>{r.customer}</td>
              <td className={TD}>{STAGE_LABELS[r.stage]}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{r.daysInStage}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{r.targetDays}</td>
              <td className={cn(TD, "text-right font-semibold text-danger tabular-nums dark:text-danger-light")}>+{r.daysOver}</td>
              <td className={cn(TD, "max-w-64 truncate")} title={r.delayReason ?? undefined}>
                {r.delayReason ?? <span className="text-gray-400">Not recorded</span>}
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>{r.value > 0 ? formatCurrency(r.value) : "—"}</td>
            </tr>
          ))}
        </DashboardTable>
        <ShowAll to={overdueCount > 0 ? jobsLink({ status: "DELAYED" }) : undefined}>Show all {overdueCount} delayed jobs</ShowAll>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>Why jobs are late</CardTitle>
          <Note>Delay reasons recorded on stages that ran past target — still open, or finished in this period.</Note>
          {delayReasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No delay reasons recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {delayReasons.map((r) => (
                <li key={r.reason}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-gray-800 dark:text-gray-100" title={r.reason}>
                      {r.reason}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{r.count}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-1.5 rounded-full bg-yellow" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{r.stages.join(", ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {lateWithoutReason > 0 && (
            <p className="mt-4 rounded-lg bg-yellow-soft px-3 py-2 text-xs text-gray-800 dark:bg-yellow/10 dark:text-gray-200">
              <strong>{lateWithoutReason}</strong> late job{lateWithoutReason === 1 ? " has" : "s have"} no delay reason
              recorded for the stage {lateWithoutReason === 1 ? "it's" : "they're"} in. A reason is asked for when the stage
              is saved — open the job and update its current stage to add one.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <CardTitle>Out at suppliers</CardTitle>
          <Note>Open jobs sent out for outwork and not yet back {asOfLabel}.</Note>
          <DashboardTable
            maxHeight={300}
            head={
              <>
                <th className={TH}>Reference</th>
                <th className={TH}>Supplier</th>
                <th className={TH}>Sent</th>
                <th className={cn(TH, "text-right")}>Days out</th>
              </>
            }
          >
            {outwork.atSupplier.length === 0 && <EmptyRow cols={4}>No jobs are out at a supplier.</EmptyRow>}
            {outwork.atSupplier.map((r) => (
              <tr key={r.id} {...row(r.id)}>
                <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
                <td className={TD}>{r.supplier}</td>
                <td className={TD}>{formatDate(r.sentDate)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{r.daysOut}</td>
              </tr>
            ))}
          </DashboardTable>
        </Card>
      </div>

      <Card className="mb-8 p-5">
        <CardTitle>
          <span className="flex items-center gap-2">
            Waiting for a WO number <Badge tone={awaitingWo.length > 0 ? "warning" : "neutral"}>{awaitingWo.length}</Badge>
          </span>
        </CardTitle>
        <Note>Open jobs with no WO number yet, longest waiting first (days since Job Opening).</Note>
        <DashboardTable
          maxHeight={320}
          head={
            <>
              <th className={TH}>Reference</th>
              <th className={TH}>Customer</th>
              <th className={TH}>Stage</th>
              <th className={TH}>Job Opening</th>
              <th className={cn(TH, "text-right")}>Days waiting</th>
            </>
          }
        >
          {awaitingWo.length === 0 && <EmptyRow cols={5}>Every open job has a WO number.</EmptyRow>}
          {awaitingWo.map((r) => (
            <tr key={r.id} {...row(r.id)}>
              <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
              <td className={TD}>{r.customer}</td>
              <td className={TD}>{STAGE_LABELS[r.stage]}</td>
              <td className={TD}>{formatDate(r.jobCreatedDate)}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{r.daysWaiting}</td>
            </tr>
          ))}
        </DashboardTable>
      </Card>
    </>
  );
}

/** Open work, delays and the period's invoicing per customer. A row narrows the dashboard to that customer. */
export function CustomerBreakdown({
  customers,
  periodName,
  onSelect,
}: {
  customers: Insights["customers"];
  periodName: string;
  onSelect: (key: string) => void;
}) {
  const totals = customers.reduce(
    (t, c) => ({ open: t.open + c.openJobs, late: t.late + c.delayedJobs, po: t.po + c.awaitingPo, value: t.value + c.openValue, invoiced: t.invoiced + c.invoicedValue }),
    { open: 0, late: 0, po: 0, value: 0, invoiced: 0 }
  );
  return (
    <Card className="mb-8 p-5">
      <CardTitle>By customer</CardTitle>
      <Note>Open jobs and value are at the period end; invoiced is during {periodName}. Click a customer to see the dashboard for their jobs only.</Note>
      <DashboardTable
        head={
          <>
            <th className={TH}>Customer</th>
            <th className={cn(TH, "text-right")}>Open jobs</th>
            <th className={cn(TH, "text-right")}>Past target</th>
            <th className={cn(TH, "text-right")}>Waiting for PO</th>
            <th className={cn(TH, "text-right")}>Open value</th>
            <th className={cn(TH, "text-right")}>Invoiced</th>
          </>
        }
        footer={
          customers.length > 1 && (
            <>
              <td className={TD}>All customers</td>
              <td className={cn(TD, "text-right tabular-nums")}>{totals.open}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{totals.late}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{totals.po}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(totals.value)}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(totals.invoiced)}</td>
            </>
          )
        }
      >
        {customers.length === 0 && <EmptyRow cols={6}>No open or invoiced jobs.</EmptyRow>}
        {customers.map((c) => (
          <tr
            key={c.key}
            onClick={() => onSelect(c.key)}
            className="cursor-pointer transition-colors hover:bg-yellow-soft/60 dark:hover:bg-yellow/5"
          >
            <td className={cn(TD, "font-semibold")}>{c.customer}</td>
            <td className={cn(TD, "text-right tabular-nums")}>{c.openJobs}</td>
            <td className={cn(TD, "text-right tabular-nums", c.delayedJobs > 0 && "font-semibold text-danger dark:text-danger-light")}>
              {c.delayedJobs}
            </td>
            <td className={cn(TD, "text-right tabular-nums")}>{c.awaitingPo}</td>
            <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(c.openValue)}</td>
            <td className={cn(TD, "text-right tabular-nums")}>{c.invoicedValue > 0 ? formatCurrency(c.invoicedValue) : "—"}</td>
          </tr>
        ))}
      </DashboardTable>
    </Card>
  );
}
