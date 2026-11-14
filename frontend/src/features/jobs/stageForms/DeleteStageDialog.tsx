import { useState } from "react";
import { useDeleteStage, StageKey } from "../../../api/jobs";
import { ConfirmDeleteDialog } from "../../../components/ConfirmDeleteDialog";

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
    <ConfirmDeleteDialog
      title={`Delete ${STAGE_LABEL[stage]}`}
      error={error}
      pending={deleteStage.isPending}
      onConfirm={handleDelete}
      onClose={onClose}
    >
      Delete the {STAGE_LABEL[stage].toLowerCase()} details for this job? This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
