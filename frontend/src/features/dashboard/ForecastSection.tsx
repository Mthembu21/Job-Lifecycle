import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MessageSquarePlus, Pencil } from "lucide-react";
import { ForecastOutcome, ForecastReport, ForecastRow, useSaveForecastNote } from "../../api/dashboard";
import { useAuth } from "../../auth/AuthContext";
import { canEditForecast } from "../../auth/permissions";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import { Alert, Badge, BadgeTone, Button, Card, IconButton, Segmented, SectionHeading, TextField, cn } from "../../components/ui";
import { monthLabel } from "../../utils/month";
import { plural } from "../../utils/text";
import { StatTile } from "./StatTile";
import { EmptyRow, STICKY_THEAD, TH, TD as TD_BASE } from "../../components/ui/Table";

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

const FILTERS: Record<Filter, (r: ForecastRow) => boolean> = {
  all: () => true,
  open: (r) => r.outcome === "SLIPPED" || r.outcome === "PENDING" || r.outcome === "CLOSED_NO_INVOICE",
  invoiced: (r) => r.outcome === "INVOICED" || r.outcome === "INVOICED_EARLY",
  unplanned: (r) => r.outcome === "UNPLANNED",
};

const TD = `${TD_BASE} align-top`;

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

  const rows = report.rows.filter(FILTERS[filter]);
  const noForecast = s.forecastCount === 0;
  const aboveForecast = !noForecast && s.aboveForecastTotal > 0;

  // The fourth tile: the gap to the forecast (forecast − everything invoiced, unplanned included).
  let gapSub: string | undefined;
  if (noForecast) gapSub = "No forecast set for this month";
  else if (s.notInvoicedCount > 0)
    gapSub = `${plural(s.notInvoicedCount, "forecast job")} ${report.isCurrentMonth ? "not yet invoiced" : "not invoiced"} (${formatCurrency(s.notInvoicedTotal)})`;
  else gapSub = "All forecast jobs invoiced";
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
        <StatTile
          label="Forecast"
          value={formatCurrency(s.forecastTotal)}
          sub={`${plural(s.forecastCount, "job")}${
            Math.round(s.latestForecastTotal) !== Math.round(s.forecastTotal) ? ` · latest ${formatCurrency(s.latestForecastTotal)}` : ""
          }`}
        />
        <StatTile
          label="Invoiced"
          value={formatCurrency(s.invoicedTotal)}
          sub={`${plural(s.invoicedCount, "job")}${s.unplannedCount ? ` · incl. ${formatCurrency(s.unplannedTotal)} unplanned` : ""}`}
        />
        <StatTile label="Invoiced vs forecast" value={s.achievedPercent === null ? "—" : `${s.achievedPercent}%`}>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={cn("h-full rounded-full", (s.achievedPercent ?? 0) >= 100 ? "bg-success" : "bg-yellow")}
              style={{ width: `${Math.min(100, s.achievedPercent ?? 0)}%` }}
            />
          </div>
        </StatTile>
        <StatTile
          label={aboveForecast ? "Above forecast" : report.isCurrentMonth ? "Still to invoice" : "Short of forecast"}
          value={noForecast ? "—" : formatCurrency(aboveForecast ? s.aboveForecastTotal : s.remainingTotal)}
          sub={gapSub}
          tone={aboveForecast ? "good" : !report.isCurrentMonth && s.remainingTotal > 0 ? "critical" : "default"}
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
                  {formatCurrency(c.amount)} <span className="text-gray-500">· {plural(c.count, "job")}</span>
                </span>
              </div>
            ))}
          </div>
          {report.noWo.count > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <AlertTriangle className="size-4 text-yellow" />
              {plural(report.noWo.count, "job")} here ({formatCurrency(report.noWo.amount)}) still had no WO number.
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
            <thead className={STICKY_THEAD}>
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
                <EmptyRow cols={6}>
                    {report.rows.length === 0 ? `Nothing was forecast or invoiced in ${label}.` : "No jobs in this view."}
                </EmptyRow>
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
        <TextField
          multiline
          hideLabel
          label={`Comment for ${row.referenceNumber}`}
          autoFocus
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Customer asked to invoice in January"
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
            <IconButton size="sm" label="Edit comment" onClick={() => setEditing(true)}>
              <Pencil />
            </IconButton>
          )}
        </p>
      </div>
    );
  }

  return canEdit ? (
    <Button size="sm" variant="ghost" icon={<MessageSquarePlus className="size-4" />} onClick={() => setEditing(true)}>
      Add comment
    </Button>
  ) : (
    <span className="text-xs text-gray-400">—</span>
  );
}
