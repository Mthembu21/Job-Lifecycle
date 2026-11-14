import { prisma } from "./prisma";
import { jobAsOf } from "./asOf";
import { DerivedJobStatus, deriveJobStatus } from "./statusEngine";
import { daysBetween } from "./sla";
import { JOB_TYPE_LABELS, SlaStage, STAGE_LABELS } from "./labels";
import { monthKeyOf, monthWindow, nextMonthKey } from "./months";
import { hasPurchaseOrder, isNonInvoicedJobType } from "./jobTypes";
import { JobWithListRelations } from "../modules/jobs/jobs.dto";

const money = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
const fmtMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
};

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

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/** Saves the live forecast for `month` as its committed (locked) forecast. */
async function snapshotLiveForecast(month: string) {
  const jobs = await prisma.job.findMany({
    where: { forecastMonth: month },
    select: { id: true, referenceNumber: true, customer: true, forecastAmount: true },
  });
  // Only the claimant gets here, so any rows already present are from an interrupted freeze.
  await prisma.forecastSnapshot.deleteMany({ where: { month } });
  if (jobs.length === 0) return;
  await prisma.forecastSnapshot.createMany({
    data: jobs.map((job) => ({
      month,
      jobId: job.id,
      referenceNumber: job.referenceNumber,
      customer: job.customer,
      amount: job.forecastAmount ?? 0,
    })),
  });
}

async function freezeMonth(month: string, provisional: boolean) {
  // Claim the month first (unique index): if another request is already freezing it, stop here.
  try {
    await prisma.forecastFreeze.create({ data: { month, provisional, lockedAt: provisional ? null : new Date() } });
  } catch (e) {
    if (isUniqueViolation(e)) return;
    throw e;
  }
  if (!provisional) await snapshotLiveForecast(month);
}

/**
 * Freezes every month that has started but isn't frozen yet, and locks a provisional (launch) month
 * once it has ended. Call before changing any forecast.
 */
export async function ensureForecastsFrozen(now = new Date()): Promise<void> {
  const current = monthKeyOf(now);

  // A provisional month used the live forecast while it ran; lock it as it stood when it ended.
  const unlocked = await prisma.forecastFreeze.findMany({ where: { provisional: true, lockedAt: null, month: { lt: current } } });
  for (const freeze of unlocked) {
    // Claim it (only one request wins the update), then snapshot.
    const claimed = await prisma.forecastFreeze.updateMany({ where: { id: freeze.id, lockedAt: null }, data: { lockedAt: new Date() } });
    if (claimed.count === 1) await snapshotLiveForecast(freeze.month);
  }

  const latest = await prisma.forecastFreeze.findFirst({ orderBy: { month: "desc" } });
  if (!latest) {
    // Forecasting goes live this month: nothing was forecast before it started, so this first month
    // is compared against the live forecast while it runs (flagged as provisional in the report).
    await freezeMonth(current, true);
    return;
  }
  for (let m = nextMonthKey(latest.month); m <= current; m = nextMonthKey(m)) {
    await freezeMonth(m, false);
  }
}

/** The month before the current one — the only past month that can still be backdated. */
export function previousMonthKey(now = new Date()): string {
  return monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

/**
 * Backdating: add or change forecast entries for the previous (already ended) month. They go straight
 * into that month's committed forecast, marked as backdated. Entries that were locked when the month
 * ended are never changed or removed here.
 */
export async function applyBackdatedForecast(
  month: string,
  set: { jobId: string; amount: number }[],
  clear: string[],
  userId: string
): Promise<number> {
  await ensureForecastsFrozen();
  const [y, m] = month.split("-").map(Number);
  const { start, endOfMonth } = monthWindow(y, m);

  // Make sure the month counts as tracked (a month before forecasting went live has no record yet).
  await prisma.forecastFreeze.upsert({
    where: { month },
    create: { month, provisional: false, lockedAt: new Date() },
    update: {},
  });

  const ids = [...set.map((s) => s.jobId), ...clear];
  const [jobs, existing] = await Promise.all([
    prisma.job.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        referenceNumber: true,
        customer: true,
        jobType: true,
        jobCreatedDate: true,
        poNumber: true,
        repair: { select: { purchaseOrderNumber: true, purchaseOrderDate: true } },
        invoice: { select: { invoiceDate: true } },
      },
    }),
    prisma.forecastSnapshot.findMany({ where: { month, jobId: { in: ids } } }),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rowByJob = new Map(existing.map((r) => [r.jobId, r]));
  const audit: { jobId: string; summary: string }[] = [];
  const label = fmtMonth(month);

  for (const { jobId, amount } of set) {
    const job = jobById.get(jobId);
    const row = rowByJob.get(jobId);
    if (!job || isNonInvoicedJobType(job.jobType) || !hasPurchaseOrder(job)) continue;
    // Only jobs that were open during the month: opened by its end, not invoiced before it began.
    if (job.jobCreatedDate > endOfMonth || (job.invoice?.invoiceDate && job.invoice.invoiceDate < start)) continue;
    if (row && (!row.backdated || row.amount === amount)) continue; // locked at month end, or unchanged
    await prisma.forecastSnapshot.upsert({
      where: { month_jobId: { month, jobId } },
      create: { month, jobId, referenceNumber: job.referenceNumber, customer: job.customer, amount, backdated: true },
      update: { amount },
    });
    audit.push({ jobId, summary: `Backdated forecast for ${label}: ${row ? `${money(row.amount)} -> ` : ""}${money(amount)}` });
  }

  for (const jobId of clear) {
    const row = rowByJob.get(jobId);
    if (!row?.backdated) continue; // only backdated entries can be removed
    await prisma.forecastSnapshot.delete({ where: { id: row.id } });
    if (jobById.has(jobId)) audit.push({ jobId, summary: `Backdated forecast for ${label} removed (${money(row.amount)})` });
  }

  if (audit.length > 0) {
    await prisma.jobAuditLog.createMany({
      data: audit.map((a) => ({ ...a, stage: "FORECAST", action: "BACKDATE", comment: null, changedById: userId })),
    });
  }
  return audit.length;
}

/** Committed forecast rows for a month (for the Forecast page's backdating view). */
export function committedForecast(month: string) {
  return prisma.forecastSnapshot.findMany({
    where: { month },
    select: { jobId: true, amount: true, backdated: true },
  });
}

// ── Report ────────────────────────────────────────────────────────────────

export type ForecastOutcome =
  | "INVOICED" // forecast for the month and invoiced in it
  | "INVOICED_EARLY" // forecast for the month but invoiced before it started
  | "PENDING" // current month: forecast, not invoiced yet
  | "SLIPPED" // past month: forecast, not invoiced in the month
  | "UNPLANNED" // invoiced in the month without being forecast for it
  | "CLOSED_NO_INVOICE" // forecast, but closed as an internal / warranty job with no invoice
  | "REMOVED"; // forecast, but the job has since been deleted

/** Forecast that didn't turn into an invoice in the month. */
const NOT_INVOICED_OUTCOMES: ForecastOutcome[] = ["SLIPPED", "PENDING", "CLOSED_NO_INVOICE"];

/** Where a not-yet-invoiced job was stuck at month end — the headline "cause". */
const STAGE_CAUSE: Record<SlaStage, string> = {
  QUOTATION: "Waiting for quotation",
  AWAITING_PO: "Waiting for PO / go-ahead",
  REPAIR: "Repair not complete",
  DISPATCH: "Waiting for dispatch",
  INVOICING: "Invoice not raised",
};

/** Stage names as used in "<stage> took N days" ("PO took…" reads better than "Awaiting PO took…"). */
const STAGE_NAME: Record<SlaStage, string> = { ...STAGE_LABELS, AWAITING_PO: "PO" };

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
  /** Added to the month's forecast after the month ended (backdated). */
  backdated: boolean;
}

/** Explains why a job wasn't invoiced, from where it stood at `asOf` (`then` = the job rewound to it). */
function explain(job: JobWithListRelations, then: JobWithListRelations, status: DerivedJobStatus, asOf: Date) {
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
    const days = Math.max(0, daysBetween(job.jobCreatedDate, asOf));
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

export async function buildForecastReport(
  rawJobs: JobWithListRelations[],
  year: number,
  month: number,
  now = new Date(),
  { skipFreeze = false, data }: { skipFreeze?: boolean; data?: ForecastData } = {}
) {
  if (!skipFreeze) await ensureForecastsFrozen(now);
  const { key, start, isCurrentMonth, asOf, inMonth } = monthWindow(year, month, now);

  const { freezes, snapshots: allSnapshots, notes: allNotes } = data ?? (await loadForecastData([key]));
  const freeze = freezes.find((f) => f.month === key) ?? null;
  const firstFreeze = freezes[0] ?? null;
  const snapshots = allSnapshots.filter((r) => r.month === key);
  const notes = allNotes.filter((n) => n.month === key);

  // Months before forecasting existed have nothing to compare.
  const tracked = Boolean(firstFreeze && key >= firstFreeze.month);
  // Provisional = the launch month while it is still running (compared against the live forecast).
  const provisional = Boolean(freeze?.provisional && !freeze.lockedAt);
  const jobsById = new Map(rawJobs.map((j) => [j.id, j]));
  const noteByJob = new Map(notes.map((n) => [n.jobId, n]));

  // Committed forecast: the locked snapshot — or, while the provisional first month is still running,
  // the live forecast. Backdated entries (added after the month ended) are flagged.
  const committed = new Map<string, { referenceNumber: string; customer: string; amount: number; backdated: boolean }>();
  if (provisional) {
    for (const j of rawJobs) {
      if (j.forecastMonth === key) {
        committed.set(j.id, { referenceNumber: j.referenceNumber, customer: j.customer, amount: j.forecastAmount ?? 0, backdated: false });
      }
    }
  } else {
    for (const s of snapshots) {
      committed.set(s.jobId, { referenceNumber: s.referenceNumber, customer: s.customer, amount: s.amount, backdated: s.backdated });
    }
  }

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
        note: noteFor(jobId), backdated: fc.backdated,
      });
      continue;
    }
    const invoiceDate = job.invoice?.invoiceDate ?? null;
    const invoicedAmount = job.invoice?.invoiceAmount ?? null;
    const base = {
      jobId, referenceNumber: job.referenceNumber, customer: job.customer,
      forecastAmount: fc.amount, currentForecastMonth: job.forecastMonth ?? null, note: noteFor(jobId), backdated: fc.backdated,
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
    } else {
      const then = jobAsOf(job, asOf);
      const status = deriveJobStatus(then, asOf);
      if (status.closedWithoutInvoice) {
        // Forecast to invoice, but closed as an internal / warranty job with no invoice.
        const type = JOB_TYPE_LABELS[job.jobType].toLowerCase();
        rows.push({
          ...base, outcome: "CLOSED_NO_INVOICE", invoicedAmount: null, invoiceDate: null, cause: "Closed without invoice (internal)",
          missingWo: false, factors: [{ text: `Closed without invoice on ${fmtDate(status.closedOn!)} — ${type} job`, tone: "warning" }],
        });
      } else {
        const why = explain(job, then, status, asOf);
        if (invoiceDate) why.factors.unshift({ text: `Invoiced later, on ${fmtDate(invoiceDate)}`, tone: "info" });
        rows.push({
          ...base, outcome: isCurrentMonth ? "PENDING" : "SLIPPED", invoicedAmount: null, invoiceDate: null,
          cause: why.cause, missingWo: why.missingWo, factors: why.factors,
        });
      }
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
      currentForecastMonth: job.forecastMonth ?? null, cause: null, missingWo: false, factors, note: noteFor(job.id), backdated: false,
    });
  }

  const ORDER: Record<ForecastOutcome, number> = { SLIPPED: 0, PENDING: 1, CLOSED_NO_INVOICE: 2, REMOVED: 3, INVOICED: 4, INVOICED_EARLY: 5, UNPLANNED: 6 };
  rows.sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || (b.forecastAmount ?? b.invoicedAmount ?? 0) - (a.forecastAmount ?? a.invoicedAmount ?? 0));

  const sum = (xs: Array<number | null>) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
  const withOutcome = (...outcomes: ForecastOutcome[]) => rows.filter((r) => outcomes.includes(r.outcome));
  const forecastRows = rows.filter((r) => r.outcome !== "UNPLANNED");
  const notInvoiced = withOutcome(...NOT_INVOICED_OUTCOMES);
  const delivered = withOutcome("INVOICED");
  const unplanned = withOutcome("UNPLANNED");
  const invoicedRows = [...delivered, ...unplanned];

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
      deliveredTotal: sum(delivered.map((r) => r.invoicedAmount)),
      deliveredCount: delivered.length,
      /** Forecast amount of the individual forecast jobs that haven't been invoiced (job-level view). */
      notInvoicedTotal: sum(notInvoiced.map((r) => r.forecastAmount)),
      notInvoicedCount: notInvoiced.length,
      /** Still needed to reach the forecast: forecast − everything invoiced in the month (incl. unplanned). */
      remainingTotal: Math.max(0, forecastTotal - invoicedTotal),
      /** Invoiced beyond the forecast (0 unless the forecast was exceeded). */
      aboveForecastTotal: Math.max(0, invoicedTotal - forecastTotal),
      unplannedTotal: sum(unplanned.map((r) => r.invoicedAmount)),
      unplannedCount: unplanned.length,
      /** Live forecast for this month right now (what planners currently expect). */
      latestForecastTotal: sum(rawJobs.filter((j) => j.forecastMonth === key).map((j) => j.forecastAmount)),
      /** Part of the forecast added after the month ended (backdated). */
      backdatedTotal: sum(forecastRows.filter((r) => r.backdated).map((r) => r.forecastAmount)),
      backdatedCount: forecastRows.filter((r) => r.backdated).length,
    },
    causes: [...causeMap.values()].sort((a, b) => b.amount - a.amount),
    noWo: { count: noWo.length, amount: sum(noWo.map((r) => r.forecastAmount)) },
    rows,
  };
}

/** Forecast records for some months, loaded together (all freeze markers, oldest first). */
async function loadForecastData(months: string[]) {
  const [freezes, snapshots, notes] = await Promise.all([
    prisma.forecastFreeze.findMany({ orderBy: { month: "asc" } }),
    prisma.forecastSnapshot.findMany({ where: { month: { in: months } } }),
    prisma.forecastNote.findMany({ where: { month: { in: months } } }),
  ]);
  return { freezes, snapshots, notes };
}
type ForecastData = Awaited<ReturnType<typeof loadForecastData>>;

/**
 * A year's forecast performance, month by month (up to the current month). Year totals cover only
 * months that had a forecast, so forecast and invoiced compare like with like.
 */
export async function buildYearForecast(rawJobs: JobWithListRelations[], year: number, now = new Date()) {
  await ensureForecastsFrozen(now);
  const lastMonth = year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0;
  // One round of queries for the whole year, shared by the monthly reports.
  const data = await loadForecastData(Array.from({ length: lastMonth }, (_, i) => monthKeyOf(new Date(year, i, 1))));
  const reports = await Promise.all(
    Array.from({ length: lastMonth }, (_, i) => buildForecastReport(rawJobs, year, i + 1, now, { skipFreeze: true, data }))
  );
  const months = reports.map((r) => ({
    month: r.month,
    tracked: r.tracked,
    provisional: r.provisional,
    isCurrentMonth: r.isCurrentMonth,
    forecastTotal: r.summary.forecastTotal,
    invoicedTotal: r.summary.invoicedTotal,
    achievedPercent: r.summary.achievedPercent,
    notInvoicedTotal: r.summary.notInvoicedTotal,
    backdatedTotal: r.summary.backdatedTotal,
  }));
  const tracked = months.filter((m) => m.tracked);
  const forecastTotal = tracked.reduce((s, m) => s + m.forecastTotal, 0);
  const invoicedTotal = tracked.reduce((s, m) => s + m.invoicedTotal, 0);
  return {
    year,
    months,
    totals: {
      trackedMonths: tracked.length,
      forecastTotal,
      invoicedTotal,
      achievedPercent: forecastTotal > 0 ? Math.round((invoicedTotal / forecastTotal) * 100) : null,
    },
  };
}
