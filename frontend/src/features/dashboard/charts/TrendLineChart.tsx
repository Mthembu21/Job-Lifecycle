import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useThemeMode } from "../../../theme/ThemeProvider";
import { getChartChrome } from "../../../theme/chartPalette";
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
  const { mode } = useThemeMode();
  const chrome = getChartChrome(mode);
  if (categories.length === 0) return <EmptyChartState />;

  const rows = categories.map((label, i) => {
    const row: Record<string, string | number> = { label };
    series.forEach((s, si) => (row[`s${si}`] = s.data[i]));
    return row;
  });
  const format = (v: unknown) => (valueFormatter ? valueFormatter(typeof v === "number" ? v : null) : String(v));

  return (
    <div className="w-full min-w-[420px]" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke={chrome.grid} />
          <XAxis dataKey="label" tick={{ fill: chrome.text, fontSize: 12 }} stroke={chrome.axis} tickLine={false} />
          <YAxis
            tick={{ fill: chrome.text, fontSize: 12 }}
            stroke={chrome.axis}
            tickLine={false}
            axisLine={false}
            width={valueFormatter ? 72 : 40}
            tickFormatter={(v) => format(v)}
          />
          <Tooltip
            formatter={(v) => format(v)}
            contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: chrome.text, fontWeight: 600 }}
          />
          {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 13, color: chrome.text }} />}
          {series.map((s, si) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={`s${si}`}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
