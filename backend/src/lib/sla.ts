export type SlaColor = "GREEN" | "AMBER" | "RED" | "NOT_APPLICABLE";

export interface SlaResult {
  status: SlaColor;
  days: number | null;
  target: number;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Days elapsed between a start date and either the completion date (if set) or now. */
function elapsedDays(start: Date, end: Date | null | undefined): number {
  return daysBetween(start, end ?? new Date());
}

/** SLA Rule 1 — Quotation must be issued within 7 days of job creation. */
export function quotationSla(jobCreatedDate: Date, epirocQuotationDate?: Date | null): SlaResult {
  const days = elapsedDays(jobCreatedDate, epirocQuotationDate);
  const target = 7;
  let status: SlaColor;
  if (days > target) status = "RED";
  else if (days >= 6) status = "AMBER";
  else status = "GREEN";
  return { status, days, target };
}

/** SLA Rule 2 — Purchase Order should be received within 20 days of quotation. */
export function poSla(quotationDate: Date | null | undefined, poDate?: Date | null): SlaResult {
  if (!quotationDate) return { status: "NOT_APPLICABLE", days: null, target: 20 };
  const days = elapsedDays(quotationDate, poDate);
  const target = 20;
  return { status: days > target ? "RED" : "GREEN", days, target };
}

/** SLA Rule 3 — Repair should be completed within 20 days of the Purchase Order date. */
export function repairSla(poDate: Date | null | undefined, repairCompletionDate?: Date | null): SlaResult {
  if (!poDate) return { status: "NOT_APPLICABLE", days: null, target: 20 };
  const days = elapsedDays(poDate, repairCompletionDate);
  const target = 20;
  return { status: days > target ? "RED" : "GREEN", days, target };
}

/** SLA Rule 4 — Dispatch should occur within 2 days of repair completion. */
export function dispatchSla(
  repairCompletionDate: Date | null | undefined,
  dispatchDate?: Date | null
): SlaResult {
  if (!repairCompletionDate) return { status: "NOT_APPLICABLE", days: null, target: 2 };
  const days = elapsedDays(repairCompletionDate, dispatchDate);
  const target = 2;
  return { status: days > target ? "RED" : "GREEN", days, target };
}

/** SLA Rule 5 — Invoice should be issued within 7 days of dispatch. */
export function invoiceSla(dispatchDate: Date | null | undefined, invoiceDate?: Date | null): SlaResult {
  if (!dispatchDate) return { status: "NOT_APPLICABLE", days: null, target: 7 };
  const days = elapsedDays(dispatchDate, invoiceDate);
  const target = 7;
  return { status: days > target ? "RED" : "GREEN", days, target };
}

export { daysBetween };
