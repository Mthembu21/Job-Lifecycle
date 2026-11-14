import { useState } from "react";
import { CalendarClock, Pencil } from "lucide-react";
import { Job } from "../../types";
import { useUpdateJob } from "../../api/jobs";
import { useAuth } from "../../auth/AuthContext";
import { canEditForecast } from "../../auth/permissions";
import { formatCurrency } from "../../utils/currency";
import { JOB_TYPE_LABELS } from "../../constants";
import { defaultForecastAmount } from "../../utils/forecast";
import { hasPurchaseOrder, isNonInvoicedJobType } from "../../utils/jobTypes";
import { Button, Card, CardTitle, IconButton, TextField } from "../../components/ui";
import { FormDialog } from "../../components/FormDialog";
import { currentMonthKey, monthLabel, monthRange } from "../../utils/month";
import { apiErrorMessage } from "../../api/client";

/** Months offered: this month to 12 ahead (past months are backdated from the Forecast page). */
function monthOptions(selected: string | null): string[] {
  const months = monthRange(0, 12);
  return selected && !months.includes(selected) ? [selected, ...months] : months;
}

export function ForecastCard({ job }: { job: Job }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const notInvoiced = isNonInvoicedJobType(job.jobType);
  const noPo = !hasPurchaseOrder(job);
  const canEdit = canEditForecast(user?.role) && !job.status.isClosed && !notInvoiced && !noPo;
  const invoiced = Boolean(job.invoice?.invoiceDate);

  return (
    <Card className="p-5">
      <CardTitle
        action={
          canEdit && (
            <IconButton size="sm" label={job.forecastMonth ? "Edit forecast" : "Set forecast"} onClick={() => setEditing(true)}>
              <Pencil />
            </IconButton>
          )
        }
      >
        Invoice Forecast
      </CardTitle>
      {notInvoiced ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {JOB_TYPE_LABELS[job.jobType]} jobs aren't invoiced, so there's no invoice forecast.
        </p>
      ) : noPo && !job.forecastMonth ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No PO yet — the job can be forecast once its PO is recorded.</p>
      ) : job.forecastMonth ? (
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-yellow-soft dark:bg-yellow/10">
            <CalendarClock className="size-5 text-gray-700 dark:text-yellow" />
          </span>
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">{formatCurrency(job.forecastAmount ?? 0)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Expected to invoice in {monthLabel(job.forecastMonth)}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {invoiced ? "Invoiced — no forecast was set." : "No invoice forecast yet."}
          </p>
          {canEdit && (
            <Button size="sm" variant="primary" onClick={() => setEditing(true)}>
              Set forecast
            </Button>
          )}
        </div>
      )}
      {editing && <ForecastDialog job={job} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function ForecastDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJob = useUpdateJob(job.id);
  const [month, setMonth] = useState(job.forecastMonth ?? currentMonthKey());
  // Pre-filled from the PO value, else the quotation amount (blank when neither is known yet).
  const [amount, setAmount] = useState<number | "">(job.forecastAmount ?? (defaultForecastAmount(job) || ""));
  const [error, setError] = useState<string | null>(null);

  let amountHint: string | undefined;
  if (job.forecastAmount === null && amount !== "") {
    amountHint = Number(job.poValue) > 0 ? "Pre-filled from the PO value" : "Pre-filled from the quotation amount (no PO value yet)";
  }

  async function save(clear = false) {
    setError(null);
    if (!clear && (amount === "" || amount < 0)) {
      setError("Enter the amount you expect to invoice.");
      return;
    }
    try {
      await updateJob.mutateAsync(
        clear ? { forecastMonth: null, forecastAmount: null } : { forecastMonth: month, forecastAmount: Number(amount) }
      );
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save forecast"));
    }
  }

  return (
    <FormDialog
      size="xs"
      columns={1}
      title={`Invoice Forecast — ${job.referenceNumber}`}
      error={error}
      submitting={updateJob.isPending}
      onSave={() => save()}
      onClose={onClose}
      extraActions={
        job.forecastMonth && (
          <Button variant="ghost" className="mr-auto text-danger" onClick={() => save(true)} disabled={updateJob.isPending}>
            Remove forecast
          </Button>
        )
      }
    >
      <TextField select label="Expected invoice month" value={month} onChange={(e) => setMonth(e.target.value)} required>
        {monthOptions(job.forecastMonth).map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </TextField>
      <TextField
        label="Forecast amount (R)"
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
        required
        helperText={amountHint}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Each month's forecast is locked when the previous month ends — later changes show as the latest forecast but
        don't change what the month is measured against.
      </p>
    </FormDialog>
  );
}
