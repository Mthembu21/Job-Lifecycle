import { prisma } from "./prisma";

interface WriteAuditLogInput {
  jobId: string;
  stage: string;
  action: string;
  summary: string;
  comment?: string | null;
  changedById: string;
}

export function writeAuditLog(input: WriteAuditLogInput) {
  return prisma.jobAuditLog.create({
    data: {
      jobId: input.jobId,
      stage: input.stage,
      action: input.action,
      summary: input.summary,
      comment: input.comment ?? null,
      changedById: input.changedById,
    },
  });
}

// Internal/technical fields, plus "comments" which the audit panel already shows
// on its own line — listing them in the diff would just be noise for the reader.
const DIFF_EXCLUDED_FIELDS = new Set(["id", "jobId", "createdAt", "updatedAt", "comments"]);

const FIELD_LABELS: Record<string, string> = {
  referenceNumber: "Reference Number",
  customer: "Customer",
  description: "Description",
  serialNumber: "Serial Number",
  partNumber: "Part Number",
  woNumber: "WO Number",
  woNumberSetAt: "WO Number Date",
  poNumber: "PO Number",
  jobType: "Job Type",
  poValue: "PO Value",
  priority: "Priority",
  jobCreatedDate: "Job Created Date",
  evaluationDate: "Evaluation Date",
  epirocQuotationDate: "Epiroc Quotation Date",
  mcoNumber: "MCO Number",
  quotationAmount: "Quotation Amount",
  delayReason: "Delay Reason",
  purchaseOrderNumber: "Purchase Order Number",
  purchaseOrderDate: "Purchase Order Date",
  repairStartDate: "Repair Start Date",
  repairCompletionDate: "Repair Completion Date",
  technicianName: "Technician",
  labourHours: "Labour Hours",
  partsCost: "Parts Cost",
  totalRepairCost: "Total Repair Cost",
  dispatchDate: "Dispatch Date",
  courier: "Courier",
  trackingNumber: "Tracking Number",
  invoiceNumber: "Invoice Number",
  invoiceDate: "Invoice Date",
  invoiceAmount: "Invoice Amount",
  closingDate: "Closing Date",
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "string" && ISO_DATE_RE.test(value)) return new Date(value).toLocaleDateString();
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/** Builds a human-readable summary of which fields changed, e.g. "MCO Number: — -> 66". */
export function diffSummary(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const changes: string[] = [];
  for (const key of Object.keys(after)) {
    if (DIFF_EXCLUDED_FIELDS.has(key) || key.endsWith("ById")) continue;
    const prevValue = before[key];
    const nextValue = after[key];
    const prevStr = (prevValue instanceof Date ? prevValue.toISOString() : prevValue) ?? null;
    const nextStr = (nextValue instanceof Date ? nextValue.toISOString() : nextValue) ?? null;
    if (prevStr !== nextStr && nextValue !== undefined) {
      changes.push(`${labelFor(key)}: ${formatValue(prevValue)} -> ${formatValue(nextValue)}`);
    }
  }
  return changes.length > 0 ? changes.join("; ") : "No field changes";
}
