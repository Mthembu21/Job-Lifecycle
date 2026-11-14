import { useBulkDeleteJobs } from "../../api/jobs";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { plural } from "../../utils/text";

export function BulkDeleteJobsDialog({
  jobIds,
  onClose,
  onDeleted,
}: {
  jobIds: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  return (
    <ConfirmDeleteDialog
      title={`Delete ${jobIds.length} Jobs`}
      mutation={useBulkDeleteJobs()}
      variables={jobIds}
      errorFallback="Failed to delete jobs"
      onDeleted={onDeleted}
      onClose={onClose}
    >
      Delete <strong>{plural(jobIds.length, "selected job")}</strong>? This permanently removes each job and all
      associated quotation, repair, dispatch, invoice, and audit history. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
