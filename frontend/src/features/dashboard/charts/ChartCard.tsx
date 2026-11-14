import { ReactNode } from "react";
import { Card, CardTitle } from "../../../components/ui";

export function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <CardTitle action={action}>{title}</CardTitle>
      <div className="w-full flex-1 overflow-x-auto">{children}</div>
    </Card>
  );
}

export function EmptyChartState() {
  return <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No data yet.</p>;
}
