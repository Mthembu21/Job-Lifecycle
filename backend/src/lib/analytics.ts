import { JobDto } from "../modules/jobs/jobs.dto";
import { StageName } from "./statusEngine";

const JOB_TYPE_LABELS: Record<string, string> = {
  WARRANTY: "Warranty",
  CUSTOMER_REPAIR: "Customer Repair",
  INTERNAL: "Internal",
  SERVICE: "Service",
  REBUILD: "Rebuild",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

const STAGE_LABELS: Record<StageName, string> = {
  QUOTATION: "Quotation",
  AWAITING_PO: "Awaiting PO",
  REPAIR: "Repair",
  DISPATCH: "Dispatch",
  INVOICING: "Invoicing",
  CLOSED: "Closed",
};

const STAGE_ORDER: StageName[] = ["QUOTATION", "AWAITING_PO", "REPAIR", "DISPATCH", "INVOICING", "CLOSED"];
const SLA_STAGE_ORDER: Exclude<StageName, "CLOSED">[] = [
  "QUOTATION",
  "AWAITING_PO",
  "REPAIR",
  "DISPATCH",
  "INVOICING",
];

interface Bucket {
  label: string;
  value: number;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function daysBetween(from: string | Date, to: string | Date): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function lastNMonthKeys(n: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  return new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function lastNWeekKeys(n: number): string[] {
  const now = new Date();
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

export function buildDashboardSummary(jobs: JobDto[]) {
  const openJobs = jobs.filter((j) => !j.status.isClosed);
  const closedJobs = jobs.filter((j) => j.status.isClosed);
  const delayedJobs = jobs.filter((j) => j.status.currentStatus === "DELAYED");

  const totalOpenJobValue = openJobs.reduce((sum, j) => sum + toNumber(j.poValue), 0);
  const totalClosedJobValue = closedJobs.reduce((sum, j) => sum + toNumber(j.poValue), 0);
  const totalInvoicedValue = jobs.reduce((sum, j) => sum + toNumber(j.invoice?.invoiceAmount), 0);
  const totalRepairValue = jobs.reduce(
    (sum, j) => sum + toNumber(j.repair?.totalRepairCost ?? j.repair?.partsCost),
    0
  );

  const kpis = {
    totalJobsCreated: jobs.length,
    waitingForQuotation: jobs.filter((j) => j.status.currentStage === "QUOTATION").length,
    waitingForPO: jobs.filter((j) => j.status.currentStage === "AWAITING_PO").length,
    inRepair: jobs.filter((j) => j.status.currentStage === "REPAIR").length,
    readyForDispatch: jobs.filter((j) => j.status.currentStage === "DISPATCH").length,
    awaitingInvoice: jobs.filter((j) => j.status.currentStage === "INVOICING").length,
    closedJobs: closedJobs.length,
    delayedJobs: delayedJobs.length,
    totalOpenJobValue,
    totalInvoicedValue,
    avgTurnaroundDays:
      closedJobs.length === 0
        ? 0
        : Math.round(closedJobs.reduce((sum, j) => sum + j.status.totalJobAge, 0) / closedJobs.length),
    slaCompliancePercent:
      jobs.length === 0 ? 100 : Math.round((jobs.filter((j) => j.status.slaCompliant).length / jobs.length) * 100),
    jobsAwaitingWoNumber: openJobs.filter((j) => !j.woNumber).length,
    avgDaysToWoNumber: (() => {
      const withWoNumber = jobs.filter((j) => j.woNumberSetAt);
      if (withWoNumber.length === 0) return 0;
      return Math.round(
        withWoNumber.reduce((sum, j) => sum + daysBetween(j.jobCreatedDate, j.woNumberSetAt!), 0) /
          withWoNumber.length
      );
    })(),
  };

  const jobsByType = countBy(
    jobs.map((j) => j.jobType),
    Object.keys(JOB_TYPE_LABELS),
    JOB_TYPE_LABELS
  );

  const jobsByStage = countBy(
    jobs.map((j) => j.status.currentStage),
    STAGE_ORDER,
    STAGE_LABELS
  );

  const avgDaysPerStage = SLA_STAGE_ORDER.map((stageName) => {
    const completedDurations = jobs
      .map((j) => j.status.stages.find((s) => s.name === stageName))
      .filter((s) => s && s.status === "COMPLETED" && s.sla.days !== null);
    const avgDays =
      completedDurations.length === 0
        ? 0
        : Math.round(
            completedDurations.reduce((sum, s) => sum + (s!.sla.days ?? 0), 0) / completedDurations.length
          );
    const target = completedDurations[0]?.sla.target ?? 0;
    return { label: STAGE_LABELS[stageName], actualDays: avgDays, targetDays: target };
  });

  const valueBreakdown: Bucket[] = [
    { label: "Open Job Value", value: totalOpenJobValue },
    { label: "Closed Job Value", value: totalClosedJobValue },
    { label: "Repair Value", value: totalRepairValue },
    { label: "Invoiced Value", value: totalInvoicedValue },
  ];

  const monthKeys = lastNMonthKeys(12);
  const weekKeys = lastNWeekKeys(12);

  const jobsCreatedByMonth: Bucket[] = monthKeys.map((key) => ({
    label: monthLabel(key),
    value: jobs.filter((j) => monthKey(new Date(j.jobCreatedDate)) === key).length,
  }));
  const jobsCreatedByWeek: Bucket[] = weekKeys.map((key) => ({
    label: weekLabel(key),
    value: jobs.filter((j) => weekKey(new Date(j.jobCreatedDate)) === key).length,
  }));

  const invoiceValueByMonth: Bucket[] = monthKeys.map((key) => ({
    label: monthLabel(key),
    value: jobs
      .filter((j) => j.invoice?.invoiceDate && monthKey(new Date(j.invoice.invoiceDate)) === key)
      .reduce((sum, j) => sum + toNumber(j.invoice?.invoiceAmount), 0),
  }));
  const jobValueByMonth: Bucket[] = monthKeys.map((key) => ({
    label: monthLabel(key),
    value: jobs
      .filter((j) => monthKey(new Date(j.jobCreatedDate)) === key)
      .reduce((sum, j) => sum + toNumber(j.poValue), 0),
  }));
  const invoiceValueByWeek: Bucket[] = weekKeys.map((key) => ({
    label: weekLabel(key),
    value: jobs
      .filter((j) => j.invoice?.invoiceDate && weekKey(new Date(j.invoice.invoiceDate)) === key)
      .reduce((sum, j) => sum + toNumber(j.invoice?.invoiceAmount), 0),
  }));
  const jobValueByWeek: Bucket[] = weekKeys.map((key) => ({
    label: weekLabel(key),
    value: jobs
      .filter((j) => weekKey(new Date(j.jobCreatedDate)) === key)
      .reduce((sum, j) => sum + toNumber(j.poValue), 0),
  }));

  const quotationStats = jobs
    .map((j) => j.status.stages.find((s) => s.name === "QUOTATION"))
    .filter((s) => s && s.status === "COMPLETED");
  const quotationPerformance = {
    withinSla: quotationStats.filter((s) => s!.sla.status !== "RED").length,
    outsideSla: quotationStats.filter((s) => s!.sla.status === "RED").length,
  };

  const complianceMonthKeys = lastNMonthKeys(6);
  const slaComplianceTrend = complianceMonthKeys.map((key) => {
    const bucketJobs = jobs.filter((j) => monthKey(new Date(j.jobCreatedDate)) === key);
    const percent =
      bucketJobs.length === 0
        ? null
        : Math.round((bucketJobs.filter((j) => j.status.slaCompliant).length / bucketJobs.length) * 100);
    return { label: monthLabel(key), value: percent ?? 0 };
  });

  function rankedCount(getKey: (j: JobDto) => string | null | undefined, limit = 10): Bucket[] {
    const counts = new Map<string, number>();
    for (const job of delayedJobs) {
      const key = getKey(job);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, value]) => ({ label, value }));
  }

  const delayedByStage = rankedCount((j) => STAGE_LABELS[j.status.currentStage]);
  const delayedByCreator = rankedCount((j) => j.createdBy?.name);
  const delayedByTechnician = rankedCount((j) => j.repair?.technicianName);

  const revenueByCustomer = new Map<string, number>();
  for (const job of jobs) {
    if (!job.invoice?.invoiceAmount) continue;
    revenueByCustomer.set(job.customer, (revenueByCustomer.get(job.customer) ?? 0) + toNumber(job.invoice.invoiceAmount));
  }
  const topCustomersByRevenue: Bucket[] = [...revenueByCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  const customerNames = [...new Set(jobs.map((j) => j.customer))];
  const customerPerformance = customerNames
    .map((customer) => {
      const customerJobs = jobs.filter((j) => j.customer === customer);
      const customerClosed = customerJobs.filter((j) => j.status.isClosed);
      const avgTurnaroundDays =
        customerClosed.length === 0
          ? null
          : Math.round(customerClosed.reduce((sum, j) => sum + j.status.totalJobAge, 0) / customerClosed.length);
      const slaCompliancePercent = Math.round(
        (customerJobs.filter((j) => j.status.slaCompliant).length / customerJobs.length) * 100
      );
      return { customer, jobCount: customerJobs.length, avgTurnaroundDays, slaCompliancePercent };
    })
    .sort((a, b) => b.jobCount - a.jobCount);

  return {
    kpis,
    charts: {
      jobsCreatedByMonth,
      jobsCreatedByWeek,
      jobsByType,
      jobsByStage,
      avgDaysPerStage,
      valueBreakdown,
      invoiceValueByMonth,
      jobValueByMonth,
      invoiceValueByWeek,
      jobValueByWeek,
      quotationPerformance,
      slaComplianceTrend,
      delayedByStage,
      delayedByCreator,
      delayedByTechnician,
      topCustomersByRevenue,
      customerPerformance,
    },
  };
}

export type DashboardSummary = ReturnType<typeof buildDashboardSummary>;
