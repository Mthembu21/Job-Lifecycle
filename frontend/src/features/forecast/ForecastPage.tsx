import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Search, Unlock } from "lucide-react";
import { useJobs } from "../../api/jobs";
import { useAssignForecast, useForecastMonthStatus } from "../../api/dashboard";
import { useAuth } from "../../auth/AuthContext";
import { canEditForecast } from "../../auth/permissions";
import { STAGE_LABELS } from "../../constants";
import { Job, StageName } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { defaultForecastAmount } from "../../utils/forecast";
import { isNonInvoicedJobType } from "../../utils/jobTypes";
import { daysBetween, formatDate } from "../../utils/date";
import { plural } from "../../utils/text";
import { currentStageSla } from "../../utils/jobStatus";
import { Alert, Badge, BadgeTone, Card, Checkbox, PageHeader, PageSpinner, Segmented, TextField, cn } from "../../components/ui";
import { currentMonthKey, monthLabel, monthRange } from "../../utils/month";
import { SlaChip } from "../common/SlaChip";
import { apiErrorMessage } from "../../api/client";
import { EmptyRow, STICKY_THEAD, TH, TD } from "../../components/ui/Table";

type View = "all" | "ticked" | "unforecast";

/** Closest-to-invoicing first — those are the likeliest to land in the month. */
const STAGE_ORDER: StageName[] = ["INVOICING", "DISPATCH", "REPAIR", "AWAITING_PO", "QUOTATION"];
const STAGE_TONE: Partial<Record<StageName, BadgeTone>> = { INVOICING: "success", DISPATCH: "success", REPAIR: "brand" };

function formatLockDate(iso: string): string {
  // locksAt is the first instant of the month — show the last day of the previous month.
  const d = new Date(new Date(iso).getTime() - 1);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long" });
}


export function ForecastPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const options = monthRange(0, 11); // this month + the next 11
  const month = params.get("month") && options.includes(params.get("month")!) ? params.get("month")! : options[1];
  const { data: jobs, isLoading } = useJobs({});
  const { data: status } = useForecastMonthStatus(month);
  const assign = useAssignForecast(month);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"" | StageName>("");
  const [pending, setPending] = useState<Set<string>>(new Set());

  const open = useMemo(
    () =>
      (jobs ?? [])
        // Internal / warranty jobs are never invoiced, so they are not forecast.
        .filter((j) => !j.invoice?.invoiceDate && !j.status.isClosed && !isNonInvoicedJobType(j.jobType))
        .sort(
          (a, b) =>
            STAGE_ORDER.indexOf(a.status.currentStage) - STAGE_ORDER.indexOf(b.status.currentStage) ||
            a.referenceNumber.localeCompare(b.referenceNumber)
        ),
    [jobs]
  );

  const isTicked = (j: Job) => j.forecastMonth === month;

  // Everything derived from the list, recomputed only when the list, month or filters change.
  const { ticked, total, unforecastCount, visible, eligible, visibleTicked } = useMemo(() => {
    const onMonth = (j: Job) => j.forecastMonth === month;
    const q = search.trim().toLowerCase();
    const ticked = open.filter(onMonth);
    const visible = open.filter(
      (j) =>
        (view === "all" || (view === "ticked" ? onMonth(j) : !j.forecastMonth)) &&
        (!stage || j.status.currentStage === stage) &&
        (!q || [j.referenceNumber, j.customer, j.description].some((v) => v?.toLowerCase().includes(q)))
    );
    return {
      ticked,
      total: ticked.reduce((s, j) => s + (j.forecastAmount ?? 0), 0),
      unforecastCount: open.filter((j) => !j.forecastMonth).length,
      visible,
      // "Tick all" only covers jobs that aren't forecast for a different month — moving those is
      // done one at a time, deliberately.
      eligible: visible.filter((j) => onMonth(j) || !j.forecastMonth),
      visibleTicked: visible.filter(onMonth),
    };
  }, [open, month, view, stage, search]);
  const allVisibleTicked = eligible.length > 0 && visibleTicked.length === eligible.length;

  if (!canEditForecast(user?.role)) return <Navigate to="/" replace />;
  if (isLoading || !jobs) return <PageSpinner />;

  async function run(ids: string[], input: Parameters<typeof assign.mutateAsync>[0]) {
    setPending((p) => new Set([...p, ...ids]));
    try {
      await assign.mutateAsync(input);
    } finally {
      setPending((p) => new Set([...p].filter((id) => !ids.includes(id))));
    }
  }

  const tick = (list: Job[]) =>
    run(
      list.map((j) => j.id),
      { set: list.map((j) => ({ jobId: j.id, amount: defaultForecastAmount(j) })) }
    );
  const untick = (list: Job[]) => run(list.map((j) => j.id), { clear: list.map((j) => j.id) });

  const label = monthLabel(month);
  const isCurrent = month === currentMonthKey();

  return (
    <div>
      <PageHeader
        title="Invoice Forecast"
        subtitle="Tick the jobs you plan to invoice in the month. Each counts at its PO value — adjust the amount if needed."
      >
        <TextField
          select
          label="Forecast month"
          size="sm"
          value={month}
          onChange={(e) => setParams({ month: e.target.value })}
          className="w-48"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </TextField>
      </PageHeader>

      {/* Running total for the month */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-yellow p-5">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label} forecast</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-gray-50">{formatCurrency(total)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {plural(ticked.length, "job")} ticked
          </p>
        </div>
        {status && (
          <div className="flex max-w-md items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            {status.locked ? <Lock className="mt-0.5 size-4 shrink-0" /> : <Unlock className="mt-0.5 size-4 shrink-0" />}
            <p>
              {status.provisional ? (
                <>
                  {label} is the first month of forecasting — changes still count toward this month's comparison.
                </>
              ) : status.locked || (isCurrent && status.started) ? (
                <>
                  {label}'s forecast was locked when the previous month ended. Changes now update the latest forecast, but the
                  dashboard compares {label} against the locked one.
                </>
              ) : (
                <>
                  Locks at the end of <strong>{formatLockDate(status.locksAt)}</strong>. Until then you can tick, untick and
                  change amounts freely.
                </>
              )}
            </p>
          </div>
        )}
      </Card>

      {assign.isError && (
        <Alert severity="error" className="mb-4">
          {apiErrorMessage(assign.error, "Couldn't save the forecast — please try again.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="relative w-full sm:w-72">
            <TextField
              label="Search"
              size="sm"
              placeholder="Reference, customer, description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="[&_input]:pl-9"
            />
            <Search className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-gray-400" />
          </div>
          <TextField select label="Stage" size="sm" value={stage} onChange={(e) => setStage(e.target.value as StageName | "")} className="w-44">
            <option value="">All stages</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </TextField>
          <div className="ml-auto">
            <Segmented
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: `All open (${open.length})` },
                { value: "ticked", label: `Ticked (${ticked.length})` },
                { value: "unforecast", label: `Not forecast (${unforecastCount})` },
              ]}
            />
          </div>
        </div>

        <div className="max-h-[max(20rem,calc(100dvh-26rem))] overflow-auto">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    aria-label={allVisibleTicked ? "Untick all shown" : "Tick all shown"}
                    title={allVisibleTicked ? "Untick all shown" : "Tick all shown"}
                    checked={allVisibleTicked}
                    indeterminate={visibleTicked.length > 0 && !allVisibleTicked}
                    disabled={eligible.length === 0 || assign.isPending}
                    onChange={() => (allVisibleTicked ? untick(visibleTicked) : tick(eligible.filter((j) => !isTicked(j))))}
                  />
                </th>
                <th className={TH}>Job</th>
                <th className={TH}>Stage</th>
                <th className={cn(TH, "text-right")}>PO Value</th>
                <th className={cn(TH, "w-48 text-right")}>Forecast Amount</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {visible.length === 0 && (
                <EmptyRow cols={6}>
                    {open.length === 0 ? "There are no open jobs to forecast." : "No jobs match."}
                </EmptyRow>
              )}
              {visible.map((job) => {
                const on = isTicked(job);
                const busy = pending.has(job.id);
                const sla = currentStageSla(job);
                return (
                  <tr key={job.id} className={cn("transition-colors", on ? "bg-yellow-soft/60 dark:bg-yellow/5" : "hover:bg-gray-50 dark:hover:bg-gray-800/50")}>
                    <td className={TD}>
                      <Checkbox
                        aria-label={`Forecast ${job.referenceNumber} for ${label}`}
                        checked={on}
                        disabled={busy}
                        onChange={() => (on ? untick([job]) : tick([job]))}
                      />
                    </td>
                    <td className={TD}>
                      <button type="button" onClick={() => navigate(`/jobs/${job.id}`)} className="text-left font-semibold text-gray-900 hover:underline dark:text-gray-50">
                        {job.referenceNumber}
                      </button>
                      <p className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
                        {job.customer} · {job.description}
                      </p>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap")}>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={STAGE_TONE[job.status.currentStage] ?? "neutral"}>{STAGE_LABELS[job.status.currentStage]}</Badge>
                        {sla && sla.status !== "GREEN" && sla.status !== "NOT_APPLICABLE" && <SlaChip status={sla.status} />}
                      </div>
                    </td>
                    <td className={cn(TD, "text-right whitespace-nowrap tabular-nums")}>
                      {Number(job.poValue) > 0 ? formatCurrency(Number(job.poValue)) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className={cn(TD, "text-right")}>
                      {on ? (
                        <AmountInput job={job} busy={busy} onSave={(amount) => run([job.id], { set: [{ jobId: job.id, amount }] })} />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className={cn(TD, "text-xs text-gray-500 dark:text-gray-400")}>
                      <div className="flex flex-col items-start gap-1">
                        <PoReceivedNote job={job} />
                        {!on && job.forecastMonth && <span>Forecast for {monthLabel(job.forecastMonth)} — ticking moves it</span>}
                        {on && Number(job.poValue) <= 0 && <span>No PO value yet — amount from the quote</span>}
                        {!job.woNumber && <span>No WO number yet</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/**
 * Typical days from PO / go-ahead to invoice, measured from this tracker's invoiced jobs (median 28).
 * A PO waiting longer than this is flagged so it isn't forgotten when forecasting.
 */
const TYPICAL_PO_TO_INVOICE_DAYS = 28;

/** "PO received 12 Oct 2026 · 33 days ago" — highlighted once it's waited longer than usual. */
function PoReceivedNote({ job }: { job: Job }) {
  const poDate = job.repair?.purchaseOrderDate;
  if (!poDate) return null;
  const days = daysBetween(poDate, new Date().toISOString());
  const overdue = days > TYPICAL_PO_TO_INVOICE_DAYS;
  const age = days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
  return (
    <span
      title={overdue ? `PO-to-invoice usually takes about ${TYPICAL_PO_TO_INVOICE_DAYS} days` : undefined}
      className={cn(
        "rounded-md px-1.5 py-0.5",
        overdue ? "bg-yellow-soft font-medium text-gray-900 ring-1 ring-yellow ring-inset dark:bg-yellow/10 dark:text-yellow" : "text-gray-600 dark:text-gray-300"
      )}
    >
      PO received {formatDate(poDate)} · {age}
    </span>
  );
}

/** Forecast amount, editable in place; saves on Enter or when the field loses focus. */
function AmountInput({ job, busy, onSave }: { job: Job; busy: boolean; onSave: (amount: number) => void }) {
  const [value, setValue] = useState(String(job.forecastAmount ?? 0));
  useEffect(() => setValue(String(job.forecastAmount ?? 0)), [job.forecastAmount]);

  const commit = () => {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0) {
      setValue(String(job.forecastAmount ?? 0));
      return;
    }
    if (n !== job.forecastAmount) onSave(n);
  };

  return (
    <TextField
      hideLabel
      label={`Forecast amount for ${job.referenceNumber}`}
      size="sm"
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="ml-auto w-40 [&_input]:text-right [&_input]:tabular-nums"
    />
  );
}
