import { useState } from "react";
import { Job } from "../../types";
import { useDeleteJob } from "../../api/jobs";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";

export function DeleteJobDialog({
  job,
  onClose,
  onDeleted,
}: {
  job: Job;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const deleteJob = useDeleteJob();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteJob.mutateAsync(job.id);
      onDeleted ? onDeleted() : onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to delete job");
    }
  }

  return (
    <ConfirmDeleteDialog title="Delete Job" error={error} pending={deleteJob.isPending} onConfirm={handleDelete} onClose={onClose}>
      Delete job <strong>{job.referenceNumber}</strong> ({job.customer})? This permanently removes the job and all
      associated quotation, repair, dispatch, invoice, and audit history. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
