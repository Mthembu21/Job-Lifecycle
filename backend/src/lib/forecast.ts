import { prisma } from "./prisma";
import { jobAsOf } from "./asOf";
import { deriveJobStatus, StageName } from "./statusEngine";
import { JobWithListRelations } from "../modules/jobs/jobs.dto";

/*
 * Invoice forecasting.
 *
 * Planners give each job a forecast month ("YYYY-MM") and amount. A month's forecast is FROZEN as it
 * stood when the previous calendar month ended, and that frozen ("committed") forecast is what the
 * month's actual invoicing is measured against — later edits can't rewrite history.
 *
 * Freezing is lazy but exact: ensureForecastsFrozen() runs before anything that can change forecasts
 * (forecast edits, job deletes, imports) and before every forecast report. Since nothing can change a
 * forecast without freezing first, the snapshot taken at the first such moment after the month starts
 * is identical to the forecast at the moment the previous month ended.
 */

export const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" in the server's local calendar (same convention as the dashboard). */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m, 1));
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

async function freezeMonth(month: string, provisional: boolean) {
  // Claim the month first (unique index): if another request is already freezing it, stop here.
  try {
    await prisma.forecastFreeze.create({ data: { month, provisional } });
  } catch (e) {
    if (isUniqueViolation(e)) return;
    throw e;
  }
  if (provisional) return;

  const jobs = await prisma.job.findMany({
    where: { forecastMonth: month },
    select: { id: true, referenceNumber: true, customer: true, forecastAmount: true },
  });
  for (const job of jobs) {
    try {
      await prisma.forecastSnapshot.create({
        data: {
          month,
          jobId: job.id,
          referenceNumber: job.referenceNumber,
          customer: job.customer,
          amount: job.forecastAmount ?? 0,
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
}

/** Freezes every month that has started but isn't frozen yet. Call before changing any forecast. */
export async function ensureForecastsFrozen(now = new Date()): Promise<void> {
  const current = monthKeyOf(now);
  const latest = await prisma.forecastFreeze.findFirst({ orderBy: { month: "desc" } });

  if (!latest) {
    // Forecasting goes live this month: nothing was forecast before it started, so this first month
    // is compared against the live forecast (flagged as provisional in the report).
    await freezeMonth(current, true);
    return;
  }
  for (let m = nextMonthKey(latest.month); m <= current; m = nextMonthKey(m)) {
    await freezeMonth(m, false);
  }
}

// ── Report ────────────────────────────────────────────────────────────────

export type ForecastOutcome =
  | "INVOICED" // forecast for the month and invoiced in it
  | "INVOICED_EARLY" // forecast for the month but invoiced before it started
  | "PENDING" // current month: forecast, not invoiced yet
  | "SLIPPED" // past month: forecast, not invoiced in the month
  | "UNPLANNED" // invoiced in the month without being forecast for it
  | "CLOSED_NO_INVOICE" // forecast, but closed as an internal job with no invoice
  | "REMOVED"; // forecast, but the job has since been deleted

/** Where a not-yet-invoiced job was stuck at month end — the headline "cause". */
const STAGE_CAUSE: Record<Exclude<StageName, "CLOSED">, string> = {
  QUOTATION: "Waiting for quotation",
  AWAITING_PO: "Waiting for PO / go-ahead",
  REPAIR: "Repair not complete",
  DISPATCH: "Waiting for dispatch",
  INVOICING: "Invoice not raised",
};

const STAGE_NAME: Record<Exclude<StageName, "CLOSED">, string> = {
  QUOTATION: "Quotation",
  AWAITING_PO: "PO",
  REPAIR: "Repair",
  DISPATCH: "Dispatch",
  INVOICING: "Invoicing",
};

export interface ForecastFactor {
  text: string;
  /** "danger" = over SLA target; "warning" = worth noting (e.g. no WO number); "info" = context. */
  tone: "danger" | "warning" | "info";
}

export interface ForecastRow {
  jobId: string;
  referenceNumber: string;
  customer: string;
  outcome: ForecastOutcome;
  forecastAmount: number | null;
  invoicedAmount: number | null;
  invoiceDate: string | null;
  /** The job's forecast month today (shows where a slipped job has been moved to). */
  currentForecastMonth: string | null;
  cause: string | null;
  missingWo: boolean;
  factors: ForecastFactor[];
  note: { comment: string; by: string; at: string } | null;
}

const DAY_MS = 86_400_000;
const money = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

/** Explains why a job wasn't invoiced, from where it stood at `asOf`. */
function explain(job: JobWithListRelations, asOf: Date) {
  const then = jobAsOf(job, asOf);
  const status = deriveJobStatus(then, asOf);
  const factors: ForecastFactor[] = [];
  let cause: string | null = null;

  if (status.currentStage !== "CLOSED") {
    const stage = status.currentStage;
    const info = status.stages.find((s) => s.name === stage);
    cause = STAGE_CAUSE[stage];
    if (info?.sla.days !== null && info?.sla.days !== undefined) {
      const over = info.sla.status === "RED";
      factors.push({
        text: `${cause} — ${info.sla.days} day${info.sla.days === 1 ? "" : "s"} (target ${info.sla.target})`,
        tone: over ? "danger" : "info",
      });
    } else {
      factors.push({ text: cause, tone: "info" });
    }
    // Earlier stages that blew their SLA also explain the slip.
    for (const s of status.stages) {
      if (s.name === stage) break;
      if (s.sla.status === "RED" && s.sla.days !== null) {
        factors.push({ text: `${STAGE_NAME[s.name]} took ${s.sla.days} days (target ${s.sla.target})`, tone: "danger" });
      }
    }
  }

  const missingWo = !then.woNumber;
  if (missingWo) {
    const days = Math.max(0, Math.floor((asOf.getTime() - job.jobCreatedDate.getTime()) / DAY_MS));
    factors.unshift({ text: `No WO number — ${days} days since job opening`, tone: "warning" });
  }

  // Delay reasons planners recorded on the stages.
  const reasons: Array<[string, string | null | undefined]> = [
    ["Quotation", job.quotation?.delayReason],
    ["Repair", job.repair?.delayReason],
    ["Dispatch", job.dispatch?.delayReason],
    ["Invoice", job.invoice?.delayReason],
  ];
  for (const [stage, reason] of reasons) {
    if (reason) factors.push({ text: `${stage} delay: ${reason}`, tone: "info" });
  }

  return { cause, missingWo, factors };
}

export async function buildForecastReport(rawJobs: JobWithListRelations[], year: number, month: number, now = new Date()) {
  await ensureForecastsFrozen(now);

  const key = `${year}-${String(month).padStart(2, "0")}`;
  const start = new Date(year, month - 1, 1);
  const endOfMonth = new Date(new Date(year, month, 1).getTime() - 1);
  const isCurrentMonth = endOfMonth.getTime() > now.getTime();
  const asOf = isCurrentMonth ? now : endOfMonth;

  const [freeze, firstFreeze, snapshots, notes] = await Promise.all([
    prisma.forecastFreeze.findUnique({ where: { month: key } }),
    prisma.forecastFreeze.findFirst({ orderBy: { month: "asc" } }),
    prisma.forecastSnapshot.findMany({ where: { month: key } }),
    prisma.forecastNote.findMany({ where: { month: key } }),
  ]);

  // Months before forecasting existed have nothing to compare.
  const tracked = Boolean(firstFreeze && key >= firstFreeze.month);
  const provisional = Boolean(freeze?.provisional);
  const jobsById = new Map(rawJobs.map((j) => [j.id, j]));
  const noteByJob = new Map(notes.map((n) => [n.jobId, n]));

  // Committed forecast: the frozen snapshot — or, in the provisional first month, the live forecast.
  const committed = new Map<string, { referenceNumber: string; customer: string; amount: number }>();
  if (provisional) {
    for (const j of rawJobs) {
      if (j.forecastMonth === key) committed.set(j.id, { referenceNumber: j.referenceNumber, customer: j.customer, amount: j.forecastAmount ?? 0 });
    }
  } else {
    for (const s of snapshots) committed.set(s.jobId, { referenceNumber: s.referenceNumber, customer: s.customer, amount: s.amount });
  }

  const inMonth = (d: Date | null | undefined) => !!d && d.getTime() >= start.getTime() && d.getTime() <= asOf.getTime();
  const rows: ForecastRow[] = [];

  const noteFor = (jobId: string) => {
    const n = noteByJob.get(jobId);
    return n ? { comment: n.comment, by: n.updatedByName, at: n.updatedAt.toISOString() } : null;
  };

  for (const [jobId, fc] of committed) {
    const job = jobsById.get(jobId);
    if (!job) {
      rows.push({
        jobId, referenceNumber: fc.referenceNumber, customer: fc.customer, outcome: "REMOVED",
        forecastAmount: fc.amount, invoicedAmount: null, invoiceDate: null, currentForecastMonth: null,
        cause: "Job deleted", missingWo: false, factors: [{ text: "Job was deleted after the forecast was set", tone: "info" }],
        note: noteFor(jobId),
      });
      continue;
    }
    const invoiceDate = job.invoice?.invoiceDate ?? null;
    const invoicedAmount = job.invoice?.invoiceAmount ?? null;
    const base = {
      jobId, referenceNumber: job.referenceNumber, customer: job.customer,
      forecastAmount: fc.amount, currentForecastMonth: job.forecastMonth ?? null, note: noteFor(jobId),
    };

    if (inMonth(invoiceDate)) {
      const factors: ForecastFactor[] = [];
      const diff = (invoicedAmount ?? 0) - fc.amount;
      if (Math.abs(diff) >= 1) {
        factors.push({ text: `Invoiced ${money(invoicedAmount ?? 0)} vs forecast ${money(fc.amount)} (${diff > 0 ? "+" : "−"}${money(Math.abs(diff))})`, tone: diff < 0 ? "warning" : "info" });
      }
      rows.push({ ...base, outcome: "INVOICED", invoicedAmount, invoiceDate: invoiceDate!.toISOString(), cause: null, missingWo: false, factors });
    } else if (invoiceDate && invoiceDate.getTime() < start.getTime()) {
      rows.push({
        ...base, outcome: "INVOICED_EARLY", invoicedAmount, invoiceDate: invoiceDate.toISOString(), cause: "Invoiced early",
        missingWo: false, factors: [{ text: `Invoiced early, on ${fmtDate(invoiceDate)}`, tone: "info" }],
      });
    } else if (job.invoice?.closedWithoutInvoice && job.invoice.closingDate && job.invoice.closingDate.getTime() <= asOf.getTime()) {
      // Forecast to invoice, but it turned out to be an internal job closed with no invoice.
      rows.push({
        ...base, outcome: "CLOSED_NO_INVOICE", invoicedAmount: null, invoiceDate: null, cause: "Closed without invoice (internal)",
        missingWo: false, factors: [{ text: `Closed without invoice on ${fmtDate(job.invoice.closingDate)} — internal job`, tone: "warning" }],
      });
    } else {
      const why = explain(job, asOf);
      if (invoiceDate) why.factors.unshift({ text: `Invoiced later, on ${fmtDate(invoiceDate)}`, tone: "info" });
      rows.push({
        ...base, outcome: isCurrentMonth ? "PENDING" : "SLIPPED", invoicedAmount: null, invoiceDate: null,
        cause: why.cause, missingWo: why.missingWo, factors: why.factors,
      });
    }
  }

  // Invoiced this month without being in the committed forecast.
  for (const job of rawJobs) {
    if (committed.has(job.id) || !inMonth(job.invoice?.invoiceDate)) continue;
    const factors: ForecastFactor[] = [
      { text: job.forecastMonth ? `Was forecast for ${job.forecastMonth}` : "No forecast was set", tone: "info" },
    ];
    rows.push({
      jobId: job.id, referenceNumber: job.referenceNumber, customer: job.customer, outcome: "UNPLANNED",
      forecastAmount: null, invoicedAmount: job.invoice?.invoiceAmount ?? null, invoiceDate: job.invoice!.invoiceDate!.toISOString(),
      currentForecastMonth: job.forecastMonth ?? null, cause: null, missingWo: false, factors, note: noteFor(job.id),
    });
  }

  const ORDER: Record<ForecastOutcome, number> = { SLIPPED: 0, PENDING: 1, CLOSED_NO_INVOICE: 2, REMOVED: 3, INVOICED: 4, INVOICED_EARLY: 5, UNPLANNED: 6 };
  rows.sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || (b.forecastAmount ?? b.invoicedAmount ?? 0) - (a.forecastAmount ?? a.invoicedAmount ?? 0));

  const sum = (xs: Array<number | null>) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
  const forecastRows = rows.filter((r) => r.outcome !== "UNPLANNED");
  const notInvoiced = rows.filter((r) => r.outcome === "SLIPPED" || r.outcome === "PENDING" || r.outcome === "CLOSED_NO_INVOICE");
  const invoicedRows = rows.filter((r) => r.outcome === "INVOICED" || r.outcome === "UNPLANNED");

  // Where the not-invoiced money was stuck.
  const causeMap = new Map<string, { cause: string; count: number; amount: number }>();
  for (const r of notInvoiced) {
    const c = r.cause ?? "Other";
    const entry = causeMap.get(c) ?? { cause: c, count: 0, amount: 0 };
    entry.count++;
    entry.amount += r.forecastAmount ?? 0;
    causeMap.set(c, entry);
  }
  const noWo = notInvoiced.filter((r) => r.missingWo);

  const forecastTotal = sum(forecastRows.map((r) => r.forecastAmount));
  const invoicedTotal = sum(invoicedRows.map((r) => r.invoicedAmount));

  return {
    month: key,
    tracked,
    provisional,
    isCurrentMonth,
    asOf: asOf.toISOString(),
    summary: {
      forecastTotal,
      forecastCount: forecastRows.length,
      invoicedTotal,
      invoicedCount: invoicedRows.length,
      achievedPercent: forecastTotal > 0 ? Math.round((invoicedTotal / forecastTotal) * 100) : null,
      deliveredTotal: sum(rows.filter((r) => r.outcome === "INVOICED").map((r) => r.invoicedAmount)),
      deliveredCount: rows.filter((r) => r.outcome === "INVOICED").length,
      /** Forecast amount of the individual forecast jobs that haven't been invoiced (job-level view). */
      notInvoicedTotal: sum(notInvoiced.map((r) => r.forecastAmount)),
      notInvoicedCount: notInvoiced.length,
      /** Still needed to reach the forecast: forecast − everything invoiced in the month (incl. unplanned). */
      remainingTotal: Math.max(0, forecastTotal - invoicedTotal),
      /** Invoiced beyond the forecast (0 unless the forecast was exceeded). */
      aboveForecastTotal: Math.max(0, invoicedTotal - forecastTotal),
      unplannedTotal: sum(rows.filter((r) => r.outcome === "UNPLANNED").map((r) => r.invoicedAmount)),
      unplannedCount: rows.filter((r) => r.outcome === "UNPLANNED").length,
      /** Live forecast for this month right now (what planners currently expect). */
      latestForecastTotal: sum(rawJobs.filter((j) => j.forecastMonth === key).map((j) => j.forecastAmount)),
    },
    causes: [...causeMap.values()].sort((a, b) => b.amount - a.amount),
    noWo: { count: noWo.length, amount: sum(noWo.map((r) => r.forecastAmount)) },
    rows,
  };
}

export type ForecastReport = Awaited<ReturnType<typeof buildForecastReport>>;
