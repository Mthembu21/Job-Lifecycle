import { BarChart } from "@mui/x-charts/BarChart";
import { Box } from "@mui/material";
import { EmptyChartState } from "./ChartCard";

interface Series {
  label: string;
  data: number[];
  color: string;
}

interface CategoryBarChartProps {
  categories: string[];
  series: Series[];
  height?: number;
  layout?: "horizontal" | "vertical";
  valueFormatter?: (value: number | null) => string;
}

export function CategoryBarChart({
  categories,
  series,
  height = 280,
  layout = "vertical",
  valueFormatter,
}: CategoryBarChartProps) {
  if (categories.length === 0) return <EmptyChartState />;

  const bandAxis = { scaleType: "band" as const, data: categories };

  return (
    <Box sx={{ width: "100%", minWidth: layout === "vertical" ? 420 : 320 }}>
      <BarChart
        height={height}
        layout={layout}
        xAxis={layout === "vertical" ? [bandAxis] : undefined}
        yAxis={layout === "horizontal" ? [bandAxis] : undefined}
        series={series.map((s) => ({ data: s.data, label: s.label, color: s.color, valueFormatter }))}
        slotProps={{ legend: { hidden: series.length < 2 } }}
        borderRadius={4}
        barLabel="value"
        margin={{ left: layout === "horizontal" ? 120 : 60, right: 20, top: 20, bottom: 40 }}
      />
    </Box>
  );
}
