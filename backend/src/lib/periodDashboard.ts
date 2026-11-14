import { JobDto, JobWithListRelations, toJobDto } from "../modules/jobs/jobs.dto";
import { buildDashboardSummary, closedWithoutInvoiceKpis, wholeDaysBetween, weekKey } from "./analytics";
import { jobAsOf } from "./asOf";
import { JOB_TYPE_LABELS, SLA_STAGES, STAGE_LABELS, jobValue, toNumber } from "./labels";
import { monthKeyOf, monthWindow, yearWindow } from "./months";

/*
 * Dashboard for a calendar month ("2026-10") or a whole year ("2026").
 *
 * Two kinds of figures, both derived from the job dates:
 *  - Activity IN the period — jobs received (opened), quotations issued, jobs invoiced, invoice value,
 *    jobs closed. A date counts when it falls between the start and the period end (or today, for
 *    the current month / year).
 *  - Pipeline AT the period end — waiting for quotation / PO, in repair, ready for dispatch, awaiting
 *    invoice, delayed, open value. Each job is rewound to the period end (jobAsOf) and its stage
 *    re-derived, so "Waiting for PO" for October lists the jobs that were quoted but had no PO yet on
 *    31 October. For the current month / year that's simply the position today.
 */

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

function average(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export type Period = { kind: "month"; year: number; month: number } | { kind: "year"; year: number };

/** Weekly buckets (Monday ISO dates) from `start` to `asOf`. */
function weeksBetween(start: Date, asOf: Date): string[] {
  const weeks: string[] = [];
  for (let d = new Date(start); d.getTime() <= asOf.getTime(); d.setDate(d.getDate() + 7)) {
    const week = weekKey(d);
    if (!weeks.includes(week)) weeks.push(week);
  }
  const lastWeek = weekKey(asOf);
  if (!weeks.includes(lastWeek)) weeks.push(lastWeek);
  return weeks;
}

export function buildPeriodDashboard(rawJobs: JobWithListRelations[], period: Period, now = new Date()) {
  const isMonth = period.kind === "month";
  const { key, start, end, isCurrent, asOf, inPeriod } = isMonth ? monthWindow(period.year, period.month, now) : yearWindow(period.year, now);

  // Jobs opened by the end of the period, rewound to how they stood at the cut-off. (Job Opening
  // defaults to 3 business days after receipt, so in the current month it can be a few days
  // ahead of today — those jobs still belong to this period.)
  const snapshot = rawJobs
    .filter((j) => j.jobCreatedDate.getTime() <= end.getTime())
    .map((j) => toJobDto(jobAsOf(j, asOf), asOf));

  // Trend charts: a month shows its weeks; a year shows January–December.
  const base = buildDashboardSummary(
    snapshot,
    isMonth
      ? { anchor: asOf, weekKeys: weeksBetween(start, asOf) }
      : { anchor: asOf, monthKeys: Array.from({ length: 12 }, (_, i) => monthKeyOf(new Date(period.year, i, 1))) }
  );

  const received = snapshot.filter((j) => j.jobCreatedDate >= start && j.jobCreatedDate <= end);
  const invoiced = snapshot.filter((j) => inPeriod(j.invoice?.invoiceDate));
  const closed = snapshot.filter((j) => inPeriod(j.status.closedOn));
  // Worked on during the month = the invoicing stage wasn't already finished before the 1st.
  const invoicingDone = (j: JobDto) => j.status.stages.find((s) => s.name === "INVOICING")!.completedOn;
  const active = snapshot.filter((j) => {
    const done = invoicingDone(j);
    return !(done && done < start);
  });
  const closedNoInvoice = closed.filter((j) => j.status.closedWithoutInvoice);
  const quotedInPeriod = snapshot.filter((j) => inPeriod(j.quotation?.epirocQuotationDate));

  const invoicedValue = invoiced.reduce((s, j) => s + toNumber(j.invoice?.invoiceAmount), 0);
  const receivedValue = received.reduce((s, j) => s + toNumber(j.poValue), 0);

  const kpis = {
    ...base.kpis, // pipeline counts / open value / delayed / awaiting WO — as at month end
    totalJobsCreated: received.length,
    jobsInvoiced: invoiced.length,
    totalInvoicedValue: invoicedValue,
    closedJobs: closed.length,
    ...closedWithoutInvoiceKpis(closedNoInvoice),
    avgTurnaroundDays: average(closed.map((j) => j.status.totalJobAge)),
    slaCompliancePercent:
      active.length === 0 ? 100 : Math.round((active.filter((j) => j.status.slaCompliant).length / active.length) * 100),
    avgDaysToWoNumber: average(
      snapshot.filter((j) => inPeriod(j.woNumberSetAt)).map((j) => wholeDaysBetween(j.jobCreatedDate, j.woNumberSetAt!))
    ),
  };

  const typeCounts = new Map<string, number>();
  for (const j of received) typeCounts.set(j.jobType, (typeCounts.get(j.jobType) ?? 0) + 1);
  const jobsByType = Object.keys(JOB_TYPE_LABELS).map((type) => ({ label: JOB_TYPE_LABELS[type], value: typeCounts.get(type) ?? 0 }));

  // Average days for stages *completed during this month*, against target.
  const avgDaysPerStage = SLA_STAGES.map((stage, i) => {
    const done = snapshot
      .map((j) => j.status.stages.find((s) => s.name === stage)!)
      .filter((s) => inPeriod(s.completedOn) && s.sla.days !== null);
    return {
      label: STAGE_LABELS[stage],
      actualDays: average(done.map((s) => s.sla.days ?? 0)),
      targetDays: done[0]?.sla.target ?? base.charts.avgDaysPerStage[i].targetDays,
    };
  });

  const quotationStats = quotedInPeriod.map((j) => j.status.stages.find((s) => s.name === "QUOTATION")!);
  const quotationPerformance = {
    withinSla: quotationStats.filter((s) => s.sla.status !== "RED").length,
    outsideSla: quotationStats.filter((s) => s.sla.status === "RED").length,
  };

  const valueBreakdown = [
    { label: "New Job Value", value: receivedValue },
    { label: "Invoiced Value", value: invoicedValue },
    {
      label: isCurrent ? "Open Job Value (today)" : `Open Job Value (${isMonth ? "month" : "year"} end)`,
      value: base.kpis.totalOpenJobValue,
    },
  ];

  const byDateDesc = <T>(dateOf: (r: T) => string | null) => (a: T, b: T) => (dateOf(b) ?? "").localeCompare(dateOf(a) ?? "");

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
      .sort(byDateDesc((r) => r.invoiceDate)),
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
        jobType: j.jobType,
        jobCreatedDate: iso(j.jobCreatedDate),
        currentStage: j.status.currentStage,
        poValue: toNumber(j.poValue),
      }))
      .sort(byDateDesc((r) => r.jobCreatedDate)),
    closedNoInvoice: closedNoInvoice
      .map((j) => ({
        id: j.id,
        referenceNumber: j.referenceNumber,
        customer: j.customer,
        jobType: j.jobType,
        closingDate: iso(j.status.closedOn),
        value: jobValue(j),
        comments: j.invoice?.comments ?? null,
      }))
      .sort(byDateDesc((r) => r.closingDate)),
  };

  return {
    kpis,
    charts: { ...base.charts, jobsByType, avgDaysPerStage, quotationPerformance, valueBreakdown },
    period: {
      kind: period.kind,
      key,
      label: isMonth ? start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }) : key,
      start: start.toISOString(),
      asOf: asOf.toISOString(),
      isCurrent,
    },
    monthDetail,
  };
}
