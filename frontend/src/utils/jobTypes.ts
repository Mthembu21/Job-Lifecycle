import { Job, JobType } from "../types";

/**
 * Service types never invoiced to the customer: their last step is "Close Job" (no invoice).
 * Mirrors backend/src/lib/jobTypes.ts.
 */
export const NON_INVOICED_JOB_TYPES: readonly JobType[] = ["INTERNAL", "WARRANTY"];

export function isNonInvoicedJobType(jobType: JobType): boolean {
  return NON_INVOICED_JOB_TYPES.includes(jobType);
}

/**
 * A job has its PO once a PO number is recorded (on the job or in the repair stage) or the
 * go-ahead / PO date is set. Only jobs with a PO are forecast. Mirrors backend/src/lib/jobTypes.ts.
 */
export function hasPurchaseOrder(job: Pick<Job, "poNumber" | "repair">): boolean {
  return Boolean(job.poNumber || job.repair?.purchaseOrderNumber || job.repair?.purchaseOrderDate);
}
