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
import { useDeleteStage, StageKey } from "../../../api/jobs";

const STAGE_LABEL: Record<StageKey, string> = {
  quotation: "Quotation",
  repair: "Repair",
  dispatch: "Dispatch",
  invoice: "Invoice",
};

export function DeleteStageDialog({
  jobId,
  stage,
  onClose,
}: {
  jobId: string;
  stage: StageKey;
  onClose: () => void;
}) {
  const deleteStage = useDeleteStage(jobId, stage);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteStage.mutateAsync();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? `Failed to delete ${STAGE_LABEL[stage]}`);
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {STAGE_LABEL[stage]}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          Delete the {STAGE_LABEL[stage].toLowerCase()} details for this job? This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleteStage.isPending}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteStage.isPending}>
          {deleteStage.isPending ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
