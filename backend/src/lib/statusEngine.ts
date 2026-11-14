import { Dispatch, Invoice, Job, Quotation, Repair } from "@prisma/client";
import { daysBetween, dispatchSla, invoiceSla, poSla, quotationSla, repairSla, SlaResult } from "./sla";

export type StageName =
  | "QUOTATION"
  | "AWAITING_PO"
  | "REPAIR"
  | "DISPATCH"
  | "INVOICING"
  | "CLOSED";

export type StageStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";

export interface StageComputed {
  name: Exclude<StageName, "CLOSED">;
  status: StageStatus;
  sla: SlaResult;
}

export interface JobWithRelations extends Job {
  quotation: Quotation | null;
  repair: Repair | null;
  dispatch: Dispatch | null;
  invoice: Invoice | null;
}

export interface DerivedJobStatus {
  currentStage: StageName;
  currentStatus: StageStatus | "CLOSED";
  daysInCurrentStage: number | null;
  totalJobAge: number;
  slaCompliant: boolean;
  stages: StageComputed[];
  isClosed: boolean;
  /** Closed with no invoice (internal job). */
  closedWithoutInvoice: boolean;
}

function computeStageStatus(started: boolean, completed: boolean, sla: SlaResult): StageStatus {
  if (!started) return "NOT_STARTED";
  if (completed) return "COMPLETED";
  return sla.status === "RED" ? "DELAYED" : "IN_PROGRESS";
}

/**
 * Derives a job's stage/status from its dates. `asOf` (default: now) is the "today" used for stages
 * still in progress — the dashboard passes a month-end date, together with a copy of the job whose
 * later dates are hidden (see jobAsOf in lib/asOf.ts), to reconstruct the status at that point.
 */
export function deriveJobStatus(job: JobWithRelations, asOf: Date = new Date()): DerivedJobStatus {
  const { quotation, repair, dispatch, invoice } = job;

  const quotationSlaResult = quotationSla(job.jobCreatedDate, quotation?.epirocQuotationDate, asOf);
  const quotationCompleted = Boolean(quotation?.epirocQuotationDate);
  const quotationStage: StageComputed = {
    name: "QUOTATION",
    status: computeStageStatus(true, quotationCompleted, quotationSlaResult),
    sla: quotationSlaResult,
  };

  const poSlaResult = poSla(quotation?.epirocQuotationDate, repair?.purchaseOrderDate, asOf);
  const poCompleted = Boolean(repair?.purchaseOrderDate);
  const awaitingPoStage: StageComputed = {
    name: "AWAITING_PO",
    status: computeStageStatus(quotationCompleted, poCompleted, poSlaResult),
    sla: poSlaResult,
  };

  const repairSlaResult = repairSla(repair?.purchaseOrderDate, repair?.repairCompletionDate, asOf);
  const repairCompleted = Boolean(repair?.repairCompletionDate);
  const repairStage: StageComputed = {
    name: "REPAIR",
    status: computeStageStatus(poCompleted, repairCompleted, repairSlaResult),
    sla: repairSlaResult,
  };

  const dispatchSlaResult = dispatchSla(repair?.repairCompletionDate, dispatch?.dispatchDate, asOf);
  const dispatchCompleted = Boolean(dispatch?.dispatchDate);
  const dispatchStage: StageComputed = {
    name: "DISPATCH",
    status: computeStageStatus(repairCompleted, dispatchCompleted, dispatchSlaResult),
    sla: dispatchSlaResult,
  };

  // Internal jobs can be closed with no invoice: the closing date then completes the invoicing stage.
  const closedWithoutInvoice = Boolean(invoice?.closedWithoutInvoice && invoice?.closingDate && !invoice?.invoiceDate);
  const invoiceDoneDate = invoice?.invoiceDate ?? (closedWithoutInvoice ? invoice?.closingDate : null);
  const invoiceSlaResult = invoiceSla(dispatch?.dispatchDate, invoiceDoneDate, asOf);
  const invoiceCompleted = Boolean(invoiceDoneDate);
  const invoicingStage: StageComputed = {
    name: "INVOICING",
    status: computeStageStatus(dispatchCompleted, invoiceCompleted, invoiceSlaResult),
    sla: invoiceSlaResult,
  };

  const stages = [quotationStage, awaitingPoStage, repairStage, dispatchStage, invoicingStage];

  const isClosed = invoiceCompleted;
  const firstIncomplete = stages.find((s) => s.status !== "COMPLETED");

  const currentStage: StageName = isClosed ? "CLOSED" : firstIncomplete?.name ?? "CLOSED";
  const currentStatus: StageStatus | "CLOSED" = isClosed
    ? "CLOSED"
    : firstIncomplete?.status ?? "CLOSED";

  const currentStageComputed = stages.find((s) => s.name === currentStage);
  const daysInCurrentStage = isClosed ? null : currentStageComputed?.sla.days ?? null;

  const endDate = invoice?.closingDate ?? invoice?.invoiceDate ?? asOf;
  const totalJobAge = daysBetween(job.jobCreatedDate, endDate);

  const slaCompliant = stages.every((s) => s.sla.status !== "RED");

  return {
    currentStage,
    currentStatus,
    daysInCurrentStage,
    totalJobAge,
    slaCompliant,
    stages,
    isClosed,
    closedWithoutInvoice,
  };
}
