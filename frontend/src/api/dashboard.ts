import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Job, JobType, StageName } from "../types";
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

export interface DashboardSummary {
  kpis: {
    totalJobsCreated: number;
    waitingForQuotation: number;
    waitingForPO: number;
    inRepair: number;
    readyForDispatch: number;
    awaitingInvoice: number;
    closedJobs: number;
    jobsInvoiced: number;
    /** Internal / warranty jobs closed with no invoice (in the month, or all time). */
    closedWithoutInvoiceCount: number;
    /** Their value: PO value, else quotation amount. */
    closedWithoutInvoiceValue: number;
    closedInternalCount: number;
    closedInternalValue: number;
    closedWarrantyCount: number;
    closedWarrantyValue: number;
    /** Open internal / warranty jobs — part of the open job value but never invoiced. */
    openNonInvoicedCount: number;
    openNonInvoicedValue: number;
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
    jobsInvoicedByMonth: ChartBucket[];
    jobsInvoicedByWeek: ChartBucket[];
    quotationPerformance: { withinSla: number; outsideSla: number };
    slaComplianceTrend: ChartBucket[];
  };
}

export interface DashboardPeriod {
  month: string; // "2026-10"
  label: string; // "October 2026"
  start: string;
  /** Pipeline figures are as of this instant: month end, or now for the current month. */
  asOf: string;
  isCurrentMonth: boolean;
}

export interface MonthInvoicedRow {
  id: string;
  referenceNumber: string;
  customer: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAmount: number;
  poValue: number;
}

export interface MonthAwaitingPoRow {
  id: string;
  referenceNumber: string;
  customer: string;
  quotedDate: string | null;
  daysWaiting: number;
  targetDays: number;
  overdue: boolean;
  quotationAmount: number;
  poValue: number;
}

export interface MonthReceivedRow {
  id: string;
  referenceNumber: string;
  customer: string;
  jobType: JobType;
  jobCreatedDate: string | null;
  currentStage: StageName;
  poValue: number;
}

export interface MonthClosedNoInvoiceRow {
  id: string;
  referenceNumber: string;
  customer: string;
  jobType: JobType;
  closingDate: string | null;
  value: number;
  comments: string | null;
}

export interface MonthDetail {
  invoiced: MonthInvoicedRow[];
  awaitingPo: MonthAwaitingPoRow[];
  received: MonthReceivedRow[];
  closedNoInvoice: MonthClosedNoInvoiceRow[];
}

export type ForecastOutcome = "INVOICED" | "INVOICED_EARLY" | "PENDING" | "SLIPPED" | "UNPLANNED" | "CLOSED_NO_INVOICE" | "REMOVED";

export interface ForecastFactor {
  text: string;
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
  currentForecastMonth: string | null;
  cause: string | null;
  missingWo: boolean;
  factors: ForecastFactor[];
  note: { comment: string; by: string; at: string } | null;
}

export interface ForecastReport {
  month: string;
  /** false = month is before forecasting started */
  tracked: boolean;
  /** true = launch month: compared against the live forecast (nothing was locked before it began) */
  provisional: boolean;
  isCurrentMonth: boolean;
  asOf: string;
  summary: {
    forecastTotal: number;
    forecastCount: number;
    invoicedTotal: number;
    invoicedCount: number;
    achievedPercent: number | null;
    deliveredTotal: number;
    deliveredCount: number;
    /** Forecast amount of forecast jobs not invoiced (job-level). */
    notInvoicedTotal: number;
    notInvoicedCount: number;
    /** Still needed to reach the forecast: forecast − all invoiced in the month. */
    remainingTotal: number;
    /** Invoiced beyond the forecast. */
    aboveForecastTotal: number;
    unplannedTotal: number;
    unplannedCount: number;
    latestForecastTotal: number;
  };
  causes: { cause: string; count: number; amount: number }[];
  noWo: { count: number; amount: number };
  rows: ForecastRow[];
}

export interface DashboardResponse extends DashboardSummary {
  /** Forecast vs invoiced for the selected month (null in the all-time view). */
  forecast: ForecastReport | null;
  /** null = all-time view */
  period: DashboardPeriod | null;
  monthDetail: MonthDetail | null;
  /** "YYYY-MM", newest first */
  availableMonths: string[];
}

/** `month` is "YYYY-MM", or "all" for all-time figures. */
export function useDashboardSummary(month: string) {
  return useQuery({
    queryKey: ["dashboard", "summary", month],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardResponse>("/dashboard/summary", { params: { month } });
      return data;
    },
    // Keep showing the previous month while the next one loads, instead of flashing a spinner.
    placeholderData: keepPreviousData,
    // Changes made in the app refresh it straight away (mutations invalidate it); this only picks up
    // other people's changes.
    refetchInterval: 120_000,
  });
}

/** Saves (or, with an empty comment, removes) the planner's comment on a job's forecast outcome. */
export function useSaveForecastNote(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, comment }: { jobId: string; comment: string }) => {
      await apiClient.put(`/forecast/${month}/notes/${jobId}`, { comment });
    },
    onSuccess: (_data, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId, "audit"] });
    },
  });
}

export interface ForecastMonthStatus {
  month: string;
  started: boolean;
  /** The month's forecast has been locked (measured against). */
  locked: boolean;
  /** Launch month: compared against the live forecast. */
  provisional: boolean;
  /** When the month's forecast locks (the moment the previous month ends). */
  locksAt: string;
}

export function useForecastMonthStatus(month: string) {
  return useQuery({
    queryKey: ["forecast", "status", month],
    queryFn: async () => {
      const { data } = await apiClient.get<ForecastMonthStatus>(`/forecast/${month}/status`);
      return data;
    },
  });
}

type AssignForecastInput = { set?: { jobId: string; amount: number }[]; clear?: string[] };

/** The Forecast page's job list (all jobs, no filters). */
const FORECAST_JOBS_KEY = ["jobs", {}];

/**
 * The Forecast page's tick boxes: add jobs to / remove jobs from a month's forecast. The job list
 * is updated in place straight away, rather than refetching every job after each tick.
 */
export function useAssignForecast(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignForecastInput) => {
      const { data } = await apiClient.put<{ updated: number }>(`/forecast/${month}/jobs`, input);
      return data;
    },
    onMutate: async ({ set = [], clear = [] }) => {
      await queryClient.cancelQueries({ queryKey: FORECAST_JOBS_KEY, exact: true });
      const previous = queryClient.getQueryData<Job[]>(FORECAST_JOBS_KEY);
      const amounts = new Map(set.map((s) => [s.jobId, s.amount]));
      queryClient.setQueryData<Job[]>(FORECAST_JOBS_KEY, (jobs) =>
        jobs?.map((job) => {
          if (amounts.has(job.id)) return { ...job, forecastMonth: month, forecastAmount: amounts.get(job.id)! };
          if (clear.includes(job.id) && job.forecastMonth === month) return { ...job, forecastMonth: null, forecastAmount: null };
          return job;
        })
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(FORECAST_JOBS_KEY, context.previous);
      queryClient.invalidateQueries({ queryKey: FORECAST_JOBS_KEY, exact: true });
    },
    onSettled: () => {
      // Other job views pick the change up next time they're shown.
      queryClient.invalidateQueries({ queryKey: ["jobs"], refetchType: "none" });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["forecast"] });
    },
  });
}
