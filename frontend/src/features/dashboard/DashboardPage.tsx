import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, Card, CardContent, CircularProgress, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import BuildIcon from "@mui/icons-material/Build";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import PaidIcon from "@mui/icons-material/Paid";
import TimelineIcon from "@mui/icons-material/Timeline";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { useDashboardSummary } from "../../api/dashboard";
import { useThemeMode } from "../../theme/ThemeProvider";
import { getCategoricalPalette, getStatusPalette } from "../../theme/chartPalette";
import { StatTile } from "./StatTile";
import { ChartCard } from "./charts/ChartCard";
import { TrendLineChart } from "./charts/TrendLineChart";
import { CategoryBarChart } from "./charts/CategoryBarChart";
import { formatCurrency as currency } from "../../utils/currency";
import { useAuth } from "../../auth/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardSummary();
  const { mode } = useThemeMode();
  const categorical = getCategoricalPalette(mode);
  const status = getStatusPalette(mode);
  const [jobsPeriod, setJobsPeriod] = useState<"month" | "week">("month");
  const [financePeriod, setFinancePeriod] = useState<"month" | "week">("month");

  if (user?.role === "STOREMAN") {
    return <Navigate to="/jobs" replace />;
  }

  if (isLoading || !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const { kpis, charts } = data;

  const jobsTrend = jobsPeriod === "month" ? charts.jobsCreatedByMonth : charts.jobsCreatedByWeek;
  const invoiceTrend = financePeriod === "month" ? charts.invoiceValueByMonth : charts.invoiceValueByWeek;
  const jobValueTrend = financePeriod === "month" ? charts.jobValueByMonth : charts.jobValueByWeek;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Total Jobs Created" value={kpis.totalJobsCreated} icon={WorkOutlineIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Waiting for Quotation" value={kpis.waitingForQuotation} icon={RequestQuoteIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Waiting for PO" value={kpis.waitingForPO} icon={HourglassEmptyIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Jobs in Repair" value={kpis.inRepair} icon={BuildIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Ready for Dispatch" value={kpis.readyForDispatch} icon={LocalShippingIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Awaiting Invoice" value={kpis.awaitingInvoice} icon={ReceiptLongIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Closed Jobs" value={kpis.closedJobs} icon={CheckCircleIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile
            label="Delayed Jobs"
            value={kpis.delayedJobs}
            icon={WarningAmberIcon}
            tone={kpis.delayedJobs > 0 ? "critical" : "default"}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Total Open Job Value" value={currency(kpis.totalOpenJobValue)} icon={AttachMoneyIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Total Invoiced Value" value={currency(kpis.totalInvoicedValue)} icon={PaidIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Avg Turnaround Time" value={`${kpis.avgTurnaroundDays} days`} icon={TimelineIcon} />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile
            label="Jobs Awaiting WO Number"
            value={kpis.jobsAwaitingWoNumber}
            icon={AssignmentLateIcon}
            tone={kpis.jobsAwaitingWoNumber > 0 ? "warning" : "default"}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatTile label="Avg Days to WO Number" value={`${kpis.avgDaysToWoNumber} days`} icon={EventNoteIcon} />
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
        Volume &amp; Financials
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Jobs Created">
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={jobsPeriod}
                onChange={(_e, v) => v && setJobsPeriod(v)}
              >
                <ToggleButton value="month">Month</ToggleButton>
                <ToggleButton value="week">Week</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <TrendLineChart
              categories={jobsTrend.map((b) => b.label)}
              series={[{ label: "Jobs Created", data: jobsTrend.map((b) => b.value), color: categorical[0] }]}
            />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Invoice &amp; Job Value Trend">
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={financePeriod}
                onChange={(_e, v) => v && setFinancePeriod(v)}
              >
                <ToggleButton value="month">Month</ToggleButton>
                <ToggleButton value="week">Week</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <TrendLineChart
              categories={invoiceTrend.map((b) => b.label)}
              series={[
                { label: "Invoice Value", data: invoiceTrend.map((b) => b.value), color: categorical[0] },
                { label: "Job Value", data: jobValueTrend.map((b) => b.value), color: categorical[1] },
              ]}
              valueFormatter={(v) => (v === null ? "" : currency(v))}
            />
          </ChartCard>
        </Grid>
        <Grid item xs={12}>
          <ChartCard title="Value Breakdown">
            <CategoryBarChart
              categories={charts.valueBreakdown.map((b) => b.label)}
              series={[{ label: "Value", data: charts.valueBreakdown.map((b) => b.value), color: categorical[0] }]}
              valueFormatter={(v) => (v === null ? "" : currency(v))}
            />
          </ChartCard>
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
        Lifecycle Performance
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Jobs by Type">
            <CategoryBarChart
              categories={charts.jobsByType.map((b) => b.label)}
              series={[{ label: "Jobs", data: charts.jobsByType.map((b) => b.value), color: categorical[0] }]}
            />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Jobs by Current Stage">
            <CategoryBarChart
              categories={charts.jobsByStage.map((b) => b.label)}
              series={[{ label: "Jobs", data: charts.jobsByStage.map((b) => b.value), color: categorical[1] }]}
            />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Average Days per Stage (Actual vs Target)">
            <CategoryBarChart
              categories={charts.avgDaysPerStage.map((s) => s.label)}
              series={[
                { label: "Actual", data: charts.avgDaysPerStage.map((s) => s.actualDays), color: categorical[0] },
                { label: "Target", data: charts.avgDaysPerStage.map((s) => s.targetDays), color: "#898781" },
              ]}
              valueFormatter={(v) => (v === null ? "" : `${v} days`)}
            />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <ChartCard title="Quotation Performance">
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Card variant="outlined" sx={{ bgcolor: "transparent", borderColor: status.good }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Within SLA
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: status.good }}>
                    {charts.quotationPerformance.withinSla}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ bgcolor: "transparent", borderColor: status.critical }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Outside SLA
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: status.critical }}>
                    {charts.quotationPerformance.outsideSla}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <ChartCard title="SLA Compliance Trend">
            <TrendLineChart
              categories={charts.slaComplianceTrend.map((b) => b.label)}
              series={[{ label: "SLA Compliance", data: charts.slaComplianceTrend.map((b) => b.value), color: status.good }]}
              valueFormatter={(v) => (v === null ? "" : `${v}%`)}
            />
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
