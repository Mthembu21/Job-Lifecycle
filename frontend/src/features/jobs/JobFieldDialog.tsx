import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Job } from "../../types";
import { useUpdateJob } from "../../api/jobs";
import { apiErrorMessage } from "../../api/client";
import { toDateInputValue } from "../../utils/date";
import { TextField } from "../../components/ui";
import { FormDialog } from "../../components/FormDialog";

export type JobEditableField = "woNumber" | "poNumber" | "woNumberSetAt" | "jobCreatedDate";

interface FormValues {
  value: string;
}

function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const DATE_FIELDS = new Set<JobEditableField>(["woNumberSetAt", "jobCreatedDate"]);

function dateConstraints(field: JobEditableField, job: Job): { min?: string; max?: string } {
  if (field === "woNumberSetAt") {
    return { min: toDateInputValue(job.jobCreatedDate), max: todayInputValue() };
  }
  if (field === "jobCreatedDate") {
    return {
      max: job.woNumberSetAt ? toDateInputValue(job.woNumberSetAt) : todayInputValue(),
    };
  }
  return {};
}

export function JobFieldDialog({
  job,
  field,
  label,
  onClose,
}: {
  job: Job;
  field: JobEditableField;
  label: string;
  onClose: () => void;
}) {
  const updateJob = useUpdateJob(job.id);
  const [error, setError] = useState<string | null>(null);
  const isDate = DATE_FIELDS.has(field);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { value: isDate ? toDateInputValue(job[field]) : job[field] ?? "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await updateJob.mutateAsync({ [field]: values.value.trim() });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to save ${label}`));
    }
  }

  return (
    <FormDialog
      size="xs"
      columns={1}
      title={`${label} — ${job.referenceNumber}`}
      error={error}
      submitting={updateJob.isPending}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <Controller
        name="value"
        control={control}
        rules={{ required: `${label} is required` }}
        render={({ field: rhfField, fieldState }) => (
          <TextField
            {...rhfField}
            autoFocus
            label={label}
            required
            {...(isDate ? { type: "date", ...dateConstraints(field, job) } : {})}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        )}
      />
    </FormDialog>
  );
}
