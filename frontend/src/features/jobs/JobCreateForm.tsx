import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useCreateJob, CreateJobInput } from "../../api/jobs";
import { JOB_TYPE_LABELS, PRIORITY_LABELS } from "../../constants";
import { addBusinessDays } from "../../utils/date";
import { Alert, Button, Card, PageHeader, TextField } from "../../components/ui";

const TODAY = new Date().toISOString().slice(0, 10);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-gray-100 pt-5 first:border-t-0 first:pt-0 dark:border-gray-800">
      <legend className="sr-only">{title}</legend>
      <p className="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">{title}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">{children}</div>
    </fieldset>
  );
}

export function JobCreateForm() {
  const navigate = useNavigate();
  const createJob = useCreateJob();
  const [serverError, setServerError] = useState<string | null>(null);

  const [jobCreatedDateTouched, setJobCreatedDateTouched] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateJobInput>({
    defaultValues: {
      referenceNumber: "",
      description: "",
      customer: "",
      serialNumber: "",
      partNumber: "",
      machineNumber: "",
      machineSerialNumber: "",
      customerRef: "",
      customerAccount: "",
      dateReceived: "",
      woNumber: "",
      jobType: "CUSTOMER_REPAIR",
      poValue: 0,
      poNumber: "",
      priority: "MEDIUM",
      jobCreatedDate: TODAY,
      comments: "",
    },
  });

  const dateReceivedValue = useWatch({ control, name: "dateReceived" });

  // Open Date defaults to 3 business days after the Receiving Date, until the
  // user directly edits the Job Opening field.
  useEffect(() => {
    if (jobCreatedDateTouched || !dateReceivedValue) return;
    setValue("jobCreatedDate", addBusinessDays(dateReceivedValue, 3));
  }, [dateReceivedValue, jobCreatedDateTouched, setValue]);

  async function onSubmit(values: CreateJobInput) {
    setServerError(null);
    try {
      const job = await createJob.mutateAsync({
        ...values,
        poValue: Number(values.poValue),
        woNumber: values.woNumber?.trim() || undefined,
        poNumber: values.poNumber?.trim() || undefined,
        partNumber: values.partNumber?.trim() || undefined,
        machineNumber: values.machineNumber?.trim() || undefined,
        machineSerialNumber: values.machineSerialNumber?.trim() || undefined,
        customerRef: values.customerRef?.trim() || undefined,
        customerAccount: values.customerAccount?.trim() || undefined,
        dateReceived: values.dateReceived?.trim() || undefined,
      });
      navigate(`/jobs/${job.id}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.error ?? "Failed to create job");
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Create New Job" subtitle="Fields marked * are required" />
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6">
          {serverError && <Alert severity="error">{serverError}</Alert>}

          <Section title="Customer & job">
            <Controller
              name="referenceNumber"
              control={control}
              rules={{ required: "Reference number is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-3"
                  label="Reference/Div"
                  required
                  error={!!errors.referenceNumber}
                  helperText={errors.referenceNumber?.message}
                />
              )}
            />
            <Controller
              name="customer"
              control={control}
              rules={{ required: "Customer is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-3"
                  label="Customer"
                  required
                  error={!!errors.customer}
                  helperText={errors.customer?.message}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              rules={{ required: "Job description is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-6"
                  label="Description"
                  multiline
                  required
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              )}
            />
            <Controller
              name="customerRef"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-3" label="Customer Ref" />}
            />
            <Controller
              name="customerAccount"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-3" label="Customer Acc" />}
            />
          </Section>

          <Section title="Equipment">
            <Controller
              name="serialNumber"
              control={control}
              rules={{ required: "Serial number is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-3"
                  label="Serial Nr"
                  required
                  error={!!errors.serialNumber}
                  helperText={errors.serialNumber?.message}
                />
              )}
            />
            <Controller
              name="partNumber"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-3" label="Part Nr" />}
            />
            <Controller
              name="machineNumber"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-3" label="Machine Nr" />}
            />
            <Controller
              name="machineSerialNumber"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-3" label="Machine Serial Nr" />}
            />
          </Section>

          <Section title="Classification & value">
            <Controller
              name="jobType"
              control={control}
              render={({ field }) => (
                <TextField {...field} select className="sm:col-span-2" label="Service Type">
                  {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <TextField {...field} select className="sm:col-span-2" label="Priority">
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="poValue"
              control={control}
              rules={{ required: true, min: 0 }}
              render={({ field }) => (
                <TextField {...field} className="sm:col-span-2" type="number" min={0} label="Order Value" required />
              )}
            />
            <Controller
              name="woNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-3"
                  label="WO Number"
                  helperText="Leave blank if not yet issued — can be added later from the job's detail page."
                />
              )}
            />
            <Controller
              name="poNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-3"
                  label="PO Number"
                  helperText="Leave blank if not yet issued — can be added later."
                />
              )}
            />
          </Section>

          <Section title="Dates & notes">
            <Controller
              name="dateReceived"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-3" type="date" label="Date Received" />}
            />
            <Controller
              name="jobCreatedDate"
              control={control}
              rules={{ required: "Job created date is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  className="sm:col-span-3"
                  onChange={(e) => {
                    setJobCreatedDateTouched(true);
                    field.onChange(e);
                  }}
                  type="date"
                  label="Job Opening"
                  required
                  helperText="Defaults to 3 business days after Date Received"
                />
              )}
            />
            <Controller
              name="comments"
              control={control}
              render={({ field }) => <TextField {...field} className="sm:col-span-6" label="Comment" multiline />}
            />
          </Section>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createJob.isPending}>
              {createJob.isPending ? "Creating…" : "Create Job"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
