import { JobDto } from "../modules/jobs/jobs.dto";
import { isNonInvoicedJobType } from "./jobTypes";
import { normalizeCustomerName } from "./customers";
import { SLA_STAGES, STAGE_LABELS, SlaStage, jobValue, toNumber } from "./labels";

/*
 * "Where are the delays, and why?" — built from any set of jobs as they stood at `asOf` (the
 * dashboard passes jobs already rewound with jobAsOf). Nothing here knows who is looking, so a
 * customer manager's dashboard is the same functions fed only that customer's jobs.
 */

const DAY_MS = 86_400_000;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const daysSince = (from: Date | string, asOf: Date) => Math.max(0, Math.floor((asOf.getTime() - new Date(from).getTime()) / DAY_MS));

/** One customer however the name was typed ("SASOL  THUBELISHA " = "Sasol Thubelisha"). */
export const customerKey = normalizeCustomerName;

/** The stage a delay reason belongs to, and where it is stored on the job. */
const REASON_SOURCES: { stage: SlaStage; reason: (j: JobDto) => string | null | undefined }[] = [
  { stage: "QUOTATION", reason: (j) => j.quotation?.delayReason },
  { stage: "REPAIR", reason: (j) => j.repair?.delayReason },
  { stage: "DISPATCH", reason: (j) => j.dispatch?.delayReason },
  { stage: "INVOICING", reason: (j) => j.invoice?.delayReason },
];

/** Free-text reasons grouped loosely: case, spacing and trailing punctuation don't split a group. */
function reasonKey(text: string): string | null {
  const cleaned = text.trim().replace(/\s+/g, " ").replace(/[.,;:!\-–]+$/, "");
  return /[a-z]{2,}/i.test(cleaned) ? cleaned.toLowerCase() : null;
}

const WAIT_BUCKETS = [
  { label: "0–7 days", max: 7 },
  { label: "8–20 days", max: 20 },
  { label: "21–60 days", max: 60 },
  { label: "Over 60 days", max: Infinity },
];

export function buildInsights(jobs: JobDto[], asOf: Date, inPeriod: (d: Date | string | null | undefined) => boolean) {
  const open = jobs.filter((j) => !j.status.isClosed);
  const currentStage = (j: JobDto) => j.status.stages.find((s) => s.name === j.status.currentStage);

  // --- Where: open jobs per stage, and how many of them are past target.
  const delaysByStage = SLA_STAGES.map((stage) => {
    const here = open.filter((j) => j.status.currentStage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      total: here.length,
      delayed: here.filter((j) => j.status.currentStatus === "DELAYED").length,
      targetDays: here.length ? currentStage(here[0])!.sla.target : null,
    };
  });

  // --- How long: open jobs by days in their current stage (stuck jobs included — the averages
  //     elsewhere only count finished stages).
  const waitingTime = WAIT_BUCKETS.map((b, i) => ({
    label: b.label,
    value: open.filter((j) => {
      // A stage that starts after the cut-off (e.g. a Job Opening typed in the future) counts as 0 days.
      const days = Math.max(0, j.status.daysInCurrentStage ?? 0);
      return days <= b.max && days > (i === 0 ? -1 : WAIT_BUCKETS[i - 1].max);
    }).length,
  }));

  // --- Which: open jobs furthest past their stage target.
  const overdue = open
    .map((j) => {
      const stage = currentStage(j);
      const days = j.status.daysInCurrentStage ?? 0;
      const target = stage?.sla.target ?? 0;
      const reason = REASON_SOURCES.find((r) => r.stage === j.status.currentStage)?.reason(j) ?? null;
      return {
        id: j.id,
        referenceNumber: j.referenceNumber,
        customer: j.customer,
        stage: j.status.currentStage,
        daysInStage: days,
        targetDays: target,
        daysOver: days - target,
        delayReason: reason?.trim() || null,
        value: isNonInvoicedJobType(j.jobType) ? 0 : jobValue(j),
      };
    })
    .filter((r) => r.daysOver > 0)
    .sort((a, b) => b.daysOver - a.daysOver);

  // --- Why: delay reasons on stages that ran late — still open at the cut-off, or finished in the period.
  const reasonGroups = new Map<string, { reason: string; count: number; stages: Set<SlaStage> }>();
  for (const j of jobs) {
    for (const source of REASON_SOURCES) {
      const text = source.reason(j);
      const key = text && reasonKey(text);
      if (!key) continue;
      const stage = j.status.stages.find((s) => s.name === source.stage)!;
      const late = stage.sla.status === "RED";
      const relevant = stage.completedOn ? inPeriod(stage.completedOn) : stage.status !== "NOT_STARTED";
      if (!late || !relevant) continue;
      const group = reasonGroups.get(key) ?? { reason: text!.trim().replace(/\s+/g, " "), count: 0, stages: new Set() };
      group.count++;
      group.stages.add(source.stage);
      reasonGroups.set(key, group);
    }
  }
  const delayReasons = [...reasonGroups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((g) => ({ reason: g.reason, count: g.count, stages: [...g.stages].map((s) => STAGE_LABELS[s]) }));
  const lateWithoutReason = open.filter((j) => {
    if (j.status.currentStatus !== "DELAYED") return false;
    const text = REASON_SOURCES.find((r) => r.stage === j.status.currentStage)?.reason(j);
    return !(text && reasonKey(text));
  }).length;

  // --- Outwork: open jobs out at a supplier at the cut-off.
  const atSupplier = open
    .filter((j) => j.repair?.outworkDateSent && !j.repair.outworkDateReceived)
    .map((j) => ({
      id: j.id,
      referenceNumber: j.referenceNumber,
      customer: j.customer,
      supplier: j.repair!.supplierName?.trim() || "Supplier not recorded",
      sentDate: iso(j.repair!.outworkDateSent),
      daysOut: daysSince(j.repair!.outworkDateSent!, asOf),
    }))
    .sort((a, b) => b.daysOut - a.daysOut);

  // --- WO numbers: open jobs still without one, longest waiting first.
  const awaitingWo = open
    .filter((j) => !j.woNumber)
    .map((j) => ({
      id: j.id,
      referenceNumber: j.referenceNumber,
      customer: j.customer,
      stage: j.status.currentStage,
      jobCreatedDate: iso(j.jobCreatedDate),
      daysWaiting: daysSince(j.jobCreatedDate, asOf),
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  // --- Customers: who the open work, the delays and the period's invoicing belong to.
  const byCustomer = new Map<string, { names: Map<string, number>; openJobs: number; delayedJobs: number; awaitingPo: number; openValue: number; invoicedValue: number; jobs: number }>();
  for (const j of jobs) {
    const key = customerKey(j.customer);
    if (!key) continue;
    const c = byCustomer.get(key) ?? { names: new Map(), openJobs: 0, delayedJobs: 0, awaitingPo: 0, openValue: 0, invoicedValue: 0, jobs: 0 };
    c.jobs++;
    const display = j.customer.trim().replace(/\s+/g, " ");
    c.names.set(display, (c.names.get(display) ?? 0) + 1);
    if (!j.status.isClosed) {
      c.openJobs++;
      if (j.status.currentStatus === "DELAYED") c.delayedJobs++;
      if (j.status.currentStage === "AWAITING_PO") c.awaitingPo++;
      if (!isNonInvoicedJobType(j.jobType)) c.openValue += jobValue(j);
    }
    if (inPeriod(j.invoice?.invoiceDate)) c.invoicedValue += toNumber(j.invoice?.invoiceAmount);
    byCustomer.set(key, c);
  }
  const customers = [...byCustomer.entries()]
    .map(([key, c]) => ({
      key,
      // The spelling used most often.
      customer: [...c.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      openJobs: c.openJobs,
      delayedJobs: c.delayedJobs,
      awaitingPo: c.awaitingPo,
      openValue: c.openValue,
      invoicedValue: c.invoicedValue,
    }))
    .filter((c) => c.openJobs > 0 || c.invoicedValue > 0)
    .sort((a, b) => b.openValue - a.openValue || b.openJobs - a.openJobs);

  return {
    delaysByStage,
    waitingTime,
    overdue: overdue.slice(0, 15),
    overdueCount: overdue.length,
    delayReasons,
    lateWithoutReason,
    outwork: { atSupplier, count: atSupplier.length },
    awaitingWo,
    customers,
  };
}

export type Insights = ReturnType<typeof buildInsights>;
