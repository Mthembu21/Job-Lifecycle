import { JobType, Priority, Role, StageName, StageStatus } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  STOREMAN: "Storeman",
  PLANNER: "Planner",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  WARRANTY: "Warranty",
  CUSTOMER_REPAIR: "Customer Repair",
  INTERNAL: "Internal",
  SERVICE: "Service",
  REBUILD: "Rebuild",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const STAGE_LABELS: Record<StageName, string> = {
  QUOTATION: "Quotation",
  AWAITING_PO: "Awaiting PO",
  REPAIR: "Repair",
  DISPATCH: "Dispatch",
  INVOICING: "Invoicing",
  CLOSED: "Closed",
};

export const STAGE_STATUS_LABELS: Record<StageStatus | "CLOSED", string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
  CLOSED: "Closed",
};
