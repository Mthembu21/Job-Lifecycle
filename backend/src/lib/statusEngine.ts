import { Dispatch, Invoice, Job, Quotation, Repair } from "@prisma/client";
import { daysBetween, dispatchSla, invoiceSla, poSla, quotationSla, repairSla, SlaResult } from "./sla";
import { isNonInvoicedJobType } from "./jobTypes";

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
  /** When the stage was completed (null while it isn't). */
  completedOn: Date | null;
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
  /** When the job closed (null while open). */
  closedOn: Date | null;
  /** Closed with no invoice — an internal or warranty job. */
  closedWithoutInvoice: boolean;
}

function computeStageStatus(started: boolean, completedOn: Date | null, sla: SlaResult): StageStatus {
  if (!started) return "NOT_STARTED";
  if (completedOn) return "COMPLETED";
  return sla.status === "RED" ? "DELAYED" : "IN_PROGRESS";
}

function stage(name: StageComputed["name"], started: boolean, completedOn: Date | null | undefined, sla: SlaResult): StageComputed {
  const done = completedOn ?? null;
  return { name, status: computeStageStatus(started, done, sla), sla, completedOn: done };
}

/**
 * Derives a job's stage/status from its dates. `asOf` (default: now) is the "today" used for stages
 * still in progress — the dashboard passes a month-end date, together with a copy of the job whose
 * later dates are hidden (see jobAsOf in lib/asOf.ts), to reconstruct the status at that point.
 */
export function deriveJobStatus(job: JobWithRelations, asOf: Date = new Date()): DerivedJobStatus {
  const { quotation, repair, dispatch, invoice } = job;

  const quoted = quotation?.epirocQuotationDate;
  const goAhead = repair?.purchaseOrderDate;
  const repaired = repair?.repairCompletionDate;
  const dispatched = dispatch?.dispatchDate;
  // Internal and warranty jobs are never invoiced: their closing date completes the last stage.
  const closedWithoutInvoice = isNonInvoicedJobType(job.jobType) && !!invoice?.closingDate && !invoice?.invoiceDate;
  const invoicingDone = invoice?.invoiceDate ?? (closedWithoutInvoice ? invoice?.closingDate : null);

  const stages = [
    stage("QUOTATION", true, quoted, quotationSla(job.jobCreatedDate, quoted, asOf)),
    stage("AWAITING_PO", !!quoted, goAhead, poSla(quoted, goAhead, asOf)),
    stage("REPAIR", !!goAhead, repaired, repairSla(goAhead, repaired, asOf)),
    stage("DISPATCH", !!repaired, dispatched, dispatchSla(repaired, dispatched, asOf)),
    stage("INVOICING", !!dispatched, invoicingDone, invoiceSla(dispatched, invoicingDone, asOf)),
  ];

  const isClosed = Boolean(invoicingDone);
  const closedOn = isClosed ? invoice?.closingDate ?? invoice?.invoiceDate ?? null : null;
  const firstIncomplete = stages.find((s) => s.status !== "COMPLETED");

  const currentStage: StageName = isClosed ? "CLOSED" : firstIncomplete?.name ?? "CLOSED";
  const currentStatus: StageStatus | "CLOSED" = isClosed ? "CLOSED" : firstIncomplete?.status ?? "CLOSED";
  const daysInCurrentStage = isClosed ? null : stages.find((s) => s.name === currentStage)?.sla.days ?? null;

  const endDate = invoice?.closingDate ?? invoice?.invoiceDate ?? asOf;

  return {
    currentStage,
    currentStatus,
    daysInCurrentStage,
    totalJobAge: daysBetween(job.jobCreatedDate, endDate),
    slaCompliant: stages.every((s) => s.sla.status !== "RED"),
    stages,
    isClosed,
    closedOn,
    closedWithoutInvoice,
  };
}
