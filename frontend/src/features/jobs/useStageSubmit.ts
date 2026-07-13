import { useState } from "react";
import { StageKey, useUpdateStage } from "../../api/jobs";

/**
 * The backend is the single source of truth for whether a stage has breached its SLA
 * (it recomputes days-elapsed server-side). So we submit optimistically, and only if the
 * server rejects with "delay reason required" do we surface that field as mandatory and
 * let the user resubmit — avoids duplicating SLA date math on the client.
 */
export function useStageSubmit(jobId: string, stage: StageKey, onSuccess: () => void) {
  const mutation = useUpdateStage(jobId, stage);
  const [error, setError] = useState<string | null>(null);
  const [requireDelayReason, setRequireDelayReason] = useState(false);

  async function submit(values: Record<string, unknown>) {
    setError(null);
    try {
      await mutation.mutateAsync(values);
      setRequireDelayReason(false);
      onSuccess();
    } catch (err: any) {
      const message = err?.response?.data?.error ?? "Failed to save changes";
      setError(message);
      if (err?.response?.status === 400 && /delay reason/i.test(message)) {
        setRequireDelayReason(true);
      }
    }
  }

  return { submit, error, requireDelayReason, submitting: mutation.isPending };
}
