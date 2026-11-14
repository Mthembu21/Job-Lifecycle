import * as XLSX from "xlsx";
import { Priority } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import {
  COL,
  COMPUTED_DAY_COLUMNS,
  DATA_START_ROW,
  FIELD_HEADER_ROW,
  GROUP_HEADERS,
  HEADERS,
  MappedSchedulerRow,
  SCHEDULER_SHEET_NAME,
  jobTypeToServiceType,
  mapSchedulerRow,
  rowHasJobData,
} from "./scheduler.mapping";

function readSchedulerRows(buffer: Buffer): unknown[][] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new HttpError(400, "Could not read the uploaded file as an Excel workbook");
  }

  const sheet = workbook.Sheets[SCHEDULER_SHEET_NAME];
  if (!sheet) {
    throw new HttpError(400, `Workbook does not contain a "${SCHEDULER_SHEET_NAME}" sheet`);
  }

  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
}

export interface ImportRowResult {
  referenceNumber: string;
  rowNumber: number;
  outcome: "created" | "skipped_existing" | "skipped_duplicate";
}

export interface ImportSummary {
  totalDataRows: number;
  created: number;
  skippedExisting: number;
  skippedDuplicate: number;
  rows: ImportRowResult[];
}

async function planImport(buffer: Buffer): Promise<{ toCreate: MappedSchedulerRow[]; summary: ImportSummary }> {
  const rows = readSchedulerRows(buffer);
  const dataRows = rows.slice(DATA_START_ROW).filter(rowHasJobData);

  const existingJobs = await prisma.job.findMany({ select: { referenceNumber: true } });
  const existingRefs = new Set(existingJobs.map((j) => j.referenceNumber.trim().toUpperCase()));

  const seenInSheet = new Set<string>();
  const toCreate: MappedSchedulerRow[] = [];
  const results: ImportRowResult[] = [];

  dataRows.forEach((row, idx) => {
    const rowNumber = DATA_START_ROW + idx + 1; // 1-based, matches spreadsheet row number
    const mapped = mapSchedulerRow(row);
    const key = mapped.referenceNumber.trim().toUpperCase();

    if (existingRefs.has(key)) {
      results.push({ referenceNumber: mapped.referenceNumber, rowNumber, outcome: "skipped_existing" });
      return;
    }
    if (seenInSheet.has(key)) {
      results.push({ referenceNumber: mapped.referenceNumber, rowNumber, outcome: "skipped_duplicate" });
      return;
    }
    seenInSheet.add(key);
    toCreate.push(mapped);
    results.push({ referenceNumber: mapped.referenceNumber, rowNumber, outcome: "created" });
  });

  const summary: ImportSummary = {
    totalDataRows: dataRows.length,
    created: toCreate.length,
    skippedExisting: results.filter((r) => r.outcome === "skipped_existing").length,
    skippedDuplicate: results.filter((r) => r.outcome === "skipped_duplicate").length,
    rows: results,
  };

  return { toCreate, summary };
}

export async function previewSchedulerImport(buffer: Buffer): Promise<ImportSummary> {
  const { summary } = await planImport(buffer);
  return summary;
}

export async function runSchedulerImport(
  buffer: Buffer,
  opts: { createdById: string; priority?: Priority }
): Promise<ImportSummary> {
  const { toCreate, summary } = await planImport(buffer);
  const priority = opts.priority ?? "MEDIUM";

  for (const mapped of toCreate) {
    await prisma.job.create({
      data: {
        referenceNumber: mapped.referenceNumber,
        description: mapped.job.description,
        partNumber: mapped.job.partNumber,
        serialNumber: mapped.job.serialNumber,
        customer: mapped.job.customer,
        jobType: mapped.job.jobType,
        poValue: mapped.job.poValue,
        priority,
        jobCreatedDate: mapped.job.jobCreatedDate,
        comments: mapped.job.comments,
        isLegacyImport: true,
        legacySheetRow: mapped.legacySheetRow,
        createdById: opts.createdById,
        ...(mapped.quotation && {
          quotation: { create: { ...mapped.quotation } },
        }),
        ...(mapped.repair && {
          repair: { create: { ...mapped.repair } },
        }),
        ...(mapped.dispatch && {
          dispatch: { create: { ...mapped.dispatch } },
        }),
        ...(mapped.invoice && {
          invoice: { create: { ...mapped.invoice } },
        }),
      },
    });
  }

  return summary;
}

function daysBetween(a?: Date | null, b?: Date | null): number | "" {
  if (!a || !b) return "";
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

// Columns holding a date value in the exported sheet - given real Date objects (not text) so Excel
// treats them as native, sortable, reformattable dates.
const DATE_COLUMNS = new Set<number>([
  COL.DATE_RECEIVED,
  COL.JOB_OPENING,
  COL.PLANNED_DISASSEMBLY,
  COL.ACTUAL_DISASSEMBLY,
  COL.DATE_QUOTED,
  COL.GO_AHEAD_TO_REPAIR,
  COL.PLANNED_ASSEMBLY,
  COL.ACTUAL_ASSEMBLY,
  COL.START,
  COL.END,
  COL.DATE_SENT,
  COL.DATE_RECEIVED_FROM_SUPPLIER,
  COL.DISPATCH_REQUEST_DATE,
  COL.ACTUAL_DISPATCH_DATE,
  COL.PLANNED_JOB_CLOSING,
  COL.ACTUAL_JOB_CLOSING,
]);

// Roughly-sized column widths (in characters) so the exported sheet is readable without a manual
// resize - wide for free-text columns, narrow for short codes/dates/day-counts.
const COLUMN_WIDTHS: Record<number, number> = {
  [COL.REFERENCE]: 14,
  [COL.DESCRIPTION]: 24,
  [COL.PART_NR]: 14,
  [COL.SERIAL_NR]: 16,
  [COL.MACHINE_NR]: 14,
  [COL.MACHINE_SERIAL_NR]: 16,
  [COL.CUSTOMER]: 20,
  [COL.CUSTOMER_REF]: 14,
  [COL.CUSTOMER_ACC]: 14,
  [COL.SERVICE_TYPE]: 14,
  [COL.MCO_NR]: 12,
  [COL.COMMENT]: 24,
  [COL.OUTWORK]: 10,
  [COL.SUPPLIER_NAME]: 18,
  [COL.WAITING_FOR_GO_AHEAD]: 12,
  [COL.ORDER_VALUE]: 14,
  [COL.REMARKS]: 20,
  [COL.STATUS]: 12,
};
const DEFAULT_DATE_WIDTH = 12;
const DEFAULT_WIDTH = 10;

function widthFor(col: number): number {
  if (COLUMN_WIDTHS[col] !== undefined) return COLUMN_WIDTHS[col];
  if (DATE_COLUMNS.has(col)) return DEFAULT_DATE_WIDTH;
  return DEFAULT_WIDTH;
}

export async function exportSchedulerWorkbook(): Promise<Buffer> {
  const jobs = await prisma.job.findMany({
    include: { quotation: true, repair: true, dispatch: true, invoice: true },
    orderBy: { jobCreatedDate: "asc" },
  });

  const groupRow: string[] = [];
  GROUP_HEADERS.forEach(({ col, label }) => {
    groupRow[col] = label;
  });
  const fieldRow = [...HEADERS];

  const dataRows = jobs.map((job) => {
    // Legacy-imported jobs carry the original row so untracked columns (machine numbers, supplier
    // names, planned dates, etc.) survive the round trip; current field values are overlaid on top
    // so edits made in the app since import are reflected in the export.
    const legacy = (job.legacySheetRow as Record<string, string | number | null> | null) ?? {};
    const row: (string | number | Date)[] = HEADERS.map((header, idx) => {
      if (DATE_COLUMNS.has(idx)) return "";
      const value = legacy[header];
      return value === null || value === undefined ? "" : value;
    });

    const orDate = (d: Date | null | undefined) => d ?? "";

    row[COL.REFERENCE] = job.referenceNumber;
    row[COL.DESCRIPTION] = job.description;
    row[COL.PART_NR] = job.partNumber ?? "";
    row[COL.SERIAL_NR] = job.serialNumber;
    row[COL.MACHINE_NR] = job.machineNumber ?? "";
    row[COL.MACHINE_SERIAL_NR] = job.machineSerialNumber ?? "";
    row[COL.CUSTOMER] = job.customer;
    row[COL.CUSTOMER_REF] = job.customerRef ?? "";
    row[COL.CUSTOMER_ACC] = job.customerAccount ?? "";
    row[COL.SERVICE_TYPE] = jobTypeToServiceType(job.jobType);
    row[COL.MCO_NR] = job.quotation?.mcoNumber ?? "";
    row[COL.DATE_RECEIVED] = orDate(job.dateReceived);
    row[COL.JOB_OPENING] = orDate(job.jobCreatedDate);
    row[COL.PLANNED_DISASSEMBLY] = orDate(job.quotation?.plannedDisassemblyDate);
    row[COL.ACTUAL_DISASSEMBLY] = orDate(job.quotation?.evaluationDate);
    row[COL.DATE_QUOTED] = orDate(job.quotation?.epirocQuotationDate);
    row[COL.GO_AHEAD_TO_REPAIR] = orDate(job.repair?.purchaseOrderDate);
    row[COL.PLANNED_ASSEMBLY] = orDate(job.repair?.plannedAssemblyDate);
    row[COL.ACTUAL_ASSEMBLY] = orDate(job.repair?.actualAssemblyDate);
    row[COL.START] = orDate(job.repair?.repairStartDate);
    row[COL.END] = orDate(job.repair?.repairCompletionDate);
    row[COL.OUTWORK] = job.repair?.outworkRequired ?? "";
    row[COL.SUPPLIER_NAME] = job.repair?.supplierName ?? "";
    row[COL.DATE_SENT] = orDate(job.repair?.outworkDateSent);
    row[COL.DATE_RECEIVED_FROM_SUPPLIER] = orDate(job.repair?.outworkDateReceived);
    row[COL.WAITING_FOR_GO_AHEAD] = job.repair?.waitingForGoAhead === true ? "YES" : job.repair?.waitingForGoAhead === false ? "NO" : "";
    row[COL.DISPATCH_REQUEST_DATE] = orDate(job.dispatch?.dispatchRequestDate);
    row[COL.ACTUAL_DISPATCH_DATE] = orDate(job.dispatch?.dispatchDate);
    row[COL.PLANNED_JOB_CLOSING] = orDate(job.invoice?.plannedClosingDate);
    row[COL.ACTUAL_JOB_CLOSING] = orDate(job.invoice?.closingDate);
    row[COL.ORDER_VALUE] = job.poValue;
    row[COL.REMARKS] = job.invoice?.comments ?? "";
    row[COL.COMMENT] = job.comments ?? "";

    row[COL.ASSESSMENT_DAYS] = daysBetween(job.jobCreatedDate, job.quotation?.epirocQuotationDate);
    row[COL.ASSEMBLY_DAYS] = daysBetween(job.repair?.purchaseOrderDate, job.repair?.repairCompletionDate);
    row[COL.TOTAL_DAYS_WIP] = daysBetween(job.jobCreatedDate, job.invoice?.closingDate ?? new Date());
    row[COL.STATUS] = job.invoice?.closingDate ? "CLOSED" : "";

    COMPUTED_DAY_COLUMNS.forEach((idx) => {
      if (row[idx] === "" || row[idx] === undefined) row[idx] = "";
    });

    return row;
  });

  const worksheet = XLSX.utils.aoa_to_sheet([groupRow, fieldRow, ...dataRows]);

  // Give every date cell a real date number format (aoa_to_sheet already types them 'd' since
  // they're JS Date objects, but pins the display format so it's consistent across columns/rows).
  const dataStartRow = 2; // 0-indexed: row 0 = group header, row 1 = field header
  for (let r = dataStartRow; r < dataStartRow + dataRows.length; r++) {
    for (const col of DATE_COLUMNS) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = worksheet[addr];
      if (cell && cell.t === "d") cell.z = "yyyy-mm-dd";
    }
    const orderValueAddr = XLSX.utils.encode_cell({ r, c: COL.ORDER_VALUE });
    const orderValueCell = worksheet[orderValueAddr];
    if (orderValueCell && orderValueCell.t === "n") orderValueCell.z = "#,##0.00";
  }

  // Column widths, sized per-column so the sheet is readable without a manual resize.
  worksheet["!cols"] = HEADERS.map((_, idx) => ({ wch: widthFor(idx) }));

  // Merge each section's group-header label across the columns it spans, matching the original
  // "RECEIVING: / ASSESMENT: / ASSEMBLING: / DISPATCH & CLOSING:" banner row.
  const sortedGroups = [...GROUP_HEADERS].sort((a, b) => a.col - b.col);
  worksheet["!merges"] = sortedGroups.map((group, idx) => {
    const endCol = idx + 1 < sortedGroups.length ? sortedGroups[idx + 1].col - 1 : HEADERS.length - 1;
    return { s: { r: 0, c: group.col }, e: { r: 0, c: endCol } };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SCHEDULER_SHEET_NAME);

  const arrayBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellDates: true });
  return arrayBuffer as Buffer;
}
