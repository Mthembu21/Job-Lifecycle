import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useBulkDeleteJobs } from "../../api/jobs";

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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {jobIds.length} Jobs</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          Delete <strong>{jobIds.length}</strong> selected job{jobIds.length === 1 ? "" : "s"}? This
          permanently removes each job and all associated quotation, repair, dispatch, invoice, and audit
          history. This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={bulkDelete.isPending}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleDelete} disabled={bulkDelete.isPending}>
          {bulkDelete.isPending ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
