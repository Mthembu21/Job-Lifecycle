import { useState } from "react";
import { Job } from "../../types";
import { useUpdateJob } from "../../api/jobs";
import { apiErrorMessage } from "../../api/client";
import { FormDialog } from "../../components/FormDialog";
import { CustomerSelect } from "../customers/CustomerSelect";

/** Moves a job to another customer from the customer list (recorded in the job's history). */
export function JobCustomerDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJob = useUpdateJob(job.id);
  const [customer, setCustomer] = useState(job.customer);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (customer === job.customer) return onClose();
    try {
      await updateJob.mutateAsync({ customer });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to change the customer"));
    }
  }

  return (
    <FormDialog
      size="xs"
      columns={1}
      title={`Customer — ${job.referenceNumber}`}
      error={error}
      submitting={updateJob.isPending}
      saveDisabled={!customer}
      onSave={save}
      onClose={onClose}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Choose the customer this job belongs to. To correct a customer's name on every job, rename it on the Customers
        page instead.
      </p>
      <CustomerSelect value={customer} onChange={setCustomer} required />
    </FormDialog>
  );
}
