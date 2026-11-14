import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardX,
  FileText,
  Hourglass,
  Receipt,
  ReceiptText,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { useDashboardSummary } from "../../api/dashboard";
import { useThemeMode } from "../../theme/ThemeProvider";
import { getCategoricalPalette, STATUS_COLORS } from "../../theme/chartPalette";
import { StatTile } from "./StatTile";
import { ChartCard } from "./charts/ChartCard";
import { TrendLineChart } from "./charts/TrendLineChart";
import { CategoryBarChart } from "./charts/CategoryBarChart";
import { MonthDetailCard } from "./MonthDetailCard";
import { ForecastSection } from "./ForecastSection";
import { MonthPicker } from "./MonthPicker";
import { currentMonthKey } from "../../utils/month";
import { formatCurrency as currency } from "../../utils/currency";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader, PageSpinner, SectionHeading, Segmented } from "../../components/ui";

type Period = "month" | "week";

function formatAsOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function DashboardPage() {
  const { user } = useAuth();
  // The selected month lives in the URL (?month=2026-10 / ?month=all) so it survives refresh,
  // back/forward, and can be shared. Default: the current month.
  const [searchParams, setSearchParams] = useSearchParams();
  const month = searchParams.get("month") ?? currentMonthKey();
  const { data, isLoading, isPlaceholderData } = useDashboardSummary(month);
  const { mode } = useThemeMode();
  const categorical = getCategoricalPalette(mode);
  const [jobsPeriod, setJobsPeriod] = useState<Period>("month");
  const [financePeriod, setFinancePeriod] = useState<Period>("month");

  if (user?.role === "STOREMAN") {
    return <Navigate to="/jobs" replace />;
  }

  function selectMonth(next: string) {
    setSearchParams(next === currentMonthKey() ? {} : { month: next });
  }

  const picker = <MonthPicker value={month} months={data?.availableMonths ?? []} onChange={selectMonth} />;

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Dashboard">{picker}</PageHeader>
        <PageSpinner />
      </div>
    );
  }

  const { kpis, charts, period, monthDetail, forecast } = data;
  const isMonth = period !== null;
  const periodName = period?.label ?? "All time";
  // Where the pipeline numbers are measured.
  const asOfLabel = !period || period.isCurrentMonth ? "today" : `at ${formatAsOf(period.asOf)}`;
  const trendOptions: { value: Period; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "week", label: isMonth ? "Weeks of month" : "Week" },
  ];

  const jobsTrend = jobsPeriod === "month" ? charts.jobsCreatedByMonth : charts.jobsCreatedByWeek;
  const jobsInvoicedTrend = jobsPeriod === "month" ? charts.jobsInvoicedByMonth : charts.jobsInvoicedByWeek;
  const invoiceTrend = financePeriod === "month" ? charts.invoiceValueByMonth : charts.invoiceValueByWeek;
  const jobValueTrend = financePeriod === "month" ? charts.jobValueByMonth : charts.jobValueByWeek;

  return (
    // Dim only while switching months (old month shown as a placeholder), not on background refreshes.
    <div className={isPlaceholderData ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <PageHeader
        title="Dashboard"
        subtitle={
          isMonth
            ? `${periodName} — activity during the month, pipeline ${asOfLabel}`
            : "All jobs in the system — pipeline as of today"
        }
      >
        {picker}
      </PageHeader>

      <SectionHeading>{isMonth ? `${periodName} activity` : "All-time totals"}</SectionHeading>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9">
        <StatTile label={isMonth ? "Jobs Received" : "Total Jobs Created"} value={kpis.totalJobsCreated} icon={Briefcase} />
        <StatTile label="Jobs Invoiced" value={kpis.jobsInvoiced} icon={ReceiptText} />
        <StatTile wide label={isMonth ? "Invoiced Value" : "Total Invoiced Value"} value={currency(kpis.totalInvoicedValue)} icon={Wallet} />
        <StatTile label="Jobs Closed" value={kpis.closedJobs} icon={CheckCircle2} />
        <StatTile
          wide
          label="Closed Without Invoice"
          value={currency(kpis.closedWithoutInvoiceValue)}
          sub={`${kpis.closedInternalCount} internal · ${kpis.closedWarrantyCount} warranty`}
          icon={Building2}
        />
        <StatTile label="Avg Turnaround Time" value={`${kpis.avgTurnaroundDays} days`} icon={Activity} />
        <StatTile label="Avg Days to WO Number" value={`${kpis.avgDaysToWoNumber} days`} icon={CalendarClock} />
      </div>

      <SectionHeading>Pipeline {asOfLabel}</SectionHeading>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-9">
        <StatTile label="Waiting for Quotation" value={kpis.waitingForQuotation} icon={FileText} />
        <StatTile label="Waiting for PO" value={kpis.waitingForPO} icon={Hourglass} />
        <StatTile label="Jobs in Repair" value={kpis.inRepair} icon={Wrench} />
        <StatTile label="Ready for Dispatch" value={kpis.readyForDispatch} icon={Truck} />
        <StatTile label="Awaiting Invoice" value={kpis.awaitingInvoice} icon={Receipt} />
        <StatTile
          label="Delayed Jobs"
          value={kpis.delayedJobs}
          icon={AlertTriangle}
          tone={kpis.delayedJobs > 0 ? "critical" : "default"}
        />
        <StatTile wide label="Open Job Value" value={currency(kpis.totalOpenJobValue)} icon={Banknote} />
        <StatTile
          label="Awaiting WO Number"
          value={kpis.jobsAwaitingWoNumber}
          icon={ClipboardX}
          tone={kpis.jobsAwaitingWoNumber > 0 ? "warning" : "default"}
        />
      </div>

      {forecast && <ForecastSection report={forecast} />}

      {period && monthDetail && <MonthDetailCard detail={monthDetail} periodLabel={period.label} asOfLabel={asOfLabel} />}

      <SectionHeading>Volume &amp; Financials</SectionHeading>
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={isMonth ? `Jobs Created vs Invoiced — to ${periodName}` : "Jobs Created vs Invoiced"}
          action={<Segmented label="Jobs period" value={jobsPeriod} options={trendOptions} onChange={setJobsPeriod} />}
        >
          <TrendLineChart
            categories={jobsTrend.map((b) => b.label)}
            series={[
              { label: "Jobs Created", data: jobsTrend.map((b) => b.value), color: categorical[0] },
              { label: "Jobs Invoiced", data: jobsInvoicedTrend.map((b) => b.value), color: categorical[1] },
            ]}
          />
        </ChartCard>
        <ChartCard
          title={isMonth ? `Invoice & Job Value — to ${periodName}` : "Invoice & Job Value Trend"}
          action={
            <Segmented label="Finance period" value={financePeriod} options={trendOptions} onChange={setFinancePeriod} />
          }
        >
          <TrendLineChart
            categories={invoiceTrend.map((b) => b.label)}
            series={[
              { label: "Invoice Value", data: invoiceTrend.map((b) => b.value), color: categorical[0] },
              { label: "Job Value", data: jobValueTrend.map((b) => b.value), color: categorical[1] },
            ]}
            valueFormatter={(v) => (v === null ? "" : currency(v))}
          />
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard title={isMonth ? `Value Breakdown — ${periodName}` : "Value Breakdown"}>
            <CategoryBarChart
              categories={charts.valueBreakdown.map((b) => b.label)}
              series={[{ label: "Value", data: charts.valueBreakdown.map((b) => b.value), color: categorical[0] }]}
              valueFormatter={(v) => (v === null ? "" : currency(v))}
            />
          </ChartCard>
        </div>
      </div>

      <SectionHeading>Lifecycle Performance</SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <ChartCard title={isMonth ? `Jobs Received by Type — ${periodName}` : "Jobs by Type"}>
            <CategoryBarChart
              categories={charts.jobsByType.map((b) => b.label)}
              series={[{ label: "Jobs", data: charts.jobsByType.map((b) => b.value), color: categorical[0] }]}
            />
          </ChartCard>
        </div>
        <div className="xl:col-span-2">
          <ChartCard title={`Jobs by Stage — ${asOfLabel}`}>
            <CategoryBarChart
              categories={charts.jobsByStage.map((b) => b.label)}
              series={[{ label: "Jobs", data: charts.jobsByStage.map((b) => b.value), color: categorical[1] }]}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title={isMonth ? `Average Days per Stage — completed in ${periodName}` : "Average Days per Stage (Actual vs Target)"}>
            <CategoryBarChart
              categories={charts.avgDaysPerStage.map((s) => s.label)}
              series={[
                { label: "Actual", data: charts.avgDaysPerStage.map((s) => s.actualDays), color: categorical[0] },
                { label: "Target", data: charts.avgDaysPerStage.map((s) => s.targetDays), color: categorical[2] },
              ]}
              valueFormatter={(v) => (v === null ? "" : `${v} days`)}
            />
          </ChartCard>
        </div>
        <ChartCard title={isMonth ? `Quotations Issued — ${periodName}` : "Quotation Performance"}>
          <div className="mt-1 flex flex-col gap-3">
            <div className="rounded-lg border-l-4 border-success bg-success-soft px-4 py-3 dark:bg-success/15">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Within SLA</p>
              <p className="text-2xl font-bold text-success dark:text-success-light">
                {charts.quotationPerformance.withinSla}
              </p>
            </div>
            <div className="rounded-lg border-l-4 border-danger bg-danger-soft px-4 py-3 dark:bg-danger/15">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Outside SLA</p>
              <p className="text-2xl font-bold text-danger dark:text-danger-light">
                {charts.quotationPerformance.outsideSla}
              </p>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="SLA Compliance Trend">
          <TrendLineChart
            categories={charts.slaComplianceTrend.map((b) => b.label)}
            series={[{ label: "SLA Compliance", data: charts.slaComplianceTrend.map((b) => b.value), color: STATUS_COLORS.good }]}
            valueFormatter={(v) => (v === null ? "" : `${v}%`)}
          />
        </ChartCard>
      </div>
    </div>
  );
}
