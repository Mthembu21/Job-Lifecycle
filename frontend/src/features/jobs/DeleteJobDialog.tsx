import { Job } from "../../types";
import { useDeleteJob } from "../../api/jobs";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";

export function DeleteJobDialog({ job, onClose, onDeleted }: { job: Job; onClose: () => void; onDeleted?: () => void }) {
  return (
    <ConfirmDeleteDialog
      title="Delete Job"
      mutation={useDeleteJob()}
      variables={job.id}
      errorFallback="Failed to delete job"
      onDeleted={onDeleted}
      onClose={onClose}
    >
      Delete job <strong>{job.referenceNumber}</strong> ({job.customer})? This permanently removes the job and all
      associated quotation, repair, dispatch, invoice, and audit history. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
