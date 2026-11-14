import { StageName } from "./statusEngine";

/** Display labels shared by the dashboard, forecasting and reports. */
export const JOB_TYPE_LABELS: Record<string, string> = {
  WARRANTY: "Warranty",
  CUSTOMER_REPAIR: "Customer Repair",
  INTERNAL: "Internal",
  SERVICE: "Service",
  REBUILD: "Rebuild",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

export const STAGE_LABELS: Record<StageName, string> = {
  QUOTATION: "Quotation",
  AWAITING_PO: "Awaiting PO",
  REPAIR: "Repair",
  DISPATCH: "Dispatch",
  INVOICING: "Invoicing",
  CLOSED: "Closed",
};

export type SlaStage = Exclude<StageName, "CLOSED">;

export const STAGE_ORDER: StageName[] = ["QUOTATION", "AWAITING_PO", "REPAIR", "DISPATCH", "INVOICING", "CLOSED"];
export const SLA_STAGES: SlaStage[] = STAGE_ORDER.filter((s): s is SlaStage => s !== "CLOSED");

/** Numbers from Prisma/DTOs (possibly null/undefined) as plain numbers. */
export function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** A job's value when there's no invoice amount: PO value, else the quotation amount. */
export function jobValue(job: { poValue: unknown; quotation?: { quotationAmount?: number | null } | null }): number {
  return toNumber(job.poValue) || toNumber(job.quotation?.quotationAmount);
}
