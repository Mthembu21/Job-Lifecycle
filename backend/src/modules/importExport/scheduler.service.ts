import * as XLSX from "xlsx";
import { Priority } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import {
  COL,
  DATA_START_ROW,
  HEADERS,
  MappedSchedulerRow,
  normalizeHeader,
  SCHEDULER_SHEET_NAME,
  mapSchedulerRow,
  rowHasJobData,
} from "./scheduler.mapping";
import { locateExtraColumns } from "./scheduler.extras";
import { ensureForecastsFrozen } from "../../lib/forecast";
import { isNonInvoicedJobType } from "../../lib/jobTypes";


/**
 * Index of the first data row. The original tracker has its column headers on row 2, but the app's
 * branded export puts a logo banner above them — so find the header row by its text (first scanned
 * rows only) and fall back to the tracker's fixed layout.
 */
function findDataStartRow(rows: unknown[][]): number {
  const refHeader = normalizeHeader(HEADERS[COL.REFERENCE]);
  const descHeader = normalizeHeader(HEADERS[COL.DESCRIPTION]);
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    if (normalizeHeader(row[COL.REFERENCE]) === refHeader && normalizeHeader(row[COL.DESCRIPTION]) === descHeader) {
      return i + 1;
    }
  }
  return DATA_START_ROW;
}

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
  const dataStart = findDataStartRow(rows);
  // Keep each row's real sheet position (1-based) before blank rows are filtered out.
  const dataRows = rows
    .map((row, i) => ({ row, rowNumber: i + 1 }))
    .slice(dataStart)
    .filter(({ row }) => rowHasJobData(row));

  const existingJobs = await prisma.job.findMany({ select: { referenceNumber: true } });
  const existingRefs = new Set(existingJobs.map((j) => j.referenceNumber.trim().toUpperCase()));

  const seenInSheet = new Set<string>();
  const toCreate: MappedSchedulerRow[] = [];
  const results: ImportRowResult[] = [];

  // App-only columns (present in workbooks exported by this app) are found by header text.
  const extraColumns = dataStart > 0 ? locateExtraColumns(rows[dataStart - 1] ?? []) : [];

  dataRows.forEach(({ row, rowNumber }) => {
    const mapped = mapSchedulerRow(row);
    for (const [idx, col] of extraColumns) col.set!(mapped, row[idx]);
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
  const defaultPriority = opts.priority ?? "MEDIUM";
  // Imported rows can carry forecasts — freeze any started month first (see lib/forecast.ts).
  await ensureForecastsFrozen();

  // "Quoted by" / "Dispatched by" are exported as names; map them back to users where one matches.
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userIdByName = new Map(users.map((u) => [u.name.trim().toUpperCase(), u.id]));
  const userId = (name?: string) => (name ? userIdByName.get(name.trim().toUpperCase()) : undefined);

  for (const mapped of toCreate) {
    const { job } = mapped;
    const { quotedByName, ...quotation } = mapped.quotation ?? {};
    const { dispatchedByName, ...dispatch } = mapped.dispatch ?? {};

    await prisma.job.create({
      data: {
        referenceNumber: mapped.referenceNumber,
        description: job.description,
        partNumber: job.partNumber,
        serialNumber: job.serialNumber,
        machineNumber: job.machineNumber,
        machineSerialNumber: job.machineSerialNumber,
        customer: job.customer,
        customerRef: job.customerRef,
        customerAccount: job.customerAccount,
        dateReceived: job.dateReceived,
        woNumber: job.woNumber,
        // A WO number with no recorded date counts as set on the job opening date.
        woNumberSetAt: job.woNumber ? job.woNumberSetAt ?? job.jobCreatedDate : undefined,
        poNumber: job.poNumber,
        jobType: job.jobType,
        poValue: job.poValue,
        priority: job.priority ?? defaultPriority,
        // Internal / warranty jobs are never invoiced, so any forecast on them is dropped.
        forecastMonth: isNonInvoicedJobType(job.jobType) ? undefined : job.forecastMonth,
        forecastAmount: job.forecastMonth && !isNonInvoicedJobType(job.jobType) ? job.forecastAmount : undefined,
        jobCreatedDate: job.jobCreatedDate,
        comments: job.comments,
        isLegacyImport: true,
        legacySheetRow: mapped.legacySheetRow,
        createdById: opts.createdById,
        ...(mapped.quotation && {
          quotation: { create: { ...quotation, quotedById: userId(quotedByName) } },
        }),
        ...(mapped.repair && {
          repair: { create: { ...mapped.repair } },
        }),
        ...(mapped.dispatch && {
          dispatch: { create: { ...dispatch, dispatchedById: userId(dispatchedByName) } },
        }),
        // (Internal / warranty jobs with a closing date and no invoice read as closed — see statusEngine.)
        ...(mapped.invoice && {
          invoice: { create: { ...mapped.invoice } },
        }),
      },
    });
  }

  return summary;
}

// The branded export lives in its own module; re-exported so existing imports keep working.
export { exportSchedulerWorkbook } from "./scheduler.export";
