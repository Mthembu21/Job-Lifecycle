import { ChartBucket } from "../../../api/dashboard";
import { CategoryBarChart } from "./CategoryBarChart";

interface RankedBarListProps {
  data: ChartBucket[];
  color: string;
  seriesLabel: string;
  valueFormatter?: (value: number | null) => string;
}

export function RankedBarList({ data, color, seriesLabel, valueFormatter }: RankedBarListProps) {
  return (
    <CategoryBarChart
      categories={data.map((d) => d.label)}
      series={[{ label: seriesLabel, data: data.map((d) => d.value), color }]}
      layout="horizontal"
      height={Math.max(160, data.length * 44)}
      valueFormatter={valueFormatter}
    />
  );
}
