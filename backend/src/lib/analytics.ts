import { JobDto } from "../modules/jobs/jobs.dto";
import { isNonInvoicedJobType } from "./jobTypes";
import { JOB_TYPE_LABELS, SLA_STAGES, STAGE_LABELS, STAGE_ORDER, jobValue, toNumber } from "./labels";
import { monthKeyOf } from "./months";

interface Bucket {
  label: string;
  value: number;
}

/** Whole days between two dates, rounded, never negative. */
export function wholeDaysBetween(from: string | Date, to: string | Date): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function lastNMonthKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

/** Monday of the date's week, as an ISO date ("2026-11-09"). */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  return new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function lastNWeekKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    keys.push(weekKey(d));
  }
  return keys;
}

function countBy<T extends string>(items: T[], order: readonly T[], labels: Record<T, string>): Bucket[] {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return order.map((key) => ({ label: labels[key], value: counts.get(key) ?? 0 }));
}

/**
 * One trend series: totals per bucket key in a single pass over the jobs. `keyOf` places a job in a
 * bucket (null = not counted); `valueOf` is what it adds (default 1, i.e. a count).
 */
function trendSeries(
  jobs: JobDto[],
  keys: string[],
  label: (key: string) => string,
  keyOf: (j: JobDto) => string | null,
  valueOf: (j: JobDto) => number = () => 1
): Bucket[] {
  const totals = new Map<string, number>();
  for (const j of jobs) {
    const key = keyOf(j);
    if (key) totals.set(key, (totals.get(key) ?? 0) + valueOf(j));
  }
  return keys.map((key) => ({ label: label(key), value: totals.get(key) ?? 0 }));
}

/** Count / value of jobs closed without invoice, split into internal and warranty. */
export function closedWithoutInvoiceKpis(closedNoInvoice: JobDto[]) {
  const internal = closedNoInvoice.filter((j) => j.jobType === "INTERNAL");
  const warranty = closedNoInvoice.filter((j) => j.jobType === "WARRANTY");
  const total = (xs: JobDto[]) => xs.reduce((sum, j) => sum + jobValue(j), 0);
  return {
    closedWithoutInvoiceCount: closedNoInvoice.length,
    closedWithoutInvoiceValue: total(closedNoInvoice),
    closedInternalCount: internal.length,
    closedInternalValue: total(internal),
    closedWarrantyCount: warranty.length,
    closedWarrantyValue: total(warranty),
  };
}

export interface SummaryOptions {
  /** End of the trend windows (default: now). The month view anchors trends to the selected month. */
  anchor?: Date;
  /** Explicit week buckets (Monday ISO dates); default is the 12 weeks up to `anchor`. */
  weekKeys?: string[];
}

export function buildDashboardSummary(jobs: JobDto[], opts: SummaryOptions = {}) {
  const anchor = opts.anchor ?? new Date();
  const openJobs = jobs.filter((j) => !j.status.isClosed);
  const closedJobs = jobs.filter((j) => j.status.isClosed);
  const openNonInvoiced = openJobs.filter((j) => isNonInvoicedJobType(j.jobType));
  const atStage = (stage: string) => jobs.filter((j) => j.status.currentStage === stage).length;
  const sumOf = (xs: JobDto[], valueOf: (j: JobDto) => number) => xs.reduce((sum, j) => sum + valueOf(j), 0);

  const totalOpenJobValue = sumOf(openJobs, (j) => toNumber(j.poValue));
  const totalInvoicedValue = sumOf(jobs, (j) => toNumber(j.invoice?.invoiceAmount));

  const kpis = {
    totalJobsCreated: jobs.length,
    waitingForQuotation: atStage("QUOTATION"),
    waitingForPO: atStage("AWAITING_PO"),
    inRepair: atStage("REPAIR"),
    readyForDispatch: atStage("DISPATCH"),
    awaitingInvoice: atStage("INVOICING"),
    closedJobs: closedJobs.length,
    jobsInvoiced: jobs.filter((j) => j.invoice?.invoiceDate).length,
    // Internal / warranty jobs closed with no invoice — valued at PO value, else quotation amount.
    ...closedWithoutInvoiceKpis(closedJobs.filter((j) => j.status.closedWithoutInvoice)),
    // Open internal / warranty work (part of the open job value, but never invoiced).
    openNonInvoicedCount: openNonInvoiced.length,
    openNonInvoicedValue: sumOf(openNonInvoiced, (j) => toNumber(j.poValue)),
    delayedJobs: jobs.filter((j) => j.status.currentStatus === "DELAYED").length,
    totalOpenJobValue,
    totalInvoicedValue,
    avgTurnaroundDays: average(closedJobs.map((j) => j.status.totalJobAge)),
    slaCompliancePercent:
      jobs.length === 0 ? 100 : Math.round((jobs.filter((j) => j.status.slaCompliant).length / jobs.length) * 100),
    jobsAwaitingWoNumber: openJobs.filter((j) => !j.woNumber).length,
    avgDaysToWoNumber: average(
      jobs.filter((j) => j.woNumberSetAt).map((j) => wholeDaysBetween(j.jobCreatedDate, j.woNumberSetAt!))
    ),
  };

  const avgDaysPerStage = SLA_STAGES.map((stageName) => {
    const completed = jobs
      .map((j) => j.status.stages.find((s) => s.name === stageName))
      .filter((s) => s && s.status === "COMPLETED" && s.sla.days !== null);
    return {
      label: STAGE_LABELS[stageName],
      actualDays: average(completed.map((s) => s!.sla.days ?? 0)),
      targetDays: completed[0]?.sla.target ?? 0,
    };
  });

  const valueBreakdown: Bucket[] = [
    { label: "Open Job Value", value: totalOpenJobValue },
    { label: "Closed Job Value", value: sumOf(closedJobs, (j) => toNumber(j.poValue)) },
    { label: "Repair Value", value: sumOf(jobs, (j) => toNumber(j.repair?.totalRepairCost ?? j.repair?.partsCost)) },
    { label: "Invoiced Value", value: totalInvoicedValue },
  ];

  const monthKeys = lastNMonthKeys(12, anchor);
  const weekKeys = opts.weekKeys ?? lastNWeekKeys(12, anchor);
  const createdMonth = (j: JobDto) => monthKeyOf(new Date(j.jobCreatedDate));
  const createdWeek = (j: JobDto) => weekKey(new Date(j.jobCreatedDate));
  const invoicedMonth = (j: JobDto) => (j.invoice?.invoiceDate ? monthKeyOf(new Date(j.invoice.invoiceDate)) : null);
  const invoicedWeek = (j: JobDto) => (j.invoice?.invoiceDate ? weekKey(new Date(j.invoice.invoiceDate)) : null);
  const poValue = (j: JobDto) => toNumber(j.poValue);
  const invoiceAmount = (j: JobDto) => toNumber(j.invoice?.invoiceAmount);

  const quotationStats = jobs
    .map((j) => j.status.stages.find((s) => s.name === "QUOTATION"))
    .filter((s) => s && s.status === "COMPLETED");

  const slaComplianceTrend = lastNMonthKeys(6, anchor).map((key) => {
    const bucketJobs = jobs.filter((j) => createdMonth(j) === key);
    const compliant = bucketJobs.filter((j) => j.status.slaCompliant).length;
    return { label: monthLabel(key), value: bucketJobs.length === 0 ? 0 : Math.round((compliant / bucketJobs.length) * 100) };
  });

  return {
    kpis,
    charts: {
      jobsCreatedByMonth: trendSeries(jobs, monthKeys, monthLabel, createdMonth),
      jobsCreatedByWeek: trendSeries(jobs, weekKeys, weekLabel, createdWeek),
      jobsByType: countBy(jobs.map((j) => j.jobType), Object.keys(JOB_TYPE_LABELS), JOB_TYPE_LABELS),
      jobsByStage: countBy(jobs.map((j) => j.status.currentStage), STAGE_ORDER, STAGE_LABELS),
      avgDaysPerStage,
      valueBreakdown,
      invoiceValueByMonth: trendSeries(jobs, monthKeys, monthLabel, invoicedMonth, invoiceAmount),
      jobValueByMonth: trendSeries(jobs, monthKeys, monthLabel, createdMonth, poValue),
      invoiceValueByWeek: trendSeries(jobs, weekKeys, weekLabel, invoicedWeek, invoiceAmount),
      jobValueByWeek: trendSeries(jobs, weekKeys, weekLabel, createdWeek, poValue),
      jobsInvoicedByMonth: trendSeries(jobs, monthKeys, monthLabel, invoicedMonth),
      jobsInvoicedByWeek: trendSeries(jobs, weekKeys, weekLabel, invoicedWeek),
      quotationPerformance: {
        withinSla: quotationStats.filter((s) => s!.sla.status !== "RED").length,
        outsideSla: quotationStats.filter((s) => s!.sla.status === "RED").length,
      },
      slaComplianceTrend,
    },
  };
}
