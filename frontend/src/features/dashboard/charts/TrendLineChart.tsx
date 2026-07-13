import { LineChart } from "@mui/x-charts/LineChart";
import { Box } from "@mui/material";
import { EmptyChartState } from "./ChartCard";

interface Series {
  label: string;
  data: number[];
  color: string;
}

interface TrendLineChartProps {
  categories: string[];
  series: Series[];
  height?: number;
  valueFormatter?: (value: number | null) => string;
}

export function TrendLineChart({ categories, series, height = 260, valueFormatter }: TrendLineChartProps) {
  if (categories.length === 0) return <EmptyChartState />;

  return (
    <Box sx={{ width: "100%", minWidth: 480 }}>
      <LineChart
        height={height}
        xAxis={[{ scaleType: "point", data: categories }]}
        series={series.map((s) => ({
          data: s.data,
          label: s.label,
          color: s.color,
          curve: "monotoneX",
          valueFormatter,
        }))}
        slotProps={{ legend: { hidden: series.length < 2 } }}
        grid={{ horizontal: true }}
        margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
      />
    </Box>
  );
}
