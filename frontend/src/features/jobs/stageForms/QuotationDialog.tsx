import { Controller, useForm } from "react-hook-form";
import { Job } from "../../../types";
import { addBusinessDays, toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";
import { TextField } from "../../../components/ui";
import { DelayReasonField, StageFormDialog } from "./StageFormDialog";

interface FormValues {
  plannedDisassemblyDate: string;
  evaluationDate: string;
  epirocQuotationDate: string;
  mcoNumber: string;
  quotationAmount: number | "";
  comments: string;
  delayReason: string;
}

export function QuotationDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "quotation", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      // Defaults to 3 business days after the job was opened, until set explicitly.
      plannedDisassemblyDate:
        toDateInputValue(job.quotation?.plannedDisassemblyDate) ||
        addBusinessDays(toDateInputValue(job.jobCreatedDate), 3),
      evaluationDate: toDateInputValue(job.quotation?.evaluationDate),
      epirocQuotationDate: toDateInputValue(job.quotation?.epirocQuotationDate),
      mcoNumber: job.quotation?.mcoNumber ?? "",
      quotationAmount: job.quotation?.quotationAmount ? Number(job.quotation.quotationAmount) : "",
      comments: job.quotation?.comments ?? "",
      delayReason: job.quotation?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = { ...values };
    if (!payload.quotationAmount && payload.quotationAmount !== 0) delete payload.quotationAmount;
    else payload.quotationAmount = Number(values.quotationAmount);
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") delete payload[key];
    }
    submit(payload);
  }

  return (
    <StageFormDialog
      title={`Quotation Stage — ${job.referenceNumber}`}
      error={error}
      submitting={submitting}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <Controller
        name="plannedDisassemblyDate"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            type="date"
            label="Planned Disassembly"
            helperText={!job.quotation?.plannedDisassemblyDate ? "Defaults to 3 business days after Job Opening" : undefined}
          />
        )}
      />
      <Controller
        name="evaluationDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Actual Disassembly" />}
      />
      <Controller
        name="epirocQuotationDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Date Quoted" />}
      />
      <Controller name="mcoNumber" control={control} render={({ field }) => <TextField {...field} label="MCO Nr" />} />
      <Controller
        name="quotationAmount"
        control={control}
        render={({ field }) => <TextField {...field} type="number" label="Quotation Amount" />}
      />
      <Controller
        name="comments"
        control={control}
        render={({ field }) => <TextField {...field} label="Comments" multiline className="sm:col-span-2" />}
      />
      <DelayReasonField
        control={control}
        name="delayReason"
        required={requireDelayReason}
        requiredText="Required: this quotation has exceeded the 7-day SLA target"
        optionalText="Only required if the quotation SLA has been exceeded"
      />
    </StageFormDialog>
  );
}
