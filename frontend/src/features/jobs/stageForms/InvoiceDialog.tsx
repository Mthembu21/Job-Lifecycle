import { Controller, useForm } from "react-hook-form";
import { Job } from "../../../types";
import { toDateInputValue } from "../../../utils/date";
import { formatCurrency } from "../../../utils/currency";
import { defaultForecastAmount } from "../../../utils/forecast";
import { isNonInvoicedJobType } from "../../../utils/jobTypes";
import { JOB_TYPE_LABELS } from "../../../constants";
import { useStageSubmit } from "../useStageSubmit";
import { Alert, TextField } from "../../../components/ui";
import { FormDialog } from "../../../components/FormDialog";
import { DelayReasonField, toStagePayload } from "./stageFormFields";

interface FormValues {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number | "";
  plannedClosingDate: string;
  closingDate: string;
  comments: string;
  delayReason: string;
}

/**
 * Last stage of the lifecycle. Customer jobs are invoiced (and close on the invoice date);
 * internal and warranty jobs are never invoiced, so the same step just closes them.
 */
export function InvoiceDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "invoice", onClose);
  const noInvoice = isNonInvoicedJobType(job.jobType);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      invoiceNumber: job.invoice?.invoiceNumber ?? "",
      invoiceDate: toDateInputValue(job.invoice?.invoiceDate),
      invoiceAmount: job.invoice?.invoiceAmount ? Number(job.invoice.invoiceAmount) : "",
      plannedClosingDate: toDateInputValue(job.invoice?.plannedClosingDate),
      closingDate: toDateInputValue(job.invoice?.closingDate),
      comments: job.invoice?.comments ?? "",
      delayReason: job.invoice?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    // Internal / warranty jobs send no invoice details — the closing date closes the job.
    const omit = noInvoice ? ["invoiceNumber", "invoiceDate", "invoiceAmount"] : [];
    submit(toStagePayload(values, { numbers: ["invoiceAmount"], omit }));
  }

  const dispatchNotDone = !job.dispatch?.dispatchDate;
  const value = defaultForecastAmount(job);
  const typeLabel = JOB_TYPE_LABELS[job.jobType];

  return (
    <FormDialog
      title={`${noInvoice ? "Close Job" : "Invoicing Stage"} — ${job.referenceNumber}`}
      error={error}
      warning={
        dispatchNotDone
          ? `This job has not been dispatched yet — it can't be ${noInvoice ? "closed" : "invoiced"} until it is.`
          : null
      }
      submitting={submitting}
      saveDisabled={dispatchNotDone}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      {noInvoice && (
        <Alert severity="info" className="sm:col-span-2">
          {typeLabel} jobs aren't invoiced to the customer. Enter the closing date to close the job — it's counted on the
          dashboard as "Closed without invoice" at its PO value{value > 0 ? ` (${formatCurrency(value)})` : ""}. If this
          job should be invoiced, change its Service Type on the job page.
        </Alert>
      )}
      {!noInvoice && (
        <>
          <Controller
            name="invoiceNumber"
            control={control}
            render={({ field }) => <TextField {...field} label="Invoice Number" />}
          />
          <Controller
            name="invoiceDate"
            control={control}
            render={({ field }) => <TextField {...field} type="date" label="Invoice Date" />}
          />
          <Controller
            name="invoiceAmount"
            control={control}
            render={({ field }) => <TextField {...field} type="number" label="Invoice Amount" />}
          />
        </>
      )}
      <Controller
        name="plannedClosingDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Planned Job Closing" />}
      />
      <Controller
        name="closingDate"
        control={control}
        rules={{ required: noInvoice ? "Enter the date the job was closed" : false }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            type="date"
            label={noInvoice ? "Closing Date" : "Actual Job Closing"}
            required={noInvoice}
            error={!!fieldState.error}
            helperText={fieldState.error?.message ?? (noInvoice ? "The job closes on this date" : "Defaults to the invoice date if left blank")}
          />
        )}
      />
      <Controller
        name="comments"
        control={control}
        render={({ field }) => <TextField {...field} label="Remark(s)" multiline className="sm:col-span-2" />}
      />
      <DelayReasonField
        control={control}
        name="delayReason"
        required={requireDelayReason}
        requiredText={`Required: ${noInvoice ? "closing" : "invoicing"} has exceeded the 7-day SLA target`}
        optionalText={`Only required if ${noInvoice ? "closing" : "invoicing"} takes longer than 7 days after dispatch`}
      />
    </FormDialog>
  );
}
