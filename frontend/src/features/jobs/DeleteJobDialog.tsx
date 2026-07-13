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
import { Job } from "../../types";
import { useDeleteJob } from "../../api/jobs";

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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Job</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          Delete job <strong>{job.referenceNumber}</strong> ({job.customer})? This permanently removes the job
          and all associated quotation, repair, dispatch, invoice, and audit history. This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleteJob.isPending}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteJob.isPending}>
          {deleteJob.isPending ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
