import { Priority } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { readSheetRows } from "./readWorkbook";
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
import { dateOrderWarnings, flowDatesOf, futureDateProblems } from "../../lib/dateRules";
import { customerGroupOf, findMatchingCustomer, normalizeCustomerName } from "../../lib/customers";


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

export interface ImportRowResult {
  referenceNumber: string;
  rowNumber: number;
  outcome: "created" | "skipped_existing" | "skipped_duplicate" | "skipped_no_job_opening";
  /** Date problems on a row that is imported anyway (same rules as the forms — see lib/dateRules). */
  warnings?: string[];
}

export interface ImportSummary {
  totalDataRows: number;
  created: number;
  skippedExisting: number;
  skippedDuplicate: number;
  skippedNoJobOpening: number;
  /** Imported rows that have date warnings. */
  withWarnings: number;
  /** Customers not on the customer list yet — added (in capitals) when the import runs. */
  newCustomers: string[];
  rows: ImportRowResult[];
}

/** The sheet's customer as a customer-list name: an existing customer (near-copies included), else the capitalised name. */
function resolveCustomer(raw: string, list: { name: string }[]): { name: string; isNew: boolean } | null {
  // A site of a single-customer group ("SASOL SHONDONI") is that customer ("SASOL").
  const name = customerGroupOf(raw) ?? normalizeCustomerName(raw);
  if (!name || name === "UNKNOWN") return null;
  const match = findMatchingCustomer(name, list);
  return match ? { name: match.name, isNew: false } : { name, isNew: true };
}

/** The same checks the forms run, reported instead of blocking: the sheet is the record. */
function rowDateWarnings(mapped: MappedSchedulerRow): string[] {
  const dates = flowDatesOf({ ...mapped.job, ...mapped });
  const warnings = [...futureDateProblems(dates), ...dateOrderWarnings(dates)];
  if (mapped.jobOpeningFromDateReceived) warnings.unshift("No Job Opening in the sheet — Date Received was used");
  return warnings;
}

async function planImport(buffer: Buffer): Promise<{ toCreate: MappedSchedulerRow[]; summary: ImportSummary }> {
  const rows = await readSheetRows(buffer, SCHEDULER_SHEET_NAME);
  const dataStart = findDataStartRow(rows);
  // Keep each row's real sheet position (1-based) before blank rows are filtered out.
  const dataRows = rows
    .map((row, i) => ({ row, rowNumber: i + 1 }))
    .slice(dataStart)
    .filter(({ row }) => rowHasJobData(row));

  const existingJobs = await prisma.job.findMany({ select: { referenceNumber: true } });
  const customerList: { name: string }[] = await prisma.customer.findMany({ select: { name: true } });
  const newCustomers: string[] = [];
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
    if (!mapped.job.jobCreatedDate) {
      results.push({ referenceNumber: mapped.referenceNumber, rowNumber, outcome: "skipped_no_job_opening" });
      return;
    }
    // Customer names follow the customer list, same as the Create Job form.
    const customer = resolveCustomer(mapped.job.customer, customerList);
    if (customer) {
      mapped.job.customer = customer.name;
      if (customer.isNew) {
        newCustomers.push(customer.name);
        customerList.push({ name: customer.name }); // later rows with the same customer match it
      }
    }
    toCreate.push(mapped);
    const warnings = rowDateWarnings(mapped);
    if (!customer) warnings.unshift("No customer in the sheet");
    results.push({
      referenceNumber: mapped.referenceNumber,
      rowNumber,
      outcome: "created",
      ...(warnings.length > 0 && { warnings }),
    });
  });

  const summary: ImportSummary = {
    totalDataRows: dataRows.length,
    created: toCreate.length,
    skippedExisting: results.filter((r) => r.outcome === "skipped_existing").length,
    skippedDuplicate: results.filter((r) => r.outcome === "skipped_duplicate").length,
    skippedNoJobOpening: results.filter((r) => r.outcome === "skipped_no_job_opening").length,
    withWarnings: results.filter((r) => r.warnings).length,
    newCustomers,
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
  // New customers go on the list first (skipDuplicates-style: one that appeared meanwhile is fine).
  for (const name of summary.newCustomers) {
    await prisma.customer.upsert({ where: { name }, create: { name, createdById: opts.createdById }, update: {} });
  }
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
        // A WO number with no recorded date is left undated rather than assumed to be the job
        // opening date — a made-up date would read as "WO on day 0" in the days-to-WO figures.
        woNumberSetAt: job.woNumber ? job.woNumberSetAt : undefined,
        poNumber: job.poNumber,
        jobType: job.jobType,
        poValue: job.poValue,
        priority: job.priority ?? defaultPriority,
        // Internal / warranty jobs are never invoiced, so any forecast on them is dropped.
        forecastMonth: isNonInvoicedJobType(job.jobType) ? undefined : job.forecastMonth,
        forecastAmount: job.forecastMonth && !isNonInvoicedJobType(job.jobType) ? job.forecastAmount : undefined,
        jobCreatedDate: job.jobCreatedDate!, // rows without one were skipped in planImport
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
