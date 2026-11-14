import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { JobType, StageName } from "../types";
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
  kind: "month" | "year";
  key: string; // "2026-10" or "2026"
  label: string; // "October 2026" or "2026"
  start: string;
  /** Pipeline figures are as of this instant: the period end, or now for the current month / year. */
  asOf: string;
  isCurrent: boolean;
}

/** One month in a year's forecast summary. */
export interface YearForecastMonth {
  month: string;
  tracked: boolean;
  provisional: boolean;
  isCurrentMonth: boolean;
  forecastTotal: number;
  invoicedTotal: number;
  achievedPercent: number | null;
  notInvoicedTotal: number;
  backdatedTotal: number;
}

export interface YearForecast {
  year: number;
  months: YearForecastMonth[];
  /** Over months that had a forecast. */
  totals: { trackedMonths: number; forecastTotal: number; invoicedTotal: number; achievedPercent: number | null };
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
  /** Added to the month's forecast after the month ended. */
  backdated: boolean;
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
    /** Part of the forecast added after the month ended. */
    backdatedTotal: number;
    backdatedCount: number;
  };
  causes: { cause: string; count: number; amount: number }[];
  noWo: { count: number; amount: number };
  rows: ForecastRow[];
}

export interface DashboardResponse extends DashboardSummary {
  period: DashboardPeriod;
  monthDetail: MonthDetail;
  /** Forecast vs invoiced for a month view (null for a year). */
  forecast: ForecastReport | null;
  /** Month-by-month forecast summary for a year view (null for a month). */
  yearForecast: YearForecast | null;
  /** "YYYY-MM", newest first */
  availableMonths: string[];
  /** "YYYY", newest first */
  availableYears: string[];
}

/** `period` is a month ("2026-10") or a year ("2026"). */
export function useDashboardSummary(period: string) {
  return useQuery({
    queryKey: ["dashboard", "summary", period],
    queryFn: async () => {
      const params = period.length === 4 ? { year: period } : { month: period };
      const { data } = await apiClient.get<DashboardResponse>("/dashboard/summary", { params });
      return data;
    },
    // Keep showing the previous period while the next one loads, instead of flashing a spinner.
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
  /** The month has ended but can still be backdated (previous month only). */
  backdating: boolean;
}

/** A committed (locked or backdated) forecast entry of a past month. */
export interface CommittedForecastEntry {
  jobId: string;
  amount: number;
  /** false = locked when the month ended (can't be changed). */
  backdated: boolean;
}

/** The previous month's committed forecast, for backdating on the Forecast page. */
export function useCommittedForecast(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ["forecast", "committed", month],
    queryFn: async () => {
      const { data } = await apiClient.get<CommittedForecastEntry[]>(`/forecast/${month}/committed`);
      return data;
    },
    enabled,
  });
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

export type AssignForecastInput = { set?: { jobId: string; amount: number }[]; clear?: string[] };

/**
 * Saves the Forecast page's selection for a month: `set` jobs (with amounts) are added or updated,
 * `clear` jobs taken out. For the previous month the server applies it as backdating.
 */
export function useAssignForecast(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignForecastInput) => {
      const { data } = await apiClient.put<{ updated: number }>(`/forecast/${month}/jobs`, input);
      return data;
    },
    // Returning the refetches makes the save "finish" only once the page shows the saved data,
    // so the unsaved marks can be cleared without the ticks flickering back.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["forecast"] }),
      ]),
  });
}
