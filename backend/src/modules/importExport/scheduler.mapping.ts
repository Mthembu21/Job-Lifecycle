import { JobType, Priority } from "@prisma/client";

export const SCHEDULER_SHEET_NAME = "SCHEDULER 2025";
/** In the original tracker, data starts on the 3rd row (group banner, then column headers). */
export const DATA_START_ROW = 2;

// 0-based column indices, matching the "SCHEDULER 2025" tab of the tracker workbook.
export const COL = {
  REFERENCE: 0,
  DESCRIPTION: 1,
  PART_NR: 2,
  SERIAL_NR: 3,
  MACHINE_NR: 4,
  MACHINE_SERIAL_NR: 5,
  CUSTOMER: 6,
  CUSTOMER_REF: 7,
  CUSTOMER_ACC: 8,
  SERVICE_TYPE: 9,
  MCO_NR: 10,
  DATE_RECEIVED: 11,
  JOB_OPENING: 12,
  PLANNED_DISASSEMBLY: 13,
  ACTUAL_DISASSEMBLY: 14,
  ASSESSMENT_DAYS: 15,
  DATE_QUOTED: 16,
  STRIP_QUOTE_DAYS: 17,
  GO_AHEAD_TO_REPAIR: 18,
  PLANNED_ASSEMBLY: 19,
  ACTUAL_ASSEMBLY: 20,
  ASSEMBLY_DAYS: 21,
  COMMENT: 22,
  START: 23,
  END: 24,
  OUTWORK: 25,
  SUPPLIER_NAME: 26,
  DATE_SENT: 27,
  DATE_RECEIVED_FROM_SUPPLIER: 28,
  WAITING_FOR_GO_AHEAD: 29,
  OUT_WORK: 30,
  ASSEMBLING_DAYS: 31,
  DISPATCH_REQUEST_DATE: 32,
  ACTUAL_DISPATCH_DATE: 33,
  PLANNED_JOB_CLOSING: 34,
  ACTUAL_JOB_CLOSING: 35,
  ORDER_VALUE: 36,
  REMARKS: 37,
  TOTAL_DAYS_WIP: 38,
  TOTAL_DAYS_COMP: 39,
  STATUS: 40,
  TURN_AROUND: 41,
} as const;

// Exact header text for each column above (the tracker's column-header row), used to rebuild the sheet on export.
export const HEADERS: string[] = [
  "REFERENCE/DIV:",
  "DESCRIPTION:",
  "PART NR:",
  "SERIAL NR:",
  "MACHINE NR:",
  "MACHINE SERIAL NR:",
  "CUSTOMER:",
  "CUSTOMER REF:",
  "CUSTOMER ACC:",
  "SERVICE TYPE:",
  "MCO NR:",
  "DATE RECEIVED:",
  "JOB OPENING:",
  "PLANNED DISASSEMBLY",
  "ACTUAL DISASSEMBLY",
  "DAYS",
  "DATE QUOTED:",
  "STRIP & QUOTE (Days)",
  "GO-AHEAD TO REPAIR:",
  "PLANNED ASSEMBLY",
  "ACTUAL ASSEMBLY",
  "DAYS",
  "COMMENT",
  "START:",
  "END:",
  "OUTWORK:",
  "SUPPLIER NAME:",
  "DATE SENT:",
  "DATE RECEIVED:",
  "WAITING FOR GO-AHEAD:",
  "OUT-WORK:",
  "ASSEMBLING: (Days)",
  "DISPATCH REQUEST DATE",
  "ACTUAL DISPATCH DATE:",
  "PLANNED JOB CLOSING:",
  "ACTUAL JOB CLOSING:",
  "ORDER VALUE:",
  "REMARK(S):",
  "TOTAL: (Days) WIP",
  "TOTAL:  (Days) COMP",
  "STATUS:",
  "TURN AROUND ",
];

export const GROUP_HEADERS: Array<{ col: number; label: string }> = [
  { col: COL.REFERENCE, label: "RECEIVING:" },
  { col: COL.JOB_OPENING, label: "ASSESMENT:" },
  { col: COL.GO_AHEAD_TO_REPAIR, label: "ASSEMBLING:" },
  { col: COL.DISPATCH_REQUEST_DATE, label: "DISPATCH & CLOSING:" },
];

// Columns that only hold spreadsheet formulas (day counts / turnaround) - never trusted from the
// source file (the recovered workbook has corrupted values in these), always recomputed on export
// (see DAY_FORMULAS in scheduler.export.ts).
export const COMPUTED_DAY_COLUMNS = new Set<number>([
  COL.ASSESSMENT_DAYS,
  COL.STRIP_QUOTE_DAYS,
  COL.ASSEMBLY_DAYS,
  COL.OUT_WORK,
  COL.ASSEMBLING_DAYS,
  COL.TOTAL_DAYS_WIP,
  COL.TOTAL_DAYS_COMP,
  COL.TURN_AROUND,
]);

const SERVICE_TYPE_TO_JOB_TYPE: Record<string, JobType> = {
  "STRIP & QUOTE": "CUSTOMER_REPAIR",
  WARRANTY: "WARRANTY",
  "BUILD -UP": "REBUILD",
  "BUILD-UP": "REBUILD",
  INTERNAL: "INTERNAL",
  MODIFICATION: "OTHER",
};

export function mapServiceTypeToJobType(value: unknown): JobType {
  const key = cellToString(value)?.toUpperCase();
  if (!key) return "OTHER";
  return SERVICE_TYPE_TO_JOB_TYPE[key] ?? "OTHER";
}

export function jobTypeToServiceType(jobType: JobType): string {
  const entry = Object.entries(SERVICE_TYPE_TO_JOB_TYPE).find(([, v]) => v === jobType);
  return entry ? entry[0] : jobType;
}

/** Header text compared case- and whitespace-insensitively. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function cellToString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

export function cellToDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return undefined;
}

export function cellToNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = cellToString(value);
  if (!str) return undefined;
  const cleaned = str.replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

export function rowHasJobData(row: unknown[]): boolean {
  return Boolean(cellToString(row[COL.REFERENCE]) && cellToString(row[COL.DESCRIPTION]));
}

// Serializes a raw sheet row into a plain, JSON-safe object keyed by header text, preserving the
// original values (including columns with no dedicated Prisma field) so export can round-trip them.
export function buildLegacySheetRow(row: unknown[]): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  HEADERS.forEach((header, idx) => {
    const value = row[idx];
    if (value instanceof Date) {
      result[header] = value.toISOString();
    } else if (typeof value === "number") {
      result[header] = value;
    } else {
      const str = cellToString(value);
      result[header] = str ?? null;
    }
  });
  return result;
}

export interface MappedSchedulerRow {
  referenceNumber: string;
  job: {
    description: string;
    partNumber?: string;
    serialNumber: string;
    customer: string;
    machineNumber?: string;
    machineSerialNumber?: string;
    customerRef?: string;
    customerAccount?: string;
    dateReceived?: Date;
    jobType: JobType;
    poValue: number;
    jobCreatedDate: Date;
    comments?: string;
    // App-only columns (see scheduler.extras.ts)
    woNumber?: string;
    woNumberSetAt?: Date;
    poNumber?: string;
    priority?: Priority;
    forecastMonth?: string;
    forecastAmount?: number;
  };
  quotation?: {
    mcoNumber?: string;
    epirocQuotationDate?: Date;
    evaluationDate?: Date;
    plannedDisassemblyDate?: Date;
    quotationAmount?: number;
    comments?: string;
    delayReason?: string;
    /** Resolved to a user id on import; dropped if no user has that name. */
    quotedByName?: string;
  };
  repair?: {
    purchaseOrderNumber?: string;
    technicianName?: string;
    labourHours?: number;
    partsCost?: number;
    totalRepairCost?: number;
    comments?: string;
    delayReason?: string;
    purchaseOrderDate?: Date;
    plannedAssemblyDate?: Date;
    actualAssemblyDate?: Date;
    repairStartDate?: Date;
    repairCompletionDate?: Date;
    outworkRequired?: string;
    supplierName?: string;
    outworkDateSent?: Date;
    outworkDateReceived?: Date;
    waitingForGoAhead?: boolean;
  };
  dispatch?: {
    dispatchRequestDate?: Date;
    dispatchDate?: Date;
    courier?: string;
    trackingNumber?: string;
    comments?: string;
    delayReason?: string;
    /** Resolved to a user id on import; dropped if no user has that name. */
    dispatchedByName?: string;
  };
  invoice?: {
    plannedClosingDate?: Date;
    closingDate?: Date;
    comments?: string;
    invoiceNumber?: string;
    invoiceDate?: Date;
    invoiceAmount?: number;
    delayReason?: string;
  };
  legacySheetRow: Record<string, string | number | null>;
}

export function mapSchedulerRow(row: unknown[]): MappedSchedulerRow {
  const referenceNumber = cellToString(row[COL.REFERENCE])!;
  const jobCreatedDate = cellToDate(row[COL.JOB_OPENING]) ?? cellToDate(row[COL.DATE_RECEIVED]) ?? new Date();

  const mapped: MappedSchedulerRow = {
    referenceNumber,
    job: {
      description: cellToString(row[COL.DESCRIPTION]) ?? "",
      partNumber: cellToString(row[COL.PART_NR]),
      serialNumber: cellToString(row[COL.SERIAL_NR]) ?? "N/A",
      customer: cellToString(row[COL.CUSTOMER]) ?? "UNKNOWN",
      machineNumber: cellToString(row[COL.MACHINE_NR]),
      machineSerialNumber: cellToString(row[COL.MACHINE_SERIAL_NR]),
      customerRef: cellToString(row[COL.CUSTOMER_REF]),
      customerAccount: cellToString(row[COL.CUSTOMER_ACC]),
      dateReceived: cellToDate(row[COL.DATE_RECEIVED]),
      jobType: mapServiceTypeToJobType(row[COL.SERVICE_TYPE]),
      poValue: cellToNumber(row[COL.ORDER_VALUE]) ?? 0,
      jobCreatedDate,
      comments: cellToString(row[COL.COMMENT]),
    },
    legacySheetRow: buildLegacySheetRow(row),
  };

  const mcoNumber = cellToString(row[COL.MCO_NR]);
  const epirocQuotationDate = cellToDate(row[COL.DATE_QUOTED]);
  const evaluationDate = cellToDate(row[COL.ACTUAL_DISASSEMBLY]);
  const plannedDisassemblyDate = cellToDate(row[COL.PLANNED_DISASSEMBLY]);
  if (mcoNumber || epirocQuotationDate || evaluationDate || plannedDisassemblyDate) {
    mapped.quotation = { mcoNumber, epirocQuotationDate, evaluationDate, plannedDisassemblyDate };
  }

  const purchaseOrderDate = cellToDate(row[COL.GO_AHEAD_TO_REPAIR]);
  const plannedAssemblyDate = cellToDate(row[COL.PLANNED_ASSEMBLY]);
  const actualAssemblyDate = cellToDate(row[COL.ACTUAL_ASSEMBLY]);
  const repairStartDate = cellToDate(row[COL.START]);
  const repairCompletionDate = cellToDate(row[COL.END]);
  const outworkRequired = cellToString(row[COL.OUTWORK]);
  const supplierName = cellToString(row[COL.SUPPLIER_NAME]);
  const outworkDateSent = cellToDate(row[COL.DATE_SENT]);
  const outworkDateReceived = cellToDate(row[COL.DATE_RECEIVED_FROM_SUPPLIER]);
  const waitingForGoAheadRaw = cellToString(row[COL.WAITING_FOR_GO_AHEAD]);
  const waitingForGoAhead = waitingForGoAheadRaw ? !/^(no|0|false)$/i.test(waitingForGoAheadRaw) : undefined;
  if (
    purchaseOrderDate ||
    plannedAssemblyDate ||
    actualAssemblyDate ||
    repairStartDate ||
    repairCompletionDate ||
    outworkRequired ||
    supplierName ||
    outworkDateSent ||
    outworkDateReceived ||
    waitingForGoAhead !== undefined
  ) {
    mapped.repair = {
      purchaseOrderDate,
      plannedAssemblyDate,
      actualAssemblyDate,
      repairStartDate,
      repairCompletionDate,
      outworkRequired,
      supplierName,
      outworkDateSent,
      outworkDateReceived,
      waitingForGoAhead,
    };
  }

  const dispatchRequestDate = cellToDate(row[COL.DISPATCH_REQUEST_DATE]);
  const dispatchDate = cellToDate(row[COL.ACTUAL_DISPATCH_DATE]);
  if (dispatchRequestDate || dispatchDate) {
    mapped.dispatch = { dispatchRequestDate, dispatchDate };
  }

  const plannedClosingDate = cellToDate(row[COL.PLANNED_JOB_CLOSING]);
  const closingDate = cellToDate(row[COL.ACTUAL_JOB_CLOSING]);
  const remarks = cellToString(row[COL.REMARKS]);
  if (plannedClosingDate || closingDate || remarks) {
    mapped.invoice = { plannedClosingDate, closingDate, comments: remarks };
  }

  return mapped;
}
