import { useState } from "react";
import { useBulkDeleteJobs } from "../../api/jobs";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";

export function BulkDeleteJobsDialog({
  jobIds,
  onClose,
  onDeleted,
}: {
  jobIds: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const bulkDelete = useBulkDeleteJobs();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await bulkDelete.mutateAsync(jobIds);
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to delete jobs");
    }
  }

  return (
    <ConfirmDeleteDialog
      title={`Delete ${jobIds.length} Jobs`}
      error={error}
      pending={bulkDelete.isPending}
      onConfirm={handleDelete}
      onClose={onClose}
    >
      Delete <strong>{jobIds.length}</strong> selected job{jobIds.length === 1 ? "" : "s"}? This permanently removes
      each job and all associated quotation, repair, dispatch, invoice, and audit history. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
