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
}

function computeStageStatus(started: boolean, completed: boolean, sla: SlaResult): StageStatus {
  if (!started) return "NOT_STARTED";
  if (completed) return "COMPLETED";
  return sla.status === "RED" ? "DELAYED" : "IN_PROGRESS";
}

export function deriveJobStatus(job: JobWithRelations): DerivedJobStatus {
  const { quotation, repair, dispatch, invoice } = job;

  const quotationSlaResult = quotationSla(job.jobCreatedDate, quotation?.epirocQuotationDate);
  const quotationCompleted = Boolean(quotation?.epirocQuotationDate);
  const quotationStage: StageComputed = {
    name: "QUOTATION",
    status: computeStageStatus(true, quotationCompleted, quotationSlaResult),
    sla: quotationSlaResult,
  };

  const poSlaResult = poSla(quotation?.epirocQuotationDate, repair?.purchaseOrderDate);
  const poCompleted = Boolean(repair?.purchaseOrderDate);
  const awaitingPoStage: StageComputed = {
    name: "AWAITING_PO",
    status: computeStageStatus(quotationCompleted, poCompleted, poSlaResult),
    sla: poSlaResult,
  };

  const repairSlaResult = repairSla(repair?.purchaseOrderDate, repair?.repairCompletionDate);
  const repairCompleted = Boolean(repair?.repairCompletionDate);
  const repairStage: StageComputed = {
    name: "REPAIR",
    status: computeStageStatus(poCompleted, repairCompleted, repairSlaResult),
    sla: repairSlaResult,
  };

  const dispatchSlaResult = dispatchSla(repair?.repairCompletionDate, dispatch?.dispatchDate);
  const dispatchCompleted = Boolean(dispatch?.dispatchDate);
  const dispatchStage: StageComputed = {
    name: "DISPATCH",
    status: computeStageStatus(repairCompleted, dispatchCompleted, dispatchSlaResult),
    sla: dispatchSlaResult,
  };

  const invoiceSlaResult = invoiceSla(dispatch?.dispatchDate, invoice?.invoiceDate);
  const invoiceCompleted = Boolean(invoice?.invoiceDate);
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

  const endDate = invoice?.closingDate ?? invoice?.invoiceDate ?? new Date();
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
  };
}
