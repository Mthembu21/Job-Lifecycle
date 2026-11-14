import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { deriveJobStatus } from "../../lib/statusEngine";
import { SlaStage } from "../../lib/labels";
import {
  COL,
  COMPUTED_DAY_COLUMNS,
  GROUP_HEADERS,
  HEADERS,
  SCHEDULER_SHEET_NAME,
  jobTypeToServiceType,
} from "./scheduler.mapping";
import { EXTRA_COLUMNS, EXTRA_GROUPS, ExportStatus, ExtraKind } from "./scheduler.extras";

/*
 * Branded "SCHEDULER 2025" export — every field the app stores for a job.
 *
 * Layout (1-based Excel rows):
 *   1–2  banner: Epiroc logo, title, export metadata
 *   3    thin Epiroc-yellow accent bar
 *   4    section banner (RECEIVING / ASSESMENT / ASSEMBLING / DISPATCH & CLOSING, then the
 *        app-only sections WORK ORDER & PO / QUOTATION / REPAIR / DISPATCH / INVOICE / STATUS & SLA)
 *   5    column headers — the tracker's 42 exact headers, then the app-only columns
 *   6+   one row per job, then a totals row
 *
 * Day-count columns are written as the tracker's own formulas (e.g. DAYS = ACTUAL − PLANNED
 * DISASSEMBLY) with the computed value cached, so they stay live if dates are edited in Excel.
 * The importer locates the header row by its text and reads the app-only columns by header, so
 * an exported workbook re-imports without losing data.
 */

// Epiroc palette (ARGB). Mirrors frontend/src/index.css — Epiroc has no black; darkest tone is slate.
const C = {
  yellow: "FFFFCE00",
  yellowSoft: "FFFFF5CC",
  slate: "FF415464", // Epiroc logo gray
  slateDark: "FF2F3E4A",
  slateMuted: "FF5B6B78",
  border: "FFD9DEE2",
  zebra: "FFF5F7F8",
  white: "FFFFFFFF",
  success: "FF2E8540",
  successSoft: "FFE3F1E6",
  danger: "FFC4372C",
  dangerSoft: "FFF8E3E1",
} as const;

const FONT = "Calibri";
const BANNER_ROWS = 3;
const GROUP_ROW = BANNER_ROWS + 1; // 4
const HEADER_ROW = GROUP_ROW + 1; // 5
const FIRST_DATA_ROW = HEADER_ROW + 1; // 6
const TRACKER_COLS = HEADERS.length; // 42
const TOTAL_COLS = TRACKER_COLS + EXTRA_COLUMNS.length;
const MONEY_FMT = '"R" #,##0.00;[Red]-"R" #,##0.00';
const DATE_FMT = "dd mmm yyyy";

// Logo lives in backend/assets; this file is three levels below backend/ in both src/ and dist/.
const LOGO_PATH = path.resolve(__dirname, "../../../assets/epiroc-logo.png");
const LOGO_ASPECT = 1477 / 400;

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

/**
 * The tracker's day-count formulas: [column, later date column, earlier date column].
 * Taken from the "SCHEDULER 2025" workbook (e.g. P4 = O4-N4).
 */
const DAY_FORMULAS: Array<[number, number, number]> = [
  [COL.ASSESSMENT_DAYS, COL.ACTUAL_DISASSEMBLY, COL.PLANNED_DISASSEMBLY], // P = O − N
  [COL.STRIP_QUOTE_DAYS, COL.DATE_QUOTED, COL.DATE_RECEIVED], // R = Q − L
  [COL.ASSEMBLY_DAYS, COL.ACTUAL_ASSEMBLY, COL.PLANNED_ASSEMBLY], // V = U − T
  [COL.OUT_WORK, COL.DATE_RECEIVED_FROM_SUPPLIER, COL.DATE_SENT], // AE = AC − AB
  [COL.ASSEMBLING_DAYS, COL.END, COL.START], // AF = Y − X
  [COL.TOTAL_DAYS_COMP, COL.ACTUAL_JOB_CLOSING, COL.DATE_RECEIVED], // AN = AJ − L
  [COL.TURN_AROUND, COL.ACTUAL_DISPATCH_DATE, COL.GO_AHEAD_TO_REPAIR], // AP = AH − S
];
const DAY_FORMULA_BY_COL = new Map(DAY_FORMULAS.map(([col, later, earlier]) => [col, { later, earlier }]));
// The formula columns above plus TOTAL (Days) WIP, which runs to today for open jobs.
const DAY_COLUMNS = COMPUTED_DAY_COLUMNS;

/** Free-text tracker columns: left-aligned. Everything else is centered. */
const TEXT_COLUMNS = new Set<number>([COL.DESCRIPTION, COL.CUSTOMER, COL.COMMENT, COL.SUPPLIER_NAME, COL.REMARKS]);

/** The app's stage, in the tracker's STATUS vocabulary (ASSESMENT / ASSEMBLY / DISPATCH / INVOICED / CLOSED). */
const TRACKER_STATUS: Record<SlaStage, string> = {
  QUOTATION: "ASSESMENT",
  AWAITING_PO: "AWAITING PO",
  REPAIR: "ASSEMBLY",
  DISPATCH: "DISPATCH",
  INVOICING: "AWAITING INVOICE",
};

const COLUMN_WIDTHS: Record<number, number> = {
  [COL.REFERENCE]: 15,
  [COL.DESCRIPTION]: 30,
  [COL.PART_NR]: 14,
  [COL.SERIAL_NR]: 16,
  [COL.MACHINE_NR]: 13,
  [COL.MACHINE_SERIAL_NR]: 16,
  [COL.CUSTOMER]: 24,
  [COL.CUSTOMER_REF]: 14,
  [COL.CUSTOMER_ACC]: 14,
  [COL.SERVICE_TYPE]: 16,
  [COL.MCO_NR]: 12,
  [COL.COMMENT]: 30,
  [COL.OUTWORK]: 11,
  [COL.SUPPLIER_NAME]: 20,
  [COL.WAITING_FOR_GO_AHEAD]: 12,
  [COL.ORDER_VALUE]: 16,
  [COL.REMARKS]: 28,
  [COL.STATUS]: 15,
};

function widthFor(col: number): number {
  if (col >= TRACKER_COLS) return EXTRA_COLUMNS[col - TRACKER_COLS].width;
  if (COLUMN_WIDTHS[col] !== undefined) return COLUMN_WIDTHS[col];
  if (DATE_COLUMNS.has(col)) return 13;
  if (DAY_COLUMNS.has(col)) return 10;
  return 12;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * The calendar day a stored date represents, as a UTC-midnight Date (what Excel needs to show that
 * day). Stored dates are a mix of UTC midnight (entered in the app) and local midnight = 22:00 UTC
 * the previous day (imported from the tracker); reading them in the server's local time zone —
 * the same way the app displays them — gives the right day for both.
 */
function excelDate(d: Date | null | undefined): Date | null {
  if (!d) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Signed whole days a − b (as Excel computes date − date), or "" when either is missing. */
function dayDiff(a: unknown, b: unknown): number | "" {
  if (!(a instanceof Date) || !(b instanceof Date)) return "";
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

const exportInclude = {
  createdBy: { select: { name: true } },
  quotation: { include: { quotedBy: { select: { name: true } } } },
  repair: true,
  dispatch: { include: { dispatchedBy: { select: { name: true } } } },
  invoice: true,
} as const;

function loadJobs() {
  return prisma.job.findMany({ include: exportInclude, orderBy: { jobCreatedDate: "asc" } });
}

type JobForExport = Awaited<ReturnType<typeof loadJobs>>[number];
type CellValue = string | number | Date | null;

interface BuiltRow {
  values: CellValue[];
  closed: boolean;
}

/** One sheet row (0-based columns) for a job: the tracker's 42 columns then the app-only ones. */
function buildRow(job: JobForExport, now: Date): BuiltRow {
  // Legacy-imported jobs carry the original row so untracked columns survive the round trip;
  // current field values are overlaid so edits made in the app since import are reflected.
  const legacy = (job.legacySheetRow as Record<string, string | number | null> | null) ?? {};
  const row: CellValue[] = HEADERS.map((header, idx) => {
    if (DATE_COLUMNS.has(idx) || DAY_COLUMNS.has(idx)) return null;
    const value = legacy[header];
    return value === null || value === undefined || value === "" ? null : value;
  });

  const s = (v: string | null | undefined) => (v === undefined || v === "" ? null : v);

  row[COL.REFERENCE] = job.referenceNumber;
  row[COL.DESCRIPTION] = job.description;
  row[COL.PART_NR] = s(job.partNumber);
  row[COL.SERIAL_NR] = job.serialNumber;
  row[COL.MACHINE_NR] = s(job.machineNumber);
  row[COL.MACHINE_SERIAL_NR] = s(job.machineSerialNumber);
  row[COL.CUSTOMER] = job.customer;
  row[COL.CUSTOMER_REF] = s(job.customerRef);
  row[COL.CUSTOMER_ACC] = s(job.customerAccount);
  row[COL.SERVICE_TYPE] = jobTypeToServiceType(job.jobType);
  row[COL.MCO_NR] = s(job.quotation?.mcoNumber);
  row[COL.DATE_RECEIVED] = excelDate(job.dateReceived);
  row[COL.JOB_OPENING] = excelDate(job.jobCreatedDate);
  row[COL.PLANNED_DISASSEMBLY] = excelDate(job.quotation?.plannedDisassemblyDate);
  row[COL.ACTUAL_DISASSEMBLY] = excelDate(job.quotation?.evaluationDate);
  row[COL.DATE_QUOTED] = excelDate(job.quotation?.epirocQuotationDate);
  row[COL.GO_AHEAD_TO_REPAIR] = excelDate(job.repair?.purchaseOrderDate);
  row[COL.PLANNED_ASSEMBLY] = excelDate(job.repair?.plannedAssemblyDate);
  row[COL.ACTUAL_ASSEMBLY] = excelDate(job.repair?.actualAssemblyDate);
  row[COL.START] = excelDate(job.repair?.repairStartDate);
  row[COL.END] = excelDate(job.repair?.repairCompletionDate);
  row[COL.OUTWORK] = s(job.repair?.outworkRequired);
  row[COL.SUPPLIER_NAME] = s(job.repair?.supplierName);
  row[COL.DATE_SENT] = excelDate(job.repair?.outworkDateSent);
  row[COL.DATE_RECEIVED_FROM_SUPPLIER] = excelDate(job.repair?.outworkDateReceived);
  row[COL.WAITING_FOR_GO_AHEAD] =
    job.repair?.waitingForGoAhead === true ? "YES" : job.repair?.waitingForGoAhead === false ? "NO" : null;
  row[COL.DISPATCH_REQUEST_DATE] = excelDate(job.dispatch?.dispatchRequestDate);
  row[COL.ACTUAL_DISPATCH_DATE] = excelDate(job.dispatch?.dispatchDate);
  row[COL.PLANNED_JOB_CLOSING] = excelDate(job.invoice?.plannedClosingDate);
  row[COL.ACTUAL_JOB_CLOSING] = excelDate(job.invoice?.closingDate);
  row[COL.ORDER_VALUE] = Number(job.poValue);
  row[COL.REMARKS] = s(job.invoice?.comments);
  row[COL.COMMENT] = s(job.comments);

  // Day counts (cached results for the formulas written later).
  for (const [col, later, earlier] of DAY_FORMULAS) {
    const days = dayDiff(row[later], row[earlier]);
    row[col] = days === "" ? null : days;
  }
  const wipEnd = row[COL.ACTUAL_JOB_CLOSING] instanceof Date ? (row[COL.ACTUAL_JOB_CLOSING] as Date) : excelDate(now)!;
  const wip = dayDiff(wipEnd, row[COL.JOB_OPENING]);
  row[COL.TOTAL_DAYS_WIP] = wip === "" ? null : wip;

  const derived = deriveJobStatus(job, now);
  row[COL.STATUS] = derived.isClosed
    ? job.invoice?.closingDate
      ? "CLOSED"
      : "INVOICED"
    : TRACKER_STATUS[derived.currentStage as SlaStage];

  const status: ExportStatus = {
    stageStatus: derived.currentStatus.replace("_", " "), // "IN_PROGRESS" → "IN PROGRESS"
    daysInStage: derived.daysInCurrentStage,
    slaCompliant: derived.slaCompliant,
    closedWithoutInvoice: derived.closedWithoutInvoice,
  };
  for (const col of EXTRA_COLUMNS) {
    const v = col.get(job, status);
    row.push(v instanceof Date ? excelDate(v) : v === undefined || v === "" ? null : v);
  }

  return { values: row, closed: derived.isClosed };
}

const thin = (argb: string): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb } });
const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Column letter for a 0-based index (0 → A, 41 → AP). */
function colLetter(idx: number): string {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** All section spans across the sheet: [startCol, endCol] (0-based, inclusive). */
function groupSpans(): Array<{ label: string; start: number; end: number; appOnly: boolean }> {
  const sorted = [...GROUP_HEADERS].sort((a, b) => a.col - b.col);
  const tracker = sorted.map((g, i) => ({
    label: g.label,
    start: g.col,
    end: i + 1 < sorted.length ? sorted[i + 1].col - 1 : TRACKER_COLS - 1,
    appOnly: false,
  }));
  let col = TRACKER_COLS;
  const extra = EXTRA_GROUPS.map((g) => {
    const span = { label: g.label, start: col, end: col + g.columns.length - 1, appOnly: true };
    col += g.columns.length;
    return span;
  });
  return [...tracker, ...extra];
}

function kindOf(col: number): ExtraKind | "tracker" {
  return col >= TRACKER_COLS ? EXTRA_COLUMNS[col - TRACKER_COLS].kind : "tracker";
}

function formatExportDate(d: Date): string {
  return d.toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function exportSchedulerWorkbook(): Promise<Buffer> {
  const now = new Date();
  const jobs = await loadJobs();
  const rows = jobs.map((j) => buildRow(j, now));
  const openCount = rows.filter((r) => !r.closed).length;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Job Lifecycle Management";
  wb.created = now;
  wb.title = "Job Lifecycle — Component Tracker";

  const ws = wb.addWorksheet(SCHEDULER_SHEET_NAME, {
    views: [{ state: "frozen", xSplit: 1, ySplit: HEADER_ROW, showGridLines: false, zoomScale: 90 }],
    properties: { tabColor: { argb: C.yellow }, defaultRowHeight: 18 },
    pageSetup: {
      paperSize: 8 as ExcelJS.PaperSize, // A3 (not in exceljs's enum, but valid OOXML)
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${GROUP_ROW}:${HEADER_ROW}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L&8&K5B6B78Epiroc · Job Lifecycle export · ${formatExportDate(now)}&R&8&K5B6B78Page &P of &N`,
    },
  });

  ws.columns = Array.from({ length: TOTAL_COLS }, (_, idx) => ({ width: widthFor(idx) }));

  // ── Banner ─────────────────────────────────────────────────────────────
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 5;

  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    const logoId = wb.addImage({ buffer: fs.readFileSync(LOGO_PATH) as unknown as ExcelJS.Buffer, extension: "png" });
    const h = 42;
    ws.addImage(logoId, { tl: { col: 0.12, row: 0.25 }, ext: { width: Math.round(h * LOGO_ASPECT), height: h }, editAs: "oneCell" });
  }
  const titleCol = hasLogo ? 3 : 1; // leave A:B to the logo

  const title = ws.getCell(1, titleCol);
  title.value = "Job Lifecycle — Component Tracker";
  title.font = { name: FONT, size: 18, bold: true, color: { argb: C.slate } };
  title.alignment = { vertical: "bottom" };

  const meta = ws.getCell(2, titleCol);
  meta.value = `${SCHEDULER_SHEET_NAME}  ·  ${jobs.length} jobs (${openCount} open, ${jobs.length - openCount} closed)  ·  Exported ${formatExportDate(now)}`;
  meta.font = { name: FONT, size: 10, color: { argb: C.slateMuted } };
  meta.alignment = { vertical: "top" };

  for (let c = 1; c <= TOTAL_COLS; c++) ws.getCell(3, c).fill = solid(C.yellow);

  // ── Section banner (row 4) ─────────────────────────────────────────────
  // Tracker sections: dark slate + yellow text. App-only sections: Epiroc slate + white text, so
  // it's obvious which columns aren't in the original tracker.
  ws.getRow(GROUP_ROW).height = 24;
  const spans = groupSpans();
  for (const span of spans) {
    for (let c = span.start; c <= span.end; c++) {
      const cell = ws.getCell(GROUP_ROW, c + 1);
      cell.fill = solid(span.appOnly ? C.slate : C.slateDark);
      if (c === span.start) cell.border = { left: { style: "medium", color: { argb: C.yellow } } };
    }
    if (span.end > span.start) ws.mergeCells(GROUP_ROW, span.start + 1, GROUP_ROW, span.end + 1);
    const cell = ws.getCell(GROUP_ROW, span.start + 1);
    cell.value = span.label;
    cell.font = { name: FONT, size: span.appOnly ? 11 : 12, bold: true, color: { argb: span.appOnly ? C.white : C.yellow } };
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  }

  // ── Column headers (row 5) ─────────────────────────────────────────────
  const headerRow = ws.getRow(HEADER_ROW);
  headerRow.height = 34;
  const groupStarts = new Set(spans.map((s) => s.start));
  const allHeaders = [...HEADERS, ...EXTRA_COLUMNS.map((c) => c.header)];
  allHeaders.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.fill = solid(idx >= TRACKER_COLS ? C.slateDark : C.slate);
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: C.white } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      left: groupStarts.has(idx) ? { style: "medium", color: { argb: C.yellow } } : thin(C.slateDark),
      bottom: { style: "medium", color: { argb: C.yellow } },
    };
  });

  // ── Data rows ──────────────────────────────────────────────────────────
  rows.forEach(({ values, closed }, i) => {
    const r = FIRST_DATA_ROW + i;
    const row = ws.getRow(r);
    row.height = 18;
    const zebra = i % 2 === 1;
    const ref = (col: number) => `${colLetter(col)}${r}`;

    values.forEach((value, idx) => {
      const cell = row.getCell(idx + 1);
      const kind = kindOf(idx);
      cell.font = { name: FONT, size: 10, color: { argb: C.slateDark }, bold: idx === COL.REFERENCE };
      if (zebra) cell.fill = solid(C.zebra);
      cell.border = { bottom: thin(C.border), left: groupStarts.has(idx) ? thin(C.slate) : undefined };

      // Day-count columns: the tracker's formula, with our computed value cached for viewers
      // that don't recalculate (and for the importer, which reads cached values).
      const dayFormula = DAY_FORMULA_BY_COL.get(idx);
      if (dayFormula) {
        const { later, earlier } = dayFormula;
        cell.value = {
          formula: `IF(AND(ISNUMBER(${ref(later)}),ISNUMBER(${ref(earlier)})),${ref(later)}-${ref(earlier)},"")`,
          result: value ?? "",
        } as ExcelJS.CellFormulaValue;
      } else if (idx === COL.TOTAL_DAYS_WIP) {
        const close = ref(COL.ACTUAL_JOB_CLOSING);
        const open = ref(COL.JOB_OPENING);
        cell.value = {
          formula: `IF(ISNUMBER(${open}),IF(ISNUMBER(${close}),${close},TODAY())-${open},"")`,
          result: value ?? "",
        } as ExcelJS.CellFormulaValue;
      } else {
        cell.value = value;
      }

      if (DATE_COLUMNS.has(idx) || kind === "date") {
        cell.numFmt = DATE_FMT;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (idx === COL.ORDER_VALUE || kind === "money") {
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (TEXT_COLUMNS.has(idx) || (kind === "text" && EXTRA_COLUMNS[idx - TRACKER_COLS]?.width >= 20)) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: idx === COL.REFERENCE ? "left" : "center", vertical: "middle" };
      }
    });

    // Status pill colors
    const status = row.getCell(COL.STATUS + 1);
    status.fill = solid(closed ? C.successSoft : C.yellowSoft);
    status.font = { name: FONT, size: 9, bold: true, color: { argb: closed ? C.success : C.slateDark } };
    if (values[COL.WAITING_FOR_GO_AHEAD] === "YES") row.getCell(COL.WAITING_FOR_GO_AHEAD + 1).fill = solid(C.yellowSoft);
  });

  const lastDataRow = FIRST_DATA_ROW + Math.max(rows.length, 1) - 1;

  const extraIdx = (header: string) => TRACKER_COLS + EXTRA_COLUMNS.findIndex((c) => c.header === header);
  const highlight = (col: number, rules: ExcelJS.ConditionalFormattingRule[]) => {
    if (rows.length === 0) return;
    const L = colLetter(col);
    ws.addConditionalFormatting({ ref: `${L}${FIRST_DATA_ROW}:${L}${lastDataRow}`, rules });
  };
  const redStyle: Partial<ExcelJS.Style> = {
    fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.dangerSoft } },
    font: { bold: true, color: { argb: C.danger } },
  };
  const greenStyle: Partial<ExcelJS.Style> = {
    fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.successSoft } },
    font: { bold: true, color: { argb: C.success } },
  };

  // More than 7 days late / over target turns red — as in the tracker.
  for (const col of [COL.ASSESSMENT_DAYS, COL.STRIP_QUOTE_DAYS, COL.ASSEMBLY_DAYS]) {
    highlight(col, [{ type: "cellIs", operator: "greaterThan", formulae: ["7"], priority: 1, style: redStyle }]);
  }
  highlight(extraIdx("STAGE STATUS:"), [
    { type: "containsText", operator: "containsText", text: "DELAYED", priority: 1, style: redStyle },
  ]);
  highlight(extraIdx("SLA COMPLIANT:"), [
    { type: "containsText", operator: "containsText", text: "NO", priority: 1, style: redStyle },
    { type: "containsText", operator: "containsText", text: "YES", priority: 2, style: greenStyle },
  ]);

  // ── Totals row ─────────────────────────────────────────────────────────
  // SUBTOTAL(…) ignores rows hidden by the filter, so totals follow whatever is filtered.
  // Column B is left empty so the importer never mistakes this row for a job.
  const totalRow = ws.getRow(lastDataRow + 1);
  totalRow.height = 22;
  for (let c = 1; c <= TOTAL_COLS; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = solid(C.slateDark);
    cell.border = { top: { style: "medium", color: { argb: C.yellow } } };
  }
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = "TOTAL";
  totalLabel.font = { name: FONT, size: 10, bold: true, color: { argb: C.yellow } };
  totalLabel.alignment = { vertical: "middle", indent: 1 };

  const countCell = totalRow.getCell(COL.CUSTOMER + 1);
  countCell.value = { formula: `SUBTOTAL(103,A${FIRST_DATA_ROW}:A${lastDataRow})&" jobs"`, result: `${rows.length} jobs` };
  countCell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
  countCell.alignment = { vertical: "middle" };

  // Sum every money column (order value + the app-only cost/amount columns).
  const moneyCols = [COL.ORDER_VALUE, ...EXTRA_COLUMNS.map((c, i) => (c.kind === "money" ? TRACKER_COLS + i : -1)).filter((i) => i >= 0)];
  for (const col of moneyCols) {
    const L = colLetter(col);
    const cell = totalRow.getCell(col + 1);
    cell.value = {
      formula: `SUBTOTAL(109,${L}${FIRST_DATA_ROW}:${L}${lastDataRow})`,
      result: rows.reduce((s, r) => s + (typeof r.values[col] === "number" ? (r.values[col] as number) : 0), 0),
    };
    cell.numFmt = MONEY_FMT;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  }

  // Filter dropdowns on the column-header row, covering just the job rows.
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastDataRow, column: TOTAL_COLS } };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
