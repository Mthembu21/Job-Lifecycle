import { JobDto, JobWithListRelations, toJobDto } from "../modules/jobs/jobs.dto";
import { buildDashboardSummary, closedWithoutInvoiceKpis, weekKey } from "./analytics";
import { jobAsOf } from "./asOf";
import { StageName } from "./statusEngine";

/*
 * Dashboard for a single calendar month ("2026-10").
 *
 * Two kinds of figures, both derived from the job dates:
 *  - Activity IN the month — jobs received (opened), quotations issued, jobs invoiced, invoice value,
 *    jobs closed. A date counts when it falls between the 1st and the month end (or today, for the
 *    current month).
 *  - Pipeline AT the month end — waiting for quotation / PO, in repair, ready for dispatch, awaiting
 *    invoice, delayed, open value. Each job is rewound to the month end (jobAsOf) and its stage
 *    re-derived, so "Waiting for PO" for October lists the jobs that were quoted but had no PO yet on
 *    31 October. For the current month that's simply the position today.
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonth(value: unknown): { year: number; month: number } | null {
  if (typeof value !== "string") return null;
  const m = MONTH_RE.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Every month from the earliest job up to the current month, newest first. */
export function availableMonths(jobs: { jobCreatedDate: Date }[], now = new Date()): string[] {
  const earliest = jobs.reduce<Date | null>(
    (min, j) => (min === null || j.jobCreatedDate < min ? j.jobCreatedDate : min),
    null
  );
  const months: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  const stop = earliest ? new Date(earliest.getFullYear(), earliest.getMonth(), 1) : cursor;
  while (cursor >= stop && months.length < 240) {
    months.push(monthKeyOf(cursor));
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return months;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** A job's value when there's no invoice amount: PO value, else the quotation amount. */
export function jobValue(j: JobDto): number {
  return toNumber(j.poValue) || toNumber(j.quotation?.quotationAmount);
}

const STAGE_LABELS: Record<Exclude<StageName, "CLOSED">, string> = {
  QUOTATION: "Quotation",
  AWAITING_PO: "Awaiting PO",
  REPAIR: "Repair",
  DISPATCH: "Dispatch",
  INVOICING: "Invoicing",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  WARRANTY: "Warranty",
  CUSTOMER_REPAIR: "Customer Repair",
  INTERNAL: "Internal",
  SERVICE: "Service",
  REBUILD: "Rebuild",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

/** The date on which each SLA stage is completed. */
const STAGE_COMPLETED_ON: Record<Exclude<StageName, "CLOSED">, (j: JobDto) => Date | null | undefined> = {
  QUOTATION: (j) => j.quotation?.epirocQuotationDate,
  AWAITING_PO: (j) => j.repair?.purchaseOrderDate,
  REPAIR: (j) => j.repair?.repairCompletionDate,
  DISPATCH: (j) => j.dispatch?.dispatchDate,
  INVOICING: (j) => j.invoice?.invoiceDate ?? (j.status.closedWithoutInvoice ? j.invoice?.closingDate : null),
};

export function buildMonthlyDashboard(rawJobs: JobWithListRelations[], year: number, month: number, now = new Date()) {
  const start = new Date(year, month - 1, 1);
  const endOfMonth = new Date(new Date(year, month, 1).getTime() - 1);
  const isCurrentMonth = endOfMonth.getTime() > now.getTime();
  const asOf = isCurrentMonth ? now : endOfMonth;

  const inMonth = (d: Date | string | null | undefined) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= asOf.getTime();
  };

  // Jobs opened by the end of the month, rewound to how they stood at the cut-off. (Job Opening
  // defaults to 3 business days after receipt, so in the current month it can be a few days
  // ahead of today — those jobs still belong to this month.)
  const snapshot = rawJobs
    .filter((j) => j.jobCreatedDate.getTime() <= endOfMonth.getTime())
    .map((j) => toJobDto(jobAsOf(j, asOf), asOf));
  const openedInMonth = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= endOfMonth.getTime();
  };

  // Weekly buckets covering just this month.
  const weekKeys: string[] = [];
  for (let d = new Date(start); d.getTime() <= asOf.getTime(); d.setDate(d.getDate() + 7)) {
    const key = weekKey(d);
    if (!weekKeys.includes(key)) weekKeys.push(key);
  }
  const lastWeek = weekKey(asOf);
  if (!weekKeys.includes(lastWeek)) weekKeys.push(lastWeek);

  const base = buildDashboardSummary(snapshot, { anchor: asOf, weekKeys });

  const received = snapshot.filter((j) => openedInMonth(j.jobCreatedDate));
  const invoiced = snapshot.filter((j) => inMonth(j.invoice?.invoiceDate));
  // Only jobs that are actually closed (invoiced, or internal/warranty closed without invoice) — a
  // closing date typed in before a customer job is invoiced doesn't close it.
  const closed = snapshot.filter((j) => j.status.isClosed && inMonth(j.invoice?.closingDate ?? j.invoice?.invoiceDate));
  // Worked on during the month = not already closed (invoiced, or closed without invoice) before the 1st.
  const doneDate = (j: JobDto) => j.invoice?.invoiceDate ?? (j.status.closedWithoutInvoice ? j.invoice?.closingDate : null);
  const active = snapshot.filter((j) => {
    const d = doneDate(j);
    return !(d && new Date(d) < start);
  });
  // Internal jobs closed in the month with no invoice — valued at PO value (or quote).
  const closedNoInvoice = closed.filter((j) => j.status.closedWithoutInvoice);
  const woSetInMonth = snapshot.filter((j) => inMonth(j.woNumberSetAt));
  const quotedInMonth = snapshot.filter((j) => inMonth(j.quotation?.epirocQuotationDate));

  const invoicedValue = invoiced.reduce((s, j) => s + toNumber(j.invoice?.invoiceAmount), 0);
  const receivedValue = received.reduce((s, j) => s + toNumber(j.poValue), 0);

  const kpis = {
    ...base.kpis, // pipeline counts / open value / delayed / awaiting WO — as at month end
    totalJobsCreated: received.length,
    jobsInvoiced: invoiced.length,
    totalInvoicedValue: invoicedValue,
    closedJobs: closed.length,
    ...closedWithoutInvoiceKpis(closedNoInvoice),
    avgTurnaroundDays:
      closed.length === 0 ? 0 : Math.round(closed.reduce((s, j) => s + j.status.totalJobAge, 0) / closed.length),
    slaCompliancePercent:
      active.length === 0 ? 100 : Math.round((active.filter((j) => j.status.slaCompliant).length / active.length) * 100),
    avgDaysToWoNumber:
      woSetInMonth.length === 0
        ? 0
        : Math.round(
            woSetInMonth.reduce(
              (s, j) =>
                s + Math.max(0, Math.round((new Date(j.woNumberSetAt!).getTime() - new Date(j.jobCreatedDate).getTime()) / 86_400_000)),
              0
            ) / woSetInMonth.length
          ),
  };

  const typeCounts = new Map<string, number>();
  for (const j of received) typeCounts.set(j.jobType, (typeCounts.get(j.jobType) ?? 0) + 1);
  const jobsByType = Object.keys(JOB_TYPE_LABELS).map((key) => ({ label: JOB_TYPE_LABELS[key], value: typeCounts.get(key) ?? 0 }));

  // Average days for stages *completed during this month*, against target.
  const avgDaysPerStage = (Object.keys(STAGE_LABELS) as Array<Exclude<StageName, "CLOSED">>).map((stage) => {
    const done = snapshot
      .filter((j) => inMonth(STAGE_COMPLETED_ON[stage](j)))
      .map((j) => j.status.stages.find((s) => s.name === stage))
      .filter((s) => s && s.sla.days !== null);
    return {
      label: STAGE_LABELS[stage],
      actualDays: done.length === 0 ? 0 : Math.round(done.reduce((s, x) => s + (x!.sla.days ?? 0), 0) / done.length),
      targetDays: done[0]?.sla.target ?? base.charts.avgDaysPerStage.find((p) => p.label === STAGE_LABELS[stage])?.targetDays ?? 0,
    };
  });

  const quotationStats = quotedInMonth.map((j) => j.status.stages.find((s) => s.name === "QUOTATION")!);
  const quotationPerformance = {
    withinSla: quotationStats.filter((s) => s.sla.status !== "RED").length,
    outsideSla: quotationStats.filter((s) => s.sla.status === "RED").length,
  };

  const valueBreakdown = [
    { label: "New Job Value", value: receivedValue },
    { label: "Invoiced Value", value: invoicedValue },
    { label: isCurrentMonth ? "Open Job Value (today)" : "Open Job Value (month end)", value: base.kpis.totalOpenJobValue },
  ];

  const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

  const monthDetail = {
    invoiced: invoiced
      .map((j) => ({
        id: j.id,
        referenceNumber: j.referenceNumber,
        customer: j.customer,
        invoiceNumber: j.invoice?.invoiceNumber ?? null,
        invoiceDate: iso(j.invoice?.invoiceDate),
        invoiceAmount: toNumber(j.invoice?.invoiceAmount),
        poValue: toNumber(j.poValue),
      }))
      .sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "")),
    awaitingPo: snapshot
      .filter((j) => j.status.currentStage === "AWAITING_PO")
      .map((j) => {
        const po = j.status.stages.find((s) => s.name === "AWAITING_PO")!;
        return {
          id: j.id,
          referenceNumber: j.referenceNumber,
          customer: j.customer,
          quotedDate: iso(j.quotation?.epirocQuotationDate),
          daysWaiting: po.sla.days ?? 0,
          targetDays: po.sla.target,
          overdue: po.sla.status === "RED",
          quotationAmount: toNumber(j.quotation?.quotationAmount),
          poValue: toNumber(j.poValue),
        };
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting),
    received: received
      .map((j) => ({
        id: j.id,
        referenceNumber: j.referenceNumber,
        customer: j.customer,
        jobType: JOB_TYPE_LABELS[j.jobType] ?? j.jobType,
        jobCreatedDate: iso(j.jobCreatedDate),
        currentStage: j.status.currentStage,
        poValue: toNumber(j.poValue),
      }))
      .sort((a, b) => (b.jobCreatedDate ?? "").localeCompare(a.jobCreatedDate ?? "")),
    closedNoInvoice: closedNoInvoice
      .map((j) => ({
        id: j.id,
        referenceNumber: j.referenceNumber,
        customer: j.customer,
        jobType: JOB_TYPE_LABELS[j.jobType] ?? j.jobType,
        closingDate: iso(j.invoice?.closingDate),
        value: jobValue(j),
        comments: j.invoice?.comments ?? null,
      }))
      .sort((a, b) => (b.closingDate ?? "").localeCompare(a.closingDate ?? "")),
  };

  return {
    kpis,
    charts: { ...base.charts, jobsByType, avgDaysPerStage, quotationPerformance, valueBreakdown },
    period: {
      month: `${year}-${String(month).padStart(2, "0")}`,
      label: start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
      start: start.toISOString(),
      asOf: asOf.toISOString(),
      isCurrentMonth,
    },
    monthDetail,
  };
}
