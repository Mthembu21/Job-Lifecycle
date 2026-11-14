import { JobDto, JobWithListRelations, toJobDto } from "../modules/jobs/jobs.dto";
import { buildDashboardSummary, closedWithoutInvoiceKpis, wholeDaysBetween, weekKey } from "./analytics";
import { jobAsOf } from "./asOf";
import { JOB_TYPE_LABELS, SLA_STAGES, STAGE_LABELS, jobValue, toNumber } from "./labels";
import { monthKeyOf, monthWindow } from "./months";

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

export function buildMonthlyDashboard(rawJobs: JobWithListRelations[], year: number, month: number, now = new Date()) {
  const { key, start, endOfMonth, isCurrentMonth, asOf, inMonth } = monthWindow(year, month, now);

  // Jobs opened by the end of the month, rewound to how they stood at the cut-off. (Job Opening
  // defaults to 3 business days after receipt, so in the current month it can be a few days
  // ahead of today — those jobs still belong to this month.)
  const snapshot = rawJobs
    .filter((j) => j.jobCreatedDate.getTime() <= endOfMonth.getTime())
    .map((j) => toJobDto(jobAsOf(j, asOf), asOf));

  // Weekly buckets covering just this month.
  const weekKeys: string[] = [];
  for (let d = new Date(start); d.getTime() <= asOf.getTime(); d.setDate(d.getDate() + 7)) {
    const week = weekKey(d);
    if (!weekKeys.includes(week)) weekKeys.push(week);
  }
  const lastWeek = weekKey(asOf);
  if (!weekKeys.includes(lastWeek)) weekKeys.push(lastWeek);

  const base = buildDashboardSummary(snapshot, { anchor: asOf, weekKeys });

  const received = snapshot.filter((j) => j.jobCreatedDate >= start && j.jobCreatedDate <= endOfMonth);
  const invoiced = snapshot.filter((j) => inMonth(j.invoice?.invoiceDate));
  const closed = snapshot.filter((j) => inMonth(j.status.closedOn));
  // Worked on during the month = the invoicing stage wasn't already finished before the 1st.
  const invoicingDone = (j: JobDto) => j.status.stages.find((s) => s.name === "INVOICING")!.completedOn;
  const active = snapshot.filter((j) => {
    const done = invoicingDone(j);
    return !(done && done < start);
  });
  const closedNoInvoice = closed.filter((j) => j.status.closedWithoutInvoice);
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
    avgTurnaroundDays: average(closed.map((j) => j.status.totalJobAge)),
    slaCompliancePercent:
      active.length === 0 ? 100 : Math.round((active.filter((j) => j.status.slaCompliant).length / active.length) * 100),
    avgDaysToWoNumber: average(
      snapshot.filter((j) => inMonth(j.woNumberSetAt)).map((j) => wholeDaysBetween(j.jobCreatedDate, j.woNumberSetAt!))
    ),
  };

  const typeCounts = new Map<string, number>();
  for (const j of received) typeCounts.set(j.jobType, (typeCounts.get(j.jobType) ?? 0) + 1);
  const jobsByType = Object.keys(JOB_TYPE_LABELS).map((type) => ({ label: JOB_TYPE_LABELS[type], value: typeCounts.get(type) ?? 0 }));

  // Average days for stages *completed during this month*, against target.
  const avgDaysPerStage = SLA_STAGES.map((stage, i) => {
    const done = snapshot
      .map((j) => j.status.stages.find((s) => s.name === stage)!)
      .filter((s) => inMonth(s.completedOn) && s.sla.days !== null);
    return {
      label: STAGE_LABELS[stage],
      actualDays: average(done.map((s) => s.sla.days ?? 0)),
      targetDays: done[0]?.sla.target ?? base.charts.avgDaysPerStage[i].targetDays,
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
      month: key,
      label: start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
      start: start.toISOString(),
      asOf: asOf.toISOString(),
      isCurrentMonth,
    },
    monthDetail,
  };
}
