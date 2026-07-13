import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";
import { Job } from "../../../types";
import { toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";

interface FormValues {
  evaluationDate: string;
  epirocQuotationDate: string;
  mcoNumber: string;
  quotationAmount: number | "";
  comments: string;
  delayReason: string;
}

export function QuotationDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "quotation", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      evaluationDate: toDateInputValue(job.quotation?.evaluationDate),
      epirocQuotationDate: toDateInputValue(job.quotation?.epirocQuotationDate),
      mcoNumber: job.quotation?.mcoNumber ?? "",
      quotationAmount: job.quotation?.quotationAmount ? Number(job.quotation.quotationAmount) : "",
      comments: job.quotation?.comments ?? "",
      delayReason: job.quotation?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = { ...values };
    if (!payload.quotationAmount && payload.quotationAmount !== 0) delete payload.quotationAmount;
    else payload.quotationAmount = Number(values.quotationAmount);
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") delete payload[key];
    }
    submit(payload);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Quotation Stage — {job.referenceNumber}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {error && (
            <Grid item xs={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Controller
              name="evaluationDate"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" label="Evaluation Date" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="epirocQuotationDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Epiroc Quotation Date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="mcoNumber"
              control={control}
              render={({ field }) => <TextField {...field} label="MCO Number" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="quotationAmount"
              control={control}
              render={({ field }) => <TextField {...field} type="number" label="Quotation Amount" fullWidth />}
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
                      ? "Required: this quotation has exceeded the 7-day SLA target"
                      : "Only required if the quotation SLA has been exceeded"
                  }
                />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
