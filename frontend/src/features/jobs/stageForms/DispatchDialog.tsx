import { Controller, useForm } from "react-hook-form";
import { Job } from "../../../types";
import { toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";
import { TextField } from "../../../components/ui";
import { FormDialog } from "../../../components/FormDialog";
import { DelayReasonField, toStagePayload } from "./stageFormFields";

interface FormValues {
  dispatchRequestDate: string;
  dispatchDate: string;
  courier: string;
  trackingNumber: string;
  comments: string;
  delayReason: string;
}

export function DispatchDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "dispatch", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      dispatchRequestDate: toDateInputValue(job.dispatch?.dispatchRequestDate),
      dispatchDate: toDateInputValue(job.dispatch?.dispatchDate),
      courier: job.dispatch?.courier ?? "",
      trackingNumber: job.dispatch?.trackingNumber ?? "",
      comments: job.dispatch?.comments ?? "",
      delayReason: job.dispatch?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    submit(toStagePayload(values));
  }

  const repairNotDone = !job.repair?.repairCompletionDate;

  return (
    <FormDialog
      title={`Dispatch Stage — ${job.referenceNumber}`}
      error={error}
      warning={repairNotDone ? "Repair has not been marked complete yet — dispatch cannot be saved until it is." : null}
      submitting={submitting}
      saveDisabled={repairNotDone}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <Controller
        name="dispatchRequestDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Dispatch Request Date" />}
      />
      <Controller
        name="dispatchDate"
        control={control}
        render={({ field }) => <TextField {...field} type="date" label="Actual Dispatch Date" />}
      />
      <Controller name="courier" control={control} render={({ field }) => <TextField {...field} label="Courier" />} />
      <Controller
        name="trackingNumber"
        control={control}
        render={({ field }) => <TextField {...field} label="Tracking Number" />}
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
        requiredText="Required: dispatch has exceeded the 2-day SLA target"
        optionalText="Only required if the dispatch SLA has been exceeded"
      />
    </FormDialog>
  );
}
