import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { History, Lock, Save, Search, Undo2, Unlock } from "lucide-react";
import { useJobs } from "../../api/jobs";
import { useAssignForecast, useCommittedForecast, useForecastMonthStatus } from "../../api/dashboard";
import { useAuth } from "../../auth/AuthContext";
import { canEditForecast } from "../../auth/permissions";
import { STAGE_LABELS } from "../../constants";
import { Job, StageName } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { defaultForecastAmount } from "../../utils/forecast";
import { hasPurchaseOrder, isNonInvoicedJobType } from "../../utils/jobTypes";
import { daysBetween, formatDate } from "../../utils/date";
import { plural } from "../../utils/text";
import { currentStageSla } from "../../utils/jobStatus";
import { Alert, Badge, BadgeTone, Button, Card, Checkbox, PageHeader, PageSpinner, Segmented, TextField, cn } from "../../components/ui";
import { currentMonthKey, monthLabel, monthRange } from "../../utils/month";
import { SlaChip } from "../common/SlaChip";
import { apiErrorMessage } from "../../api/client";
import { EmptyRow, STICKY_THEAD, TH, TD } from "../../components/ui/Table";

type View = "all" | "ticked" | "unforecast";

/** A job's place in the selected month's forecast. `locked` = fixed when a past month ended. */
interface Entry {
  amount: number;
  locked: boolean;
}

/** Closest-to-invoicing first — those are the likeliest to land in the month. */
const STAGE_ORDER: StageName[] = ["INVOICING", "DISPATCH", "REPAIR", "AWAITING_PO", "QUOTATION", "CLOSED"];
const STAGE_TONE: Partial<Record<StageName, BadgeTone>> = { INVOICING: "success", DISPATCH: "success", REPAIR: "brand", CLOSED: "success" };

function formatLockDate(iso: string): string {
  // locksAt is the first instant of the month — show the last day of the previous month.
  const d = new Date(new Date(iso).getTime() - 1);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long" });
}

/** First and last instant of a "YYYY-MM" month (local time). */
function monthBounds(key: string) {
  const [y, m] = key.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(new Date(y, m, 1).getTime() - 1) };
}

export function ForecastPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const options = monthRange(-1, 11); // the previous month (backdating), this month and the next 11
  const previousMonth = options[0];
  const month = params.get("month") && options.includes(params.get("month")!) ? params.get("month")! : options[2];
  const backdating = month === previousMonth;

  const { data: jobs, isLoading } = useJobs({});
  const { data: status } = useForecastMonthStatus(month);
  const { data: committed } = useCommittedForecast(month, backdating);
  const assign = useAssignForecast(month);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"" | StageName>("");
  // Unsaved changes: job → amount to forecast, or null to take it out. Saved with the Save button.
  const [draft, setDraft] = useState<Map<string, number | null>>(new Map());
  const unsaved = draft.size;

  // Don't lose unsaved ticks by closing or reloading the tab.
  useEffect(() => {
    if (unsaved === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // The month's saved forecast entries: the live forecast for this month onwards; for the previous
  // month, its committed entries (locked at month end, or backdated since).
  const savedEntries = useMemo(() => {
    const map = new Map<string, Entry>();
    if (backdating) {
      for (const row of committed ?? []) map.set(row.jobId, { amount: row.amount, locked: !row.backdated });
    } else {
      for (const j of jobs ?? []) if (j.forecastMonth === month) map.set(j.id, { amount: j.forecastAmount ?? 0, locked: false });
    }
    return map;
  }, [backdating, committed, jobs, month]);

  // What's on screen: saved entries with the unsaved changes applied.
  const entries = useMemo(() => {
    const map = new Map(savedEntries);
    for (const [jobId, amount] of draft) {
      if (amount === null) map.delete(jobId);
      else map.set(jobId, { amount, locked: false });
    }
    return map;
  }, [savedEntries, draft]);

  // Jobs that can be forecast for the month. Only invoiced service types, and only once there's a PO.
  // For the previous month: jobs that were open during it (opened by its end, not invoiced before
  // it began) — even if they've been invoiced since.
  const { candidates, withoutPoCount } = useMemo(() => {
    const { start, end } = monthBounds(month);
    const inScope = (j: Job) =>
      !isNonInvoicedJobType(j.jobType) &&
      (backdating
        ? new Date(j.jobCreatedDate) <= end && !(j.invoice?.invoiceDate && new Date(j.invoice.invoiceDate) < start)
        : !j.invoice?.invoiceDate && !j.status.isClosed);
    const scoped = (jobs ?? []).filter((j) => inScope(j) || entries.has(j.id));
    const candidates = scoped
      .filter((j) => hasPurchaseOrder(j) || entries.has(j.id))
      .sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.status.currentStage) - STAGE_ORDER.indexOf(b.status.currentStage) ||
          a.referenceNumber.localeCompare(b.referenceNumber)
      );
    return { candidates, withoutPoCount: scoped.length - candidates.length };
  }, [jobs, month, backdating, entries]);

  // Everything shown, recomputed only when the list, month or filters change.
  const { ticked, total, unforecastCount, visible, eligible, visibleTicked } = useMemo(() => {
    const isTicked = (j: Job) => entries.has(j.id);
    // Live months: a job forecast for another month counts as forecast; past month: only its entries.
    const isForecast = (j: Job) => isTicked(j) || (!backdating && !!j.forecastMonth);
    const q = search.trim().toLowerCase();
    const visible = candidates.filter(
      (j) =>
        (view === "all" || (view === "ticked" ? isTicked(j) : !isForecast(j))) &&
        (!stage || j.status.currentStage === stage) &&
        (!q || [j.referenceNumber, j.customer, j.description].some((v) => v?.toLowerCase().includes(q)))
    );
    const ticked = candidates.filter(isTicked);
    return {
      ticked,
      total: ticked.reduce((s, j) => s + entries.get(j.id)!.amount, 0),
      unforecastCount: candidates.filter((j) => !isForecast(j)).length,
      visible,
      // "Tick all" skips locked entries, and jobs forecast for a different month — moving those is
      // done one at a time, deliberately.
      eligible: visible.filter((j) => !entries.get(j.id)?.locked && (isTicked(j) || !isForecast(j))),
      visibleTicked: visible.filter((j) => isTicked(j) && !entries.get(j.id)!.locked),
    };
  }, [candidates, entries, backdating, view, stage, search]);
  const allVisibleTicked = eligible.length > 0 && visibleTicked.length === eligible.length;

  if (!canEditForecast(user?.role)) return <Navigate to="/" replace />;
  if (isLoading || !jobs || (backdating && !committed)) return <PageSpinner />;

  /** Records an unsaved change, dropping it again if it just restores what's saved. */
  function change(updates: Array<[Job, number | null]>) {
    setDraft((prev) => {
      const next = new Map(prev);
      for (const [job, amount] of updates) {
        const saved = savedEntries.get(job.id);
        const same = amount === null ? !saved : saved?.amount === amount;
        if (same) next.delete(job.id);
        else next.set(job.id, amount);
      }
      return next;
    });
  }
  // Ticking a job that was saved and then unticked brings back its saved amount.
  const tick = (list: Job[]) => change(list.map((j) => [j, savedEntries.get(j.id)?.amount ?? defaultForecastAmount(j)]));
  const untick = (list: Job[]) => change(list.map((j) => [j, null]));

  function save() {
    const set: { jobId: string; amount: number }[] = [];
    const clear: string[] = [];
    for (const [jobId, amount] of draft) {
      if (amount === null) clear.push(jobId);
      else set.push({ jobId, amount });
    }
    assign.mutate({ set, clear }, { onSuccess: () => setDraft(new Map()) });
  }

  function selectMonth(next: string) {
    if (unsaved > 0 && !window.confirm(`You have ${plural(unsaved, "unsaved change")}. Switch month and discard them?`)) return;
    setDraft(new Map());
    assign.reset();
    setParams({ month: next });
  }

  const label = monthLabel(month);
  const isCurrent = month === currentMonthKey();

  return (
    <div>
      <PageHeader
        title="Invoice Forecast"
        subtitle="Tick the jobs you plan to invoice in the month. Each counts at its PO value — adjust the amount if needed. Only jobs with a PO can be forecast."
      >
        <TextField
          select
          label="Forecast month"
          size="sm"
          value={month}
          onChange={(e) => selectMonth(e.target.value)}
          className="w-56"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
              {m === previousMonth ? " (backdate)" : ""}
            </option>
          ))}
        </TextField>
      </PageHeader>

      {backdating && (
        <Alert severity="warning" className="mb-4">
          <strong>Backdating {label}.</strong> This month has ended. Jobs you tick are added to {label}'s forecast and shown
          as "Backdated" on the dashboard. Entries locked when the month ended can't be changed here.
        </Alert>
      )}

      {/* Running total for the month */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-yellow p-5">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label} forecast</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-gray-50">{formatCurrency(total)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{plural(ticked.length, "job")} ticked</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Save className="size-4" />} onClick={save} disabled={unsaved === 0} loading={assign.isPending}>
              {assign.isPending ? "Saving…" : unsaved > 0 ? `Save forecast (${plural(unsaved, "change")})` : "Saved"}
            </Button>
            {unsaved > 0 && !assign.isPending && (
              <Button variant="ghost" icon={<Undo2 className="size-4" />} onClick={() => setDraft(new Map())}>
                Discard
              </Button>
            )}
          </div>
        </div>
        {status && (
          <div className="flex max-w-md items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            {backdating ? (
              <History className="mt-0.5 size-4 shrink-0" />
            ) : status.locked ? (
              <Lock className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Unlock className="mt-0.5 size-4 shrink-0" />
            )}
            <p>
              {backdating ? (
                <>The previous month can be backdated until this month ends; after that it closes.</>
              ) : status.provisional ? (
                <>{label} is the first month of forecasting — changes still count toward this month's comparison.</>
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
                { value: "all", label: `All (${candidates.length})` },
                { value: "ticked", label: `Ticked (${ticked.length})` },
                { value: "unforecast", label: `Not forecast (${unforecastCount})` },
              ]}
            />
          </div>
        </div>
        {withoutPoCount > 0 && (
          <p className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
            {plural(withoutPoCount, "job")} without a PO {withoutPoCount === 1 ? "isn't" : "aren't"} shown — they can be
            forecast once the PO is recorded.
          </p>
        )}

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
                    onChange={() => (allVisibleTicked ? untick(visibleTicked) : tick(eligible.filter((j) => !entries.has(j.id))))}
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
                <EmptyRow cols={6}>{candidates.length === 0 ? "There are no jobs with a PO to forecast." : "No jobs match."}</EmptyRow>
              )}
              {visible.map((job) => {
                const entry = entries.get(job.id);
                const busy = assign.isPending;
                const isUnsaved = draft.has(job.id);
                const sla = currentStageSla(job);
                return (
                  <tr
                    key={job.id}
                    className={cn(
                      "transition-colors",
                      entry ? "bg-yellow-soft/60 dark:bg-yellow/5" : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                      isUnsaved && "shadow-[inset_3px_0_0_var(--color-yellow)]"
                    )}
                  >
                    <td className={TD}>
                      <Checkbox
                        aria-label={`Forecast ${job.referenceNumber} for ${label}`}
                        checked={!!entry}
                        disabled={busy || entry?.locked}
                        title={entry?.locked ? `Locked when ${label} ended` : undefined}
                        onChange={() => (entry ? untick([job]) : tick([job]))}
                      />
                    </td>
                    <td className={TD}>
                      <button
                        type="button"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="text-left font-semibold text-gray-900 hover:underline dark:text-gray-50"
                      >
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
                      {!entry ? (
                        <span className="text-gray-400">—</span>
                      ) : entry.locked ? (
                        <span className="tabular-nums">{formatCurrency(entry.amount)}</span>
                      ) : (
                        <AmountInput
                          jobRef={job.referenceNumber}
                          amount={entry.amount}
                          busy={busy}
                          onSave={(amount) => change([[job, amount]])}
                        />
                      )}
                    </td>
                    <td className={cn(TD, "text-xs text-gray-500 dark:text-gray-400")}>
                      <div className="flex flex-col items-start gap-1">
                        {isUnsaved && <Badge tone="warning">Unsaved</Badge>}
                        {entry?.locked && (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="size-3" /> Locked when {label} ended
                          </span>
                        )}
                        {backdating && entry && !entry.locked && <Badge tone="warning">Backdated</Badge>}
                        <PoReceivedNote job={job} />
                        {!backdating && !entry && job.forecastMonth && (
                          <span>Forecast for {monthLabel(job.forecastMonth)} — ticking moves it</span>
                        )}
                        {entry && Number(job.poValue) <= 0 && <span>No PO value yet — amount from the quote</span>}
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
  const overdue = days > TYPICAL_PO_TO_INVOICE_DAYS && !job.invoice?.invoiceDate;
  const age = days === 0 ? "today" : `${plural(days, "day")} ago`;
  return (
    <span
      title={overdue ? `PO-to-invoice usually takes about ${TYPICAL_PO_TO_INVOICE_DAYS} days` : undefined}
      className={cn(
        "rounded-md px-1.5 py-0.5",
        overdue
          ? "bg-yellow-soft font-medium text-gray-900 ring-1 ring-yellow ring-inset dark:bg-yellow/10 dark:text-yellow"
          : "text-gray-600 dark:text-gray-300"
      )}
    >
      PO received {formatDate(poDate)} · {age}
    </span>
  );
}

/** Forecast amount, editable in place; saves on Enter or when the field loses focus. */
function AmountInput({
  jobRef,
  amount,
  busy,
  onSave,
}: {
  jobRef: string;
  amount: number;
  busy: boolean;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = useState(String(amount));
  useEffect(() => setValue(String(amount)), [amount]);

  const commit = () => {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0) {
      setValue(String(amount));
      return;
    }
    if (n !== amount) onSave(n);
  };

  return (
    <TextField
      hideLabel
      label={`Forecast amount for ${jobRef}`}
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
