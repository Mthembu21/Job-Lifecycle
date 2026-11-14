import { Controller, useForm } from "react-hook-form";
import { Job } from "../../../types";
import { addBusinessDays, toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";
import { Checkbox, TextField } from "../../../components/ui";
import { FormDialog } from "../../../components/FormDialog";
import { DelayReasonField, toStagePayload } from "./stageFormFields";

interface FormValues {
  purchaseOrderNumber: string;
  purchaseOrderDate: string;
  plannedAssemblyDate: string;
  actualAssemblyDate: string;
  repairStartDate: string;
  repairCompletionDate: string;
  outworkRequired: string;
  supplierName: string;
  outworkDateSent: string;
  outworkDateReceived: string;
  waitingForGoAhead: boolean;
  technicianName: string;
  labourHours: number | "";
  partsCost: number | "";
  totalRepairCost: number | "";
  comments: string;
  delayReason: string;
}

function FormSection({ children }: { children: string }) {
  return (
    <p className="border-b border-gray-200 pb-1 text-xs font-bold tracking-wider text-gray-500 uppercase sm:col-span-2 dark:border-gray-700 dark:text-gray-400">
      {children}
    </p>
  );
}

export function RepairDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "repair", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      purchaseOrderNumber: job.repair?.purchaseOrderNumber ?? job.poNumber ?? "",
      purchaseOrderDate: toDateInputValue(job.repair?.purchaseOrderDate),
      // Defaults to 7 business days after the job was quoted, until set explicitly.
      plannedAssemblyDate:
        toDateInputValue(job.repair?.plannedAssemblyDate) ||
        addBusinessDays(toDateInputValue(job.quotation?.epirocQuotationDate), 7),
      actualAssemblyDate: toDateInputValue(job.repair?.actualAssemblyDate),
      repairStartDate: toDateInputValue(job.repair?.repairStartDate),
      repairCompletionDate: toDateInputValue(job.repair?.repairCompletionDate),
      outworkRequired: job.repair?.outworkRequired ?? "",
      supplierName: job.repair?.supplierName ?? "",
      outworkDateSent: toDateInputValue(job.repair?.outworkDateSent),
      outworkDateReceived: toDateInputValue(job.repair?.outworkDateReceived),
      waitingForGoAhead: job.repair?.waitingForGoAhead ?? false,
      technicianName: job.repair?.technicianName ?? "",
      labourHours: job.repair?.labourHours ? Number(job.repair.labourHours) : "",
      partsCost: job.repair?.partsCost ? Number(job.repair.partsCost) : "",
      totalRepairCost: job.repair?.totalRepairCost ? Number(job.repair.totalRepairCost) : "",
      comments: job.repair?.comments ?? "",
      delayReason: job.repair?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    submit(toStagePayload(values, { numbers: ["labourHours", "partsCost", "totalRepairCost"] }));
  }

  return (
    <FormDialog
      title={`Repair Stage — ${job.referenceNumber}`}
      error={error}
      submitting={submitting}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <FormSection>Go-ahead</FormSection>
      <Controller
        name="purchaseOrderNumber"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Purchase Order Number"
            helperText={
              !job.repair?.purchaseOrderNumber && job.poNumber ? "Pre-filled from the PO Number entered on the job" : undefined
            }
          />
        )}
      />
      <Controller
        name="purchaseOrderDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Go-Ahead To Repair" />}
      />
      <Controller
        name="waitingForGoAhead"
        control={control}
        render={({ field }) => (
          <Checkbox
            className="sm:col-span-2"
            label="Waiting For Go-Ahead"
            checked={field.value}
            onChange={(e) => field.onChange(e.target.checked)}
          />
        )}
      />

      <FormSection>Assembly &amp; repair</FormSection>
      <Controller
        name="plannedAssemblyDate"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            type="date"
            label="Planned Assembly"
            helperText={
              !job.repair?.plannedAssemblyDate && job.quotation?.epirocQuotationDate
                ? "Defaults to 7 business days after Date Quoted"
                : undefined
            }
          />
        )}
      />
      <Controller
        name="actualAssemblyDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Actual Assembly" />}
      />
      <Controller
        name="repairStartDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Start" />}
      />
      <Controller
        name="repairCompletionDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="End" />}
      />
      <Controller
        name="technicianName"
        control={control}
        render={({ field }) => <TextField {...field} label="Technician" className="sm:col-span-2" />}
      />

      <FormSection>Outwork</FormSection>
      <Controller name="outworkRequired" control={control} render={({ field }) => <TextField {...field} label="Outwork" />} />
      <Controller name="supplierName" control={control} render={({ field }) => <TextField {...field} label="Supplier Name" />} />
      <Controller
        name="outworkDateSent"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Date Sent" />}
      />
      <Controller
        name="outworkDateReceived"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Date Received (Supplier)" />}
      />

      <FormSection>Costs &amp; notes</FormSection>
      <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
        <Controller
          name="labourHours"
          control={control}
          render={({ field }) => <TextField {...field} type="number" label="Labour Hours" />}
        />
        <Controller
          name="partsCost"
          control={control}
          render={({ field }) => <TextField {...field} type="number" label="Parts Cost" />}
        />
        <Controller
          name="totalRepairCost"
          control={control}
          render={({ field }) => <TextField {...field} type="number" label="Total Repair Cost" />}
        />
      </div>
      <Controller
        name="comments"
        control={control}
        render={({ field }) => <TextField {...field} label="Comments" multiline className="sm:col-span-2" />}
      />
      <DelayReasonField
        control={control}
        name="delayReason"
        required={requireDelayReason}
        requiredText="Required: this repair has exceeded the 20-day SLA target"
        optionalText="Only required if the repair SLA has been exceeded"
      />
    </FormDialog>
  );
}
