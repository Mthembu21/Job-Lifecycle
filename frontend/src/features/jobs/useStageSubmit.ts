import { useState } from "react";
import { StageKey, useUpdateStage } from "../../api/jobs";
import { apiErrorMessage } from "../../api/client";
import { useDateWarnings } from "./useDateWarnings";

/**
 * The backend is the single source of truth for whether a stage has breached its SLA
 * (it recomputes days-elapsed server-side). So we submit optimistically, and only if the
 * server rejects with "delay reason required" do we surface that field as mandatory and
 * let the user resubmit — avoids duplicating SLA date math on the client.
 *
 * Dates work the same way: the server checks them against the job's flow and, if any look out
 * of order, the form lists them and the next save goes through ("Save anyway").
 */
export function useStageSubmit(jobId: string, stage: StageKey, onSuccess: () => void) {
  const mutation = useUpdateStage(jobId, stage);
  const dates = useDateWarnings();
  const [error, setError] = useState<string | null>(null);
  const [requireDelayReason, setRequireDelayReason] = useState(false);

  async function submit(values: Record<string, unknown>) {
    setError(null);
    try {
      await mutation.mutateAsync(dates.withConfirmation(values));
      setRequireDelayReason(false);
      onSuccess();
    } catch (err: any) {
      if (dates.handleError(err)) return;
      const message = apiErrorMessage(err, "Failed to save changes");
      setError(message);
      if (err?.response?.status === 400 && /delay reason/i.test(message)) {
        setRequireDelayReason(true);
      }
    }
  }

  return {
    submit,
    error,
    requireDelayReason,
    submitting: mutation.isPending,
    dateWarnings: dates.dateWarnings,
    saveLabel: dates.saveLabel,
  };
}
