export type Role = "STOREMAN" | "PLANNER" | "SUPERVISOR" | "ADMIN";

export type JobType =
  | "WARRANTY"
  | "CUSTOMER_REPAIR"
  | "INTERNAL"
  | "SERVICE"
  | "REBUILD"
  | "INSURANCE"
  | "OTHER";

export type Priority = "HIGH" | "MEDIUM" | "LOW";

export type SlaColor = "GREEN" | "AMBER" | "RED" | "NOT_APPLICABLE";

export interface SlaResult {
  status: SlaColor;
  days: number | null;
  target: number;
}

export type StageName = "QUOTATION" | "AWAITING_PO" | "REPAIR" | "DISPATCH" | "INVOICING" | "CLOSED";
export type StageStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";

export interface StageComputed {
  name: Exclude<StageName, "CLOSED">;
  status: StageStatus;
  sla: SlaResult;
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

export interface UserSummary {
  id: string;
  name: string;
  email?: string;
  role?: Role;
}

export interface Quotation {
  evaluationDate: string | null;
  epirocQuotationDate: string | null;
  mcoNumber: string | null;
  quotationAmount: number | null;
  quotedById: string | null;
  quotedBy: UserSummary | null;
  comments: string | null;
  delayReason: string | null;
}

export interface Repair {
  purchaseOrderNumber: string | null;
  purchaseOrderDate: string | null;
  repairStartDate: string | null;
  repairCompletionDate: string | null;
  technicianName: string | null;
  labourHours: number | null;
  partsCost: number | null;
  totalRepairCost: number | null;
  comments: string | null;
  delayReason: string | null;
}

export interface Dispatch {
  dispatchDate: string | null;
  courier: string | null;
  trackingNumber: string | null;
  dispatchedById: string | null;
  dispatchedBy: UserSummary | null;
  comments: string | null;
  delayReason: string | null;
}

export interface Invoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAmount: number | null;
  closingDate: string | null;
  comments: string | null;
  delayReason: string | null;
}

export interface Job {
  id: string;
  referenceNumber: string;
  description: string;
  customer: string;
  serialNumber: string;
  partNumber: string | null;
  woNumber: string | null;
  woNumberSetAt: string | null;
  poNumber: string | null;
  jobType: JobType;
  poValue: number;
  priority: Priority;
  jobCreatedDate: string;
  comments: string | null;
  createdBy: UserSummary | null;
  quotation: Quotation | null;
  repair: Repair | null;
  dispatch: Dispatch | null;
  invoice: Invoice | null;
  createdAt: string;
  updatedAt: string;
  status: DerivedJobStatus;
}

export interface AuditLogEntry {
  id: string;
  jobId: string;
  stage: string;
  action: string;
  summary: string;
  comment: string | null;
  changedAt: string;
  changedBy: UserSummary;
}
