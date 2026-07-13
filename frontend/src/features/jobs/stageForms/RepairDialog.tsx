import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";
import { Job } from "../../../types";
import { toDateInputValue } from "../../../utils/date";
import { useStageSubmit } from "../useStageSubmit";

interface FormValues {
  purchaseOrderNumber: string;
  purchaseOrderDate: string;
  repairStartDate: string;
  repairCompletionDate: string;
  technicianName: string;
  labourHours: number | "";
  partsCost: number | "";
  totalRepairCost: number | "";
  comments: string;
  delayReason: string;
}

export function RepairDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { submit, error, requireDelayReason, submitting } = useStageSubmit(job.id, "repair", onClose);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      purchaseOrderNumber: job.repair?.purchaseOrderNumber ?? job.poNumber ?? "",
      purchaseOrderDate: toDateInputValue(job.repair?.purchaseOrderDate),
      repairStartDate: toDateInputValue(job.repair?.repairStartDate),
      repairCompletionDate: toDateInputValue(job.repair?.repairCompletionDate),
      technicianName: job.repair?.technicianName ?? "",
      labourHours: job.repair?.labourHours ? Number(job.repair.labourHours) : "",
      partsCost: job.repair?.partsCost ? Number(job.repair.partsCost) : "",
      totalRepairCost: job.repair?.totalRepairCost ? Number(job.repair.totalRepairCost) : "",
      comments: job.repair?.comments ?? "",
      delayReason: job.repair?.delayReason ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = { ...values };
    for (const key of ["labourHours", "partsCost", "totalRepairCost"]) {
      if (payload[key] === "") delete payload[key];
      else payload[key] = Number(payload[key]);
    }
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") delete payload[key];
    }
    submit(payload);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Repair Stage — {job.referenceNumber}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {error && (
            <Grid item xs={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Controller
              name="purchaseOrderNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Purchase Order Number"
                  fullWidth
                  helperText={
                    !job.repair?.purchaseOrderNumber && job.poNumber
                      ? "Pre-filled from the PO Number entered on the job"
                      : undefined
                  }
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="purchaseOrderDate"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" label="Purchase Order Date" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="repairStartDate"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" label="Repair Start Date" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="repairCompletionDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Repair Completion Date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="technicianName"
              control={control}
              render={({ field }) => <TextField {...field} label="Technician" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="labourHours"
              control={control}
              render={({ field }) => <TextField {...field} type="number" label="Labour Hours" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="partsCost"
              control={control}
              render={({ field }) => <TextField {...field} type="number" label="Parts Cost" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="totalRepairCost"
              control={control}
              render={({ field }) => <TextField {...field} type="number" label="Total Repair Cost" fullWidth />}
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
                      ? "Required: this repair has exceeded the 20-day SLA target"
                      : "Only required if the repair SLA has been exceeded"
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
