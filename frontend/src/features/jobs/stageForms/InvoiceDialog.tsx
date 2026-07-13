import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";
import { Job } from "../../../types";
import { toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";

interface FormValues {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number | "";
  closingDate: string;
  comments: string;
  delayReason: string;
}

export function InvoiceDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "invoice", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      invoiceNumber: job.invoice?.invoiceNumber ?? "",
      invoiceDate: toDateInputValue(job.invoice?.invoiceDate),
      invoiceAmount: job.invoice?.invoiceAmount ? Number(job.invoice.invoiceAmount) : "",
      closingDate: toDateInputValue(job.invoice?.closingDate),
      comments: job.invoice?.comments ?? "",
      delayReason: job.invoice?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = { ...values };
    if (payload.invoiceAmount === "") delete payload.invoiceAmount;
    else payload.invoiceAmount = Number(values.invoiceAmount);
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") delete payload[key];
    }
    submit(payload);
  }

  const dispatchNotDone = !job.dispatch?.dispatchDate;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invoicing Stage — {job.referenceNumber}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {dispatchNotDone && (
            <Grid item xs={12}>
              <Alert severity="warning">This job has not been dispatched yet — invoicing cannot be saved until it is.</Alert>
            </Grid>
          )}
          {error && (
            <Grid item xs={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Controller
              name="invoiceNumber"
              control={control}
              render={({ field }) => <TextField {...field} label="Invoice Number" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="invoiceDate"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" label="Invoice Date" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="invoiceAmount"
              control={control}
              render={({ field }) => <TextField {...field} type="number" label="Invoice Amount" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="closingDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Closing Date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Defaults to the invoice date if left blank"
                />
              )}
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
                      ? "Required: invoicing has exceeded the 7-day SLA target"
                      : "Only required if the invoicing SLA has been exceeded"
                  }
                />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={submitting || dispatchNotDone}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
