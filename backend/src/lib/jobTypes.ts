import { JobType } from "@prisma/client";

/**
 * Service types that are never invoiced to the customer. They follow the normal flow
 * (quotation → go-ahead → repair → dispatch) but the last step closes the job with no invoice.
 * Mirrored in frontend/src/utils/jobTypes.ts.
 */
export const NON_INVOICED_JOB_TYPES: readonly JobType[] = ["INTERNAL", "WARRANTY"];

export function isNonInvoicedJobType(jobType: JobType | string): boolean {
  return (NON_INVOICED_JOB_TYPES as readonly string[]).includes(jobType);
}

/**
 * A job has its PO once a PO number is recorded (on the job or in the repair stage) or the
 * go-ahead / PO date is set. Only jobs with a PO are forecast — without one, invoicing isn't certain.
 * Mirrored in frontend/src/utils/jobTypes.ts.
 */
export function hasPurchaseOrder(job: {
  poNumber?: string | null;
  repair?: { purchaseOrderNumber?: string | null; purchaseOrderDate?: Date | string | null } | null;
}): boolean {
  return Boolean(job.poNumber || job.repair?.purchaseOrderNumber || job.repair?.purchaseOrderDate);
}
