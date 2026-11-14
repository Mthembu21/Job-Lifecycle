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
