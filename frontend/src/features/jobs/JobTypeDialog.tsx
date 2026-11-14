import { useState } from "react";
import { Job, JobType } from "../../types";
import { useUpdateJob } from "../../api/jobs";
import { apiErrorMessage } from "../../api/client";
import { JOB_TYPE_LABELS } from "../../constants";
import { isNonInvoicedJobType } from "../../utils/jobTypes";
import { Alert, TextField } from "../../components/ui";
import { FormDialog } from "../../components/FormDialog";

/** Change a job's Service Type — it decides whether the job is invoiced or closed without invoice. */
export function JobTypeDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJob = useUpdateJob(job.id);
  const [jobType, setJobType] = useState<JobType>(job.jobType);
  const [error, setError] = useState<string | null>(null);

  const willBeNonInvoiced = isNonInvoicedJobType(jobType);
  const switching = jobType !== job.jobType && isNonInvoicedJobType(job.jobType) !== willBeNonInvoiced;

  async function save() {
    setError(null);
    if (jobType === job.jobType) return onClose();
    try {
      await updateJob.mutateAsync({ jobType });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to change the Service Type"));
    }
  }

  return (
    <FormDialog
      size="xs"
      columns={1}
      title={`Service Type — ${job.referenceNumber}`}
      error={error}
      submitting={updateJob.isPending}
      onSave={save}
      onClose={onClose}
    >
      <TextField select label="Service Type" value={jobType} onChange={(e) => setJobType(e.target.value as JobType)}>
        {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </TextField>
      {switching && (
        <Alert severity="warning">
          {willBeNonInvoiced
            ? `${JOB_TYPE_LABELS[jobType]} jobs aren't invoiced: the last step becomes "Close Job", and any invoice forecast on this job is removed.`
            : 'This job will be invoiced: the last step becomes "Invoice". If it was already closed without an invoice, it reopens as awaiting invoice.'}
        </Alert>
      )}
    </FormDialog>
  );
}
