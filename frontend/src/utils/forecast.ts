import { Job } from "../types";

/** Default forecast amount: the PO value, or the quotation amount while there's no PO value yet. */
export function defaultForecastAmount(job: Job): number {
  const po = Number(job.poValue) || 0;
  if (po > 0) return po;
  return Number(job.quotation?.quotationAmount) || 0;
}
