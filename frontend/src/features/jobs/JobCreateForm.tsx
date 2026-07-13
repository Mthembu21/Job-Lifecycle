import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCreateJob, CreateJobInput } from "../../api/jobs";
import { JOB_TYPE_LABELS, PRIORITY_LABELS } from "../../constants";

const TODAY = new Date().toISOString().slice(0, 10);

export function JobCreateForm() {
  const navigate = useNavigate();
  const createJob = useCreateJob();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateJobInput>({
    defaultValues: {
      referenceNumber: "",
      description: "",
      customer: "",
      serialNumber: "",
      partNumber: "",
      woNumber: "",
      jobType: "CUSTOMER_REPAIR",
      poValue: 0,
      poNumber: "",
      priority: "MEDIUM",
      jobCreatedDate: TODAY,
      comments: "",
    },
  });

  async function onSubmit(values: CreateJobInput) {
    setServerError(null);
    try {
      const job = await createJob.mutateAsync({
        ...values,
        poValue: Number(values.poValue),
        woNumber: values.woNumber?.trim() || undefined,
        poNumber: values.poNumber?.trim() || undefined,
        partNumber: values.partNumber?.trim() || undefined,
      });
      navigate(`/jobs/${job.id}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.error ?? "Failed to create job");
    }
  }

  return (
    <Box maxWidth={800}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Create New Job
      </Typography>
      <Card variant="outlined">
        <CardContent component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 3 }}>
          <Stack spacing={2}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="referenceNumber"
                  control={control}
                  rules={{ required: "Reference number is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Reference Number"
                      fullWidth
                      required
                      error={!!errors.referenceNumber}
                      helperText={errors.referenceNumber?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="customer"
                  control={control}
                  rules={{ required: "Customer is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Customer"
                      fullWidth
                      required
                      error={!!errors.customer}
                      helperText={errors.customer?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  rules={{ required: "Job description is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Job Description"
                      fullWidth
                      multiline
                      minRows={2}
                      required
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="serialNumber"
                  control={control}
                  rules={{ required: "Serial number is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Serial Number"
                      fullWidth
                      required
                      error={!!errors.serialNumber}
                      helperText={errors.serialNumber?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="partNumber"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Part Number" fullWidth />}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="woNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="WO Number"
                      fullWidth
                      helperText="Leave blank if not yet issued — can be added later from the job's detail page."
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Controller
                  name="jobType"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Job Type" fullWidth>
                      {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Priority" fullWidth>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Controller
                  name="poValue"
                  control={control}
                  rules={{ required: true, min: 0 }}
                  render={({ field }) => (
                    <TextField {...field} type="number" label="PO Value (Job Value)" fullWidth required />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Controller
                  name="poNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="PO Number"
                      fullWidth
                      helperText="Leave blank if not yet issued — can be added later."
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="jobCreatedDate"
                  control={control}
                  rules={{ required: "Job created date is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      label="Job Created Date"
                      fullWidth
                      required
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="comments"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Comments" fullWidth multiline minRows={2} />
                  )}
                />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={createJob.isPending}>
                {createJob.isPending ? "Creating..." : "Create Job"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
