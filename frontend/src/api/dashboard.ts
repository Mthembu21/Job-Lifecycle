import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ChartBucket {
  label: string;
  value: number;
}

export interface StagePerformance {
  label: string;
  actualDays: number;
  targetDays: number;
}

export interface CustomerPerformanceRow {
  customer: string;
  jobCount: number;
  avgTurnaroundDays: number | null;
  slaCompliancePercent: number;
}

export interface DashboardSummary {
  kpis: {
    totalJobsCreated: number;
    waitingForQuotation: number;
    waitingForPO: number;
    inRepair: number;
    readyForDispatch: number;
    awaitingInvoice: number;
    closedJobs: number;
    delayedJobs: number;
    totalOpenJobValue: number;
    totalInvoicedValue: number;
    avgTurnaroundDays: number;
    slaCompliancePercent: number;
    jobsAwaitingWoNumber: number;
    avgDaysToWoNumber: number;
  };
  charts: {
    jobsCreatedByMonth: ChartBucket[];
    jobsCreatedByWeek: ChartBucket[];
    jobsByType: ChartBucket[];
    jobsByStage: ChartBucket[];
    avgDaysPerStage: StagePerformance[];
    valueBreakdown: ChartBucket[];
    invoiceValueByMonth: ChartBucket[];
    jobValueByMonth: ChartBucket[];
    invoiceValueByWeek: ChartBucket[];
    jobValueByWeek: ChartBucket[];
    quotationPerformance: { withinSla: number; outsideSla: number };
    slaComplianceTrend: ChartBucket[];
    delayedByStage: ChartBucket[];
    delayedByCreator: ChartBucket[];
    delayedByTechnician: ChartBucket[];
    topCustomersByRevenue: ChartBucket[];
    customerPerformance: CustomerPerformanceRow[];
  };
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary");
      return data;
    },
    refetchInterval: 30_000,
  });
}
