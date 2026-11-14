import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MessageSquarePlus, Pencil } from "lucide-react";
import { ForecastOutcome, ForecastReport, ForecastRow, useSaveForecastNote } from "../../api/dashboard";
import { useAuth } from "../../auth/AuthContext";
import { canEditForecast } from "../../auth/permissions";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import { Alert, Badge, BadgeTone, Button, Card, Segmented, SectionHeading, cn } from "../../components/ui";
import { monthLabel } from "./MonthPicker";

const OUTCOME: Record<ForecastOutcome, { label: string; tone: BadgeTone }> = {
  INVOICED: { label: "Invoiced", tone: "success" },
  INVOICED_EARLY: { label: "Invoiced early", tone: "neutral" },
  PENDING: { label: "Not yet invoiced", tone: "brand" },
  SLIPPED: { label: "Slipped", tone: "danger" },
  UNPLANNED: { label: "Unplanned", tone: "dark" },
  CLOSED_NO_INVOICE: { label: "Closed, no invoice", tone: "warning" },
  REMOVED: { label: "Job deleted", tone: "outline" },
};

const FACTOR_CLASS = {
  danger: "border-danger/30 bg-danger-soft text-danger dark:bg-danger/15 dark:text-danger-light",
  warning: "border-yellow bg-yellow-soft text-gray-900 dark:bg-yellow/10 dark:text-yellow",
  info: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
} as const;

type Filter = "all" | "open" | "invoiced" | "unplanned";

const TH = "px-3 py-2 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-600 uppercase dark:text-gray-300";
const TD = "px-3 py-2.5 align-top";

function Tile({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 dark:bg-gray-900",
        tone === "bad" ? "border-l-4 border-gray-200 border-l-danger dark:border-gray-800" : tone === "good" ? "border-l-4 border-gray-200 border-l-success dark:border-gray-800" : "border-gray-200 dark:border-gray-800"
      )}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

export function ForecastSection({ report }: { report: ForecastReport }) {
  const [filter, setFilter] = useState<Filter>("all");
  const label = monthLabel(report.month);
  const { summary: s } = report;

  if (!report.tracked) {
    return (
      <div className="mb-8">
        <SectionHeading>Forecast vs Invoiced — {label}</SectionHeading>
        <Card className="p-5 text-sm text-gray-600 dark:text-gray-400">
          Invoice forecasting wasn't in use yet in {label}, so there's no forecast to compare against.
        </Card>
      </div>
    );
  }

  const isOpen = (r: ForecastRow) => r.outcome === "SLIPPED" || r.outcome === "PENDING" || r.outcome === "CLOSED_NO_INVOICE";
  const rows = report.rows.filter((r) =>
    filter === "all" ? true : filter === "open" ? isOpen(r) : filter === "invoiced" ? r.outcome === "INVOICED" || r.outcome === "INVOICED_EARLY" : r.outcome === "UNPLANNED"
  );
  const noForecast = s.forecastCount === 0;
  const aboveForecast = !noForecast && s.aboveForecastTotal > 0;
  const maxCause = Math.max(1, ...report.causes.map((c) => c.amount));

  return (
    <div className="mb-8">
      <SectionHeading>Forecast vs Invoiced — {label}</SectionHeading>

      {report.provisional ? (
        <Alert severity="info" className="mb-3">
          {label} is the first month of forecasting, so it's compared against the current forecast. From next month on,
          each month is measured against the forecast as it stood when the previous month ended.
        </Alert>
      ) : (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Measured against the forecast as it stood when the previous month ended
          {report.isCurrentMonth ? " — invoices are counted up to today." : "."}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Forecast"
          value={formatCurrency(s.forecastTotal)}
          sub={`${s.forecastCount} job${s.forecastCount === 1 ? "" : "s"}${
            Math.round(s.latestForecastTotal) !== Math.round(s.forecastTotal) ? ` · latest ${formatCurrency(s.latestForecastTotal)}` : ""
          }`}
        />
        <Tile
          label="Invoiced"
          value={formatCurrency(s.invoicedTotal)}
          sub={`${s.invoicedCount} job${s.invoicedCount === 1 ? "" : "s"}${s.unplannedCount ? ` · incl. ${formatCurrency(s.unplannedTotal)} unplanned` : ""}`}
        />
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoiced vs forecast</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {s.achievedPercent === null ? "—" : `${s.achievedPercent}%`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={cn("h-full rounded-full", (s.achievedPercent ?? 0) >= 100 ? "bg-success" : "bg-yellow")}
              style={{ width: `${Math.min(100, s.achievedPercent ?? 0)}%` }}
            />
          </div>
        </div>
        {/* Gap to the forecast: forecast − everything invoiced (unplanned invoices count too). */}
        <Tile
          label={aboveForecast ? "Above forecast" : report.isCurrentMonth ? "Still to invoice" : "Short of forecast"}
          value={noForecast ? "—" : formatCurrency(aboveForecast ? s.aboveForecastTotal : s.remainingTotal)}
          sub={
            noForecast
              ? "No forecast set for this month"
              : s.notInvoicedCount > 0
              ? `${s.notInvoicedCount} forecast job${s.notInvoicedCount === 1 ? "" : "s"} ${report.isCurrentMonth ? "not yet invoiced" : "not invoiced"} (${formatCurrency(s.notInvoicedTotal)})`
              : s.forecastCount > 0
                ? "All forecast jobs invoiced"
                : undefined
          }
          tone={aboveForecast ? "good" : !report.isCurrentMonth && s.remainingTotal > 0 ? "bad" : "default"}
        />
      </div>

      {report.causes.length > 0 && (
        <Card className="mb-4 p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
            Why {report.isCurrentMonth ? "it isn't invoiced yet" : "it wasn't invoiced"} — where the forecast was stuck{" "}
            {report.isCurrentMonth ? "today" : `on ${formatDate(report.asOf)}`}
          </h3>
          <div className="flex flex-col gap-2.5">
            {report.causes.map((c) => (
              <div key={c.cause} className="grid grid-cols-[minmax(9rem,14rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-gray-700 dark:text-gray-300">{c.cause}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-gray-700 dark:bg-gray-300" style={{ width: `${(c.amount / maxCause) * 100}%` }} />
                </div>
                <span className="text-right whitespace-nowrap tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(c.amount)} <span className="text-gray-500">· {c.count} job{c.count === 1 ? "" : "s"}</span>
                </span>
              </div>
            ))}
          </div>
          {report.noWo.count > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <AlertTriangle className="size-4 text-yellow" />
              {report.noWo.count} of these job{report.noWo.count === 1 ? "" : "s"} ({formatCurrency(report.noWo.amount)}) still had no WO
              number.
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Jobs</h3>
          <Segmented
            label="Filter forecast jobs"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${report.rows.length})` },
              { value: "open", label: `${report.isCurrentMonth ? "Not yet invoiced" : "Slipped"} (${s.notInvoicedCount})` },
              { value: "invoiced", label: `Invoiced (${s.deliveredCount})` },
              { value: "unplanned", label: `Unplanned (${s.unplannedCount})` },
            ]}
          />
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_var(--color-gray-200)] dark:bg-gray-800 dark:shadow-[0_1px_0_var(--color-gray-700)]">
              <tr>
                <th className={TH}>Job</th>
                <th className={TH}>Outcome</th>
                <th className={cn(TH, "text-right")}>Forecast</th>
                <th className={cn(TH, "text-right")}>Invoiced</th>
                <th className={TH}>Why</th>
                <th className={cn(TH, "min-w-[16rem]")}>Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                    {report.rows.length === 0 ? `Nothing was forecast or invoiced in ${label}.` : "No jobs in this view."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <ForecastTableRow key={r.jobId} row={r} month={report.month} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ForecastTableRow({ row, month }: { row: ForecastRow; month: string }) {
  const navigate = useNavigate();
  const outcome = OUTCOME[row.outcome];
  const moved = row.currentForecastMonth && row.currentForecastMonth !== month && (row.outcome === "SLIPPED" || row.outcome === "PENDING");
  const canOpen = row.outcome !== "REMOVED";

  return (
    <tr className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
      <td className={TD}>
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => navigate(`/jobs/${row.jobId}`)}
          className="text-left font-semibold text-gray-900 hover:underline disabled:no-underline dark:text-gray-50"
        >
          {row.referenceNumber}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400">{row.customer}</p>
      </td>
      <td className={TD}>
        <Badge tone={outcome.tone}>{outcome.label}</Badge>
        {moved && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Moved to {monthLabel(row.currentForecastMonth!)}</p>}
      </td>
      <td className={cn(TD, "text-right whitespace-nowrap tabular-nums")}>
        {row.forecastAmount === null ? "—" : formatCurrency(row.forecastAmount)}
      </td>
      <td className={cn(TD, "text-right whitespace-nowrap tabular-nums")}>
        {row.invoicedAmount === null ? "—" : formatCurrency(row.invoicedAmount)}
        {row.invoiceDate && <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(row.invoiceDate)}</p>}
      </td>
      <td className={TD}>
        <div className="flex max-w-md flex-wrap gap-1.5">
          {row.factors.map((f, i) => (
            <span key={i} className={cn("rounded-md border px-2 py-0.5 text-xs", FACTOR_CLASS[f.tone])}>
              {f.text}
            </span>
          ))}
          {row.factors.length === 0 && <span className="text-xs text-gray-400">—</span>}
        </div>
      </td>
      <td className={TD}>
        <CommentCell row={row} month={month} />
      </td>
    </tr>
  );
}

function CommentCell({ row, month }: { row: ForecastRow; month: string }) {
  const { user } = useAuth();
  const canEdit = canEditForecast(user?.role);
  const save = useSaveForecastNote(month);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.note?.comment ?? "");

  if (editing) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await save.mutateAsync({ jobId: row.jobId, comment: draft });
          setEditing(false);
        }}
      >
        <textarea
          autoFocus
          rows={2}
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Customer asked to invoice in January"
          className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-yellow focus:ring-4 focus:ring-yellow/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        {save.isError && <p className="text-xs text-danger">Couldn't save — try again.</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="primary" type="submit" loading={save.isPending}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(row.note?.comment ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (row.note) {
    return (
      <div className="group">
        <p className="text-sm text-gray-800 dark:text-gray-200">{row.note.comment}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {row.note.by} · {formatDate(row.note.at)}
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="ml-1 rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit comment" title="Edit comment">
              <Pencil className="size-3" />
            </button>
          )}
        </p>
      </div>
    );
  }

  return canEdit ? (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      <MessageSquarePlus className="size-3.5" /> Add comment
    </button>
  ) : (
    <span className="text-xs text-gray-400">—</span>
  );
}
