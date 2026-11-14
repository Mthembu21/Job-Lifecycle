import { CustomerPerformanceRow } from "../../api/dashboard";
import { EmptyChartState } from "./charts/ChartCard";

function complianceClass(percent: number): string {
  if (percent >= 90) return "text-success dark:text-success-light";
  if (percent >= 70) return "rounded bg-yellow px-1.5 text-gray-900";
  return "text-danger dark:text-danger-light";
}

export function CustomerPerformanceTable({ rows }: { rows: CustomerPerformanceRow[] }) {
  if (rows.length === 0) return <EmptyChartState />;

  return (
    <div className="max-h-[360px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <tr>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2 text-right">Avg Turnaround</th>
            <th className="px-3 py-2 text-right">SLA Compliance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr key={row.customer}>
              <td className="px-3 py-2">{row.customer}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.jobCount}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.avgTurnaroundDays !== null ? `${row.avgTurnaroundDays} days` : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`font-semibold tabular-nums ${complianceClass(row.slaCompliancePercent)}`}>
                  {row.slaCompliancePercent}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
