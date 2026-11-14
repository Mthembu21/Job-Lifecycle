import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useThemeMode } from "../../../theme/ThemeProvider";
import { getChartChrome } from "../../../theme/chartPalette";
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
  /** "vertical" = upright columns, "horizontal" = bars running left→right. */
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
  const { mode } = useThemeMode();
  const chrome = getChartChrome(mode);
  if (categories.length === 0) return <EmptyChartState />;

  const rows = categories.map((label, i) => {
    const row: Record<string, string | number> = { label };
    series.forEach((s, si) => (row[`s${si}`] = s.data[i]));
    return row;
  });
  const format = (v: unknown) => (valueFormatter ? valueFormatter(typeof v === "number" ? v : null) : String(v));
  const horizontal = layout === "horizontal";
  const tick = { fill: chrome.text, fontSize: 12 };

  return (
    <div className={horizontal ? "w-full min-w-[320px]" : "w-full min-w-[420px]"} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 20, right: 20, bottom: 4, left: 4 }}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={chrome.grid} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={tick} stroke={chrome.axis} tickLine={false} tickFormatter={(v) => format(v)} />
              <YAxis type="category" dataKey="label" tick={tick} stroke={chrome.axis} tickLine={false} width={120} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={tick} stroke={chrome.axis} tickLine={false} interval={0} />
              <YAxis
                tick={tick}
                stroke={chrome.axis}
                tickLine={false}
                axisLine={false}
                width={valueFormatter ? 72 : 40}
                tickFormatter={(v) => format(v)}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: chrome.grid, opacity: 0.5 }}
            formatter={(v) => format(v)}
            contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: chrome.text, fontWeight: 600 }}
          />
          {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 13, color: chrome.text }} />}
          {series.map((s, si) => (
            <Bar key={s.label} dataKey={`s${si}`} name={s.label} fill={s.color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
              <LabelList
                dataKey={`s${si}`}
                position={horizontal ? "right" : "top"}
                formatter={(v: unknown) => format(v)}
                style={{ fill: chrome.text, fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
