import { HttpError } from "../middleware/errorHandler";

/*
 * One set of date rules for every place a job date is entered — the Create Job form, the stage
 * forms, the job field edits and the Excel import — so the flow the dashboard reads is the flow
 * people entered.
 *
 *  - Actual dates (things that have happened) can't be in the future. Planned dates can.
 *  - Dates should follow the job's flow. Out-of-order dates are a warning, not a block: the user
 *    is shown what looks wrong and can save anyway (outwork and real-life delays do happen).
 *
 * Dates are compared as South African calendar days: form dates arrive as UTC midnight while
 * imported Excel dates arrive as local midnight (22:00 UTC the day before), and both must land
 * on the same day.
 */

type MaybeDate = Date | null | undefined;

export interface FlowDates {
  dateReceived?: MaybeDate;
  jobCreatedDate?: MaybeDate;
  woNumberSetAt?: MaybeDate;
  evaluationDate?: MaybeDate;
  epirocQuotationDate?: MaybeDate;
  purchaseOrderDate?: MaybeDate;
  repairStartDate?: MaybeDate;
  repairCompletionDate?: MaybeDate;
  actualAssemblyDate?: MaybeDate;
  outworkDateSent?: MaybeDate;
  outworkDateReceived?: MaybeDate;
  dispatchDate?: MaybeDate;
  invoiceDate?: MaybeDate;
  closingDate?: MaybeDate;
}

export type FlowField = keyof FlowDates;

/** Field labels as the forms show them. Every field here is an actual (not planned) date. */
export const FLOW_LABELS: Record<FlowField, string> = {
  dateReceived: "Date Received",
  jobCreatedDate: "Job Opening",
  woNumberSetAt: "WO Number Date",
  evaluationDate: "Actual Disassembly",
  epirocQuotationDate: "Date Quoted",
  purchaseOrderDate: "Go-Ahead To Repair",
  repairStartDate: "Repair Start",
  repairCompletionDate: "Repair End",
  actualAssemblyDate: "Actual Assembly",
  outworkDateSent: "Outwork Date Sent",
  outworkDateReceived: "Outwork Date Received",
  dispatchDate: "Actual Dispatch Date",
  invoiceDate: "Invoice Date",
  closingDate: "Actual Job Closing",
};

const FLOW_FIELDS = Object.keys(FLOW_LABELS) as FlowField[];

/**
 * What each date should be on or after, closest step first. Only the first one that's broken is
 * reported, so one wrong date doesn't produce a wall of warnings. (The WO date isn't here: it's a
 * hard rule in the job routes — it can never be before Job Opening.)
 */
const COMES_AFTER: Partial<Record<FlowField, FlowField[]>> = {
  jobCreatedDate: ["dateReceived"],
  evaluationDate: ["jobCreatedDate"],
  epirocQuotationDate: ["evaluationDate", "jobCreatedDate"],
  purchaseOrderDate: ["epirocQuotationDate", "jobCreatedDate"],
  repairStartDate: ["purchaseOrderDate", "jobCreatedDate"],
  repairCompletionDate: ["repairStartDate", "purchaseOrderDate", "jobCreatedDate"],
  actualAssemblyDate: ["purchaseOrderDate", "jobCreatedDate"],
  outworkDateSent: ["jobCreatedDate"],
  outworkDateReceived: ["outworkDateSent", "jobCreatedDate"],
  dispatchDate: ["repairCompletionDate", "actualAssemblyDate", "purchaseOrderDate", "jobCreatedDate"],
  invoiceDate: ["dispatchDate", "jobCreatedDate"],
  closingDate: ["dispatchDate", "jobCreatedDate"],
};

const TIME_ZONE = "Africa/Johannesburg";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const displayFormat = new Intl.DateTimeFormat("en-ZA", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });

/** The South African calendar day of a date, as "YYYY-MM-DD" (sortable). */
export function dayKey(d: Date): string {
  return dayKeyFormat.format(d);
}

function show(d: Date): string {
  return displayFormat.format(d);
}

/** The flow dates of a job loaded with its stage records. */
export function flowDatesOf(job: {
  dateReceived?: MaybeDate;
  jobCreatedDate?: MaybeDate;
  woNumberSetAt?: MaybeDate;
  quotation?: { evaluationDate?: MaybeDate; epirocQuotationDate?: MaybeDate } | null;
  repair?: Pick<FlowDates, "purchaseOrderDate" | "repairStartDate" | "repairCompletionDate" | "actualAssemblyDate" | "outworkDateSent" | "outworkDateReceived"> | null;
  dispatch?: { dispatchDate?: MaybeDate } | null;
  invoice?: { invoiceDate?: MaybeDate; closingDate?: MaybeDate } | null;
}): FlowDates {
  return {
    dateReceived: job.dateReceived,
    jobCreatedDate: job.jobCreatedDate,
    woNumberSetAt: job.woNumberSetAt,
    evaluationDate: job.quotation?.evaluationDate,
    epirocQuotationDate: job.quotation?.epirocQuotationDate,
    purchaseOrderDate: job.repair?.purchaseOrderDate,
    repairStartDate: job.repair?.repairStartDate,
    repairCompletionDate: job.repair?.repairCompletionDate,
    actualAssemblyDate: job.repair?.actualAssemblyDate,
    outworkDateSent: job.repair?.outworkDateSent,
    outworkDateReceived: job.repair?.outworkDateReceived,
    dispatchDate: job.dispatch?.dispatchDate,
    invoiceDate: job.invoice?.invoiceDate,
    closingDate: job.invoice?.closingDate,
  };
}

/** The flow-date fields present in a request body (or any object), with their values. */
export function pickFlowDates(data: object): FlowDates {
  const out: FlowDates = {};
  for (const [key, value] of Object.entries(data)) {
    if ((FLOW_FIELDS as string[]).includes(key) && value instanceof Date) out[key as FlowField] = value;
  }
  return out;
}

/** Problems with actual dates set in the future, one message per date. */
export function futureDateProblems(dates: FlowDates, now = new Date()): string[] {
  const today = dayKey(now);
  return FLOW_FIELDS.filter((f) => {
    const d = dates[f];
    return d && dayKey(d) > today;
  }).map((f) => `${FLOW_LABELS[f]} can't be in the future (${show(dates[f]!)})`);
}

/** Hard rule: rejects the request when any actual date in it is in the future. */
export function assertNoFutureDates(dates: FlowDates, now = new Date()): void {
  const problems = futureDateProblems(dates, now);
  if (problems.length) throw new HttpError(400, `${problems.join(". ")}.`);
}

/**
 * Out-of-order dates in a job, as readable warnings. With `changed`, only problems involving a
 * date being saved are reported — an old mistake elsewhere in the job doesn't block an unrelated
 * edit. Without it (the import), every problem is reported.
 */
export function dateOrderWarnings(dates: FlowDates, changed?: Iterable<FlowField>): string[] {
  const touched = changed ? new Set(changed) : null;
  const warnings: string[] = [];

  for (const field of FLOW_FIELDS) {
    const date = dates[field];
    if (!date) continue;
    const broken = (COMES_AFTER[field] ?? []).find((before) => {
      const earlier = dates[before];
      return earlier && dayKey(date) < dayKey(earlier);
    });
    if (!broken) continue;
    if (touched && !touched.has(field) && !touched.has(broken)) continue;
    warnings.push(`${FLOW_LABELS[field]} (${show(date)}) is before ${FLOW_LABELS[broken]} (${show(dates[broken]!)})`);
  }

  // The flow needs the quote date before the go-ahead counts — without it the job stays in Quotation.
  if (dates.purchaseOrderDate && !dates.epirocQuotationDate && (!touched || touched.has("purchaseOrderDate"))) {
    warnings.push("Go-Ahead To Repair is set but there's no Date Quoted — the job stays in the Quotation stage until it's entered");
  }
  return warnings;
}

/**
 * Stops the save with the warnings (409) unless the user has already seen them and chose to save
 * anyway (`confirmDateWarnings: true` in the request body).
 */
export function requireWarningsConfirmed(warnings: string[], body: unknown): void {
  if (warnings.length === 0) return;
  if ((body as { confirmDateWarnings?: unknown } | null)?.confirmDateWarnings === true) return;
  throw new HttpError(409, "Some dates look out of order", { dateWarnings: warnings });
}

/**
 * The full check a save runs: no future actual dates (hard), then out-of-order warnings for the
 * dates being saved, merged over what the job already has.
 */
export function checkJobDates(current: FlowDates, changes: FlowDates, body: unknown, now = new Date()): void {
  assertNoFutureDates(changes, now);
  const merged = { ...current, ...changes };
  requireWarningsConfirmed(dateOrderWarnings(merged, Object.keys(changes) as FlowField[]), body);
}
