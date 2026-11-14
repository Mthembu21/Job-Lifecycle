import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";
import { Job } from "../../../types";
import { addBusinessDays, toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";

interface FormValues {
  plannedDisassemblyDate: string;
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
      // Defaults to 3 business days after the job was opened, until set explicitly.
      plannedDisassemblyDate:
        toDateInputValue(job.quotation?.plannedDisassemblyDate) ||
        addBusinessDays(toDateInputValue(job.jobCreatedDate), 3),
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
              name="plannedDisassemblyDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Planned Disassembly"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText={
                    !job.quotation?.plannedDisassemblyDate
                      ? "Defaults to 3 business days after Job Opening"
                      : undefined
                  }
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="evaluationDate"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" label="Actual Disassembly" fullWidth InputLabelProps={{ shrink: true }} />
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
                  label="Date Quoted"
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
              render={({ field }) => <TextField {...field} label="MCO Nr" fullWidth />}
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
