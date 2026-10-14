import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { Job } from "../../types";
import { useUpdateJob } from "../../api/jobs";
import { toDateInputValue } from "../../utils/date";

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
      min: job.dateReceived ? toDateInputValue(job.dateReceived) : undefined,
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
    } catch (err: any) {
      setError(err?.response?.data?.error ?? `Failed to save ${label}`);
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {label} — {job.referenceNumber}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}
        <Controller
          name="value"
          control={control}
          rules={{ required: `${label} is required` }}
          render={({ field: rhfField, fieldState }) => (
            <TextField
              {...rhfField}
              autoFocus
              label={label}
              fullWidth
              required
              {...(isDate
                ? {
                    type: "date",
                    InputLabelProps: { shrink: true },
                    inputProps: dateConstraints(field, job),
                  }
                : {})}
              sx={{ mt: 1 }}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={updateJob.isPending}>
          {updateJob.isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
