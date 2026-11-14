import { JobType } from "../types";

/**
 * Service types never invoiced to the customer: their last step is "Close Job" (no invoice).
 * Mirrors backend/src/lib/jobTypes.ts.
 */
export const NON_INVOICED_JOB_TYPES: readonly JobType[] = ["INTERNAL", "WARRANTY"];

export function isNonInvoicedJobType(jobType: JobType): boolean {
  return NON_INVOICED_JOB_TYPES.includes(jobType);
}
