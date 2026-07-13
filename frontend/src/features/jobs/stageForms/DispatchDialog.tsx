import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";
import { Job } from "../../../types";
import { toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";

interface FormValues {
  dispatchDate: string;
  courier: string;
  trackingNumber: string;
  comments: string;
  delayReason: string;
}

export function DispatchDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "dispatch", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      dispatchDate: toDateInputValue(job.dispatch?.dispatchDate),
      courier: job.dispatch?.courier ?? "",
      trackingNumber: job.dispatch?.trackingNumber ?? "",
      comments: job.dispatch?.comments ?? "",
      delayReason: job.dispatch?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = { ...values };
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") delete payload[key];
    }
    submit(payload);
  }

  const repairNotDone = !job.repair?.repairCompletionDate;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dispatch Stage — {job.referenceNumber}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {repairNotDone && (
            <Grid item xs={12}>
              <Alert severity="warning">Repair has not been marked complete yet — dispatch cannot be saved until it is.</Alert>
            </Grid>
          )}
          {error && (
            <Grid item xs={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Controller
              name="dispatchDate"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" label="Dispatch Date" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="courier"
              control={control}
              render={({ field }) => <TextField {...field} label="Courier" fullWidth />}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="trackingNumber"
              control={control}
              render={({ field }) => <TextField {...field} label="Tracking Number" fullWidth />}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="comments"
              control={control}
              render={({ field }) => <TextField {...field} label="Comments" fullWidth multiline minRows={2} />}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="delayReason"
              control={control}
              rules={{ required: requireDelayReason }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Delay Reason"
                  fullWidth
                  multiline
                  minRows={2}
                  required={requireDelayReason}
                  error={!!fieldState.error}
                  helperText={
                    requireDelayReason
                      ? "Required: dispatch has exceeded the 2-day SLA target"
                      : "Only required if the dispatch SLA has been exceeded"
                  }
                />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={submitting || repairNotDone}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
