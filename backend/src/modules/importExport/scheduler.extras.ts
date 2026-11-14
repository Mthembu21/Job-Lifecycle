import { Priority } from "@prisma/client";
import { cellToDate, cellToNumber, cellToString, MappedSchedulerRow } from "./scheduler.mapping";

/*
 * App-only columns — every job field the app stores that the original "SCHEDULER 2025" tracker has
 * no column for. They're appended to the right of the tracker's 42 columns (so the tracker layout
 * is untouched) and are read back by the importer by header text, so an exported workbook
 * re-imports without losing anything.
 */

export type ExtraKind = "text" | "date" | "money" | "number";

/** Minimal shape the export reads from (a Job with its stage relations and user names). */
export interface ExportJob {
  woNumber: string | null;
  woNumberSetAt: Date | null;
  poNumber: string | null;
  priority: Priority;
  forecastMonth: string | null;
  forecastAmount: number | null;
  createdBy: { name: string } | null;
  updatedAt: Date;
  quotation: {
    quotationAmount: number | null;
    comments: string | null;
    delayReason: string | null;
    quotedBy: { name: string } | null;
  } | null;
  repair: {
    purchaseOrderNumber: string | null;
    technicianName: string | null;
    labourHours: number | null;
    partsCost: number | null;
    totalRepairCost: number | null;
    comments: string | null;
    delayReason: string | null;
  } | null;
  dispatch: {
    courier: string | null;
    trackingNumber: string | null;
    comments: string | null;
    delayReason: string | null;
    dispatchedBy: { name: string } | null;
  } | null;
  invoice: {
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    invoiceAmount: number | null;
    delayReason: string | null;
    closedWithoutInvoice: boolean | null;
  } | null;
}

/** Derived status columns, filled in by the exporter. */
export interface ExportStatus {
  stageStatus: string;
  daysInStage: number | null;
  slaCompliant: boolean;
}

export interface ExtraColumn {
  header: string;
  kind: ExtraKind;
  width: number;
  get: (job: ExportJob, status: ExportStatus) => string | number | Date | null | undefined;
  /** Omitted for derived / read-only columns. */
  set?: (row: MappedSchedulerRow, value: unknown) => void;
}

export interface ExtraGroup {
  label: string;
  columns: ExtraColumn[];
}

const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];

const text = (v: unknown) => cellToString(v);
const date = (v: unknown) => cellToDate(v);
const num = (v: unknown) => cellToNumber(v);

function section<K extends "quotation" | "repair" | "dispatch" | "invoice">(row: MappedSchedulerRow, key: K) {
  return (row[key] ??= {} as NonNullable<MappedSchedulerRow[K]>) as NonNullable<MappedSchedulerRow[K]>;
}

/** Assign only when the cell has a value, so empty cells never create empty stage records. */
function assign<T extends object, K extends keyof T>(target: () => T, key: K, value: T[K] | undefined) {
  if (value !== undefined) target()[key] = value;
}

export const EXTRA_GROUPS: ExtraGroup[] = [
  {
    label: "WORK ORDER & PO:",
    columns: [
      { header: "WO NUMBER:", kind: "text", width: 14, get: (j) => j.woNumber, set: (r, v) => assign(() => r.job, "woNumber", text(v)) },
      { header: "WO NUMBER DATE:", kind: "date", width: 14, get: (j) => j.woNumberSetAt, set: (r, v) => assign(() => r.job, "woNumberSetAt", date(v)) },
      { header: "PO NUMBER:", kind: "text", width: 14, get: (j) => j.poNumber, set: (r, v) => assign(() => r.job, "poNumber", text(v)) },
      {
        header: "PRIORITY:",
        kind: "text",
        width: 11,
        get: (j) => j.priority,
        set: (r, v) => {
          const p = text(v)?.toUpperCase() as Priority | undefined;
          if (p && PRIORITIES.includes(p)) r.job.priority = p;
        },
      },
      { header: "CREATED BY:", kind: "text", width: 16, get: (j) => j.createdBy?.name },
    ],
  },
  {
    label: "QUOTATION DETAIL:",
    columns: [
      { header: "QUOTATION AMOUNT:", kind: "money", width: 16, get: (j) => j.quotation?.quotationAmount, set: (r, v) => assign(() => section(r, "quotation"), "quotationAmount", num(v)) },
      { header: "QUOTED BY:", kind: "text", width: 16, get: (j) => j.quotation?.quotedBy?.name, set: (r, v) => assign(() => section(r, "quotation"), "quotedByName", text(v)) },
      { header: "QUOTATION COMMENTS:", kind: "text", width: 28, get: (j) => j.quotation?.comments, set: (r, v) => assign(() => section(r, "quotation"), "comments", text(v)) },
      { header: "QUOTATION DELAY REASON:", kind: "text", width: 28, get: (j) => j.quotation?.delayReason, set: (r, v) => assign(() => section(r, "quotation"), "delayReason", text(v)) },
    ],
  },
  {
    label: "REPAIR DETAIL:",
    columns: [
      { header: "REPAIR PO NUMBER:", kind: "text", width: 15, get: (j) => j.repair?.purchaseOrderNumber, set: (r, v) => assign(() => section(r, "repair"), "purchaseOrderNumber", text(v)) },
      { header: "TECHNICIAN:", kind: "text", width: 16, get: (j) => j.repair?.technicianName, set: (r, v) => assign(() => section(r, "repair"), "technicianName", text(v)) },
      { header: "LABOUR HOURS:", kind: "number", width: 11, get: (j) => j.repair?.labourHours, set: (r, v) => assign(() => section(r, "repair"), "labourHours", num(v)) },
      { header: "PARTS COST:", kind: "money", width: 15, get: (j) => j.repair?.partsCost, set: (r, v) => assign(() => section(r, "repair"), "partsCost", num(v)) },
      { header: "TOTAL REPAIR COST:", kind: "money", width: 16, get: (j) => j.repair?.totalRepairCost, set: (r, v) => assign(() => section(r, "repair"), "totalRepairCost", num(v)) },
      { header: "REPAIR COMMENTS:", kind: "text", width: 28, get: (j) => j.repair?.comments, set: (r, v) => assign(() => section(r, "repair"), "comments", text(v)) },
      { header: "REPAIR DELAY REASON:", kind: "text", width: 28, get: (j) => j.repair?.delayReason, set: (r, v) => assign(() => section(r, "repair"), "delayReason", text(v)) },
    ],
  },
  {
    label: "DISPATCH DETAIL:",
    columns: [
      { header: "COURIER:", kind: "text", width: 15, get: (j) => j.dispatch?.courier, set: (r, v) => assign(() => section(r, "dispatch"), "courier", text(v)) },
      { header: "TRACKING NUMBER:", kind: "text", width: 18, get: (j) => j.dispatch?.trackingNumber, set: (r, v) => assign(() => section(r, "dispatch"), "trackingNumber", text(v)) },
      { header: "DISPATCHED BY:", kind: "text", width: 16, get: (j) => j.dispatch?.dispatchedBy?.name, set: (r, v) => assign(() => section(r, "dispatch"), "dispatchedByName", text(v)) },
      { header: "DISPATCH COMMENTS:", kind: "text", width: 28, get: (j) => j.dispatch?.comments, set: (r, v) => assign(() => section(r, "dispatch"), "comments", text(v)) },
      { header: "DISPATCH DELAY REASON:", kind: "text", width: 28, get: (j) => j.dispatch?.delayReason, set: (r, v) => assign(() => section(r, "dispatch"), "delayReason", text(v)) },
    ],
  },
  {
    label: "INVOICE DETAIL:",
    columns: [
      { header: "INVOICE NUMBER:", kind: "text", width: 15, get: (j) => j.invoice?.invoiceNumber, set: (r, v) => assign(() => section(r, "invoice"), "invoiceNumber", text(v)) },
      { header: "INVOICE DATE:", kind: "date", width: 13, get: (j) => j.invoice?.invoiceDate, set: (r, v) => assign(() => section(r, "invoice"), "invoiceDate", date(v)) },
      { header: "INVOICE AMOUNT:", kind: "money", width: 16, get: (j) => j.invoice?.invoiceAmount, set: (r, v) => assign(() => section(r, "invoice"), "invoiceAmount", num(v)) },
      { header: "INVOICE DELAY REASON:", kind: "text", width: 28, get: (j) => j.invoice?.delayReason, set: (r, v) => assign(() => section(r, "invoice"), "delayReason", text(v)) },
      {
        header: "CLOSED WITHOUT INVOICE:",
        kind: "text",
        width: 13,
        get: (j) => (j.invoice?.closedWithoutInvoice ? "YES" : null),
        set: (r, v) => {
          if (text(v)?.toUpperCase() === "YES") section(r, "invoice").closedWithoutInvoice = true;
        },
      },
    ],
  },
  {
    label: "INVOICE FORECAST:",
    columns: [
      {
        header: "FORECAST MONTH:",
        kind: "text",
        width: 13,
        get: (j) => j.forecastMonth,
        set: (r, v) => {
          // Accept "2026-11" text, or a date cell (Excel may turn the text into a date).
          const d = date(v);
          const m = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : text(v);
          if (m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)) r.job.forecastMonth = m;
        },
      },
      { header: "FORECAST AMOUNT:", kind: "money", width: 16, get: (j) => j.forecastAmount, set: (r, v) => assign(() => r.job, "forecastAmount", num(v)) },
    ],
  },
  {
    label: "STATUS & SLA:",
    columns: [
      { header: "STAGE STATUS:", kind: "text", width: 13, get: (_j, s) => s.stageStatus },
      { header: "DAYS IN STAGE:", kind: "number", width: 10, get: (_j, s) => s.daysInStage },
      { header: "SLA COMPLIANT:", kind: "text", width: 11, get: (_j, s) => (s.slaCompliant ? "YES" : "NO") },
      { header: "LAST UPDATED:", kind: "date", width: 13, get: (j) => j.updatedAt },
    ],
  },
];

export const EXTRA_COLUMNS: ExtraColumn[] = EXTRA_GROUPS.flatMap((g) => g.columns);

const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();

/** Locates each importable app-only column in a header row → [column index, column]. */
export function locateExtraColumns(headerRow: unknown[]): Array<[number, ExtraColumn]> {
  const found: Array<[number, ExtraColumn]> = [];
  for (const col of EXTRA_COLUMNS) {
    if (!col.set) continue;
    const idx = headerRow.findIndex((h) => norm(h) === col.header);
    if (idx >= 0) found.push([idx, col]);
  }
  return found;
}
