import { useState } from "react";
import { Job, JobType } from "../../types";
import { useUpdateJob } from "../../api/jobs";
import { JOB_TYPE_LABELS } from "../../constants";
import { isNonInvoicedJobType } from "../../utils/jobTypes";
import { Alert, Button, Dialog, TextField } from "../../components/ui";

/** Change a job's Service Type — it decides whether the job is invoiced or closed without invoice. */
export function JobTypeDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJob = useUpdateJob(job.id);
  const [jobType, setJobType] = useState<JobType>(job.jobType);
  const [error, setError] = useState<string | null>(null);

  const wasNonInvoiced = isNonInvoicedJobType(job.jobType);
  const willBeNonInvoiced = isNonInvoicedJobType(jobType);
  const switching = jobType !== job.jobType && wasNonInvoiced !== willBeNonInvoiced;

  async function save() {
    setError(null);
    if (jobType === job.jobType) return onClose();
    try {
      await updateJob.mutateAsync({ jobType });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to change the Service Type");
    }
  }

  return (
    <Dialog
      size="xs"
      title={`Service Type — ${job.referenceNumber}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={updateJob.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert severity="error">{error}</Alert>}
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
              : "This job will be invoiced: the last step becomes \"Invoice\". If it was already closed without an invoice, it reopens as awaiting invoice."}
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
