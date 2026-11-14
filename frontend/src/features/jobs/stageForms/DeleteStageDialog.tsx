import { useDeleteStage, StageKey } from "../../../api/jobs";
import { ConfirmDeleteDialog } from "../../../components/ConfirmDeleteDialog";

const STAGE_LABEL: Record<StageKey, string> = {
  quotation: "Quotation",
  repair: "Repair",
  dispatch: "Dispatch",
  invoice: "Invoice",
};

export function DeleteStageDialog({ jobId, stage, onClose }: { jobId: string; stage: StageKey; onClose: () => void }) {
  return (
    <ConfirmDeleteDialog
      title={`Delete ${STAGE_LABEL[stage]}`}
      mutation={useDeleteStage(jobId, stage)}
      variables={undefined}
      errorFallback={`Failed to delete ${STAGE_LABEL[stage]}`}
      onClose={onClose}
    >
      Delete the {STAGE_LABEL[stage].toLowerCase()} details for this job? This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
