import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { CustomerPerformanceRow } from "../../api/dashboard";
import { EmptyChartState } from "./charts/ChartCard";

function complianceColor(percent: number): string {
  if (percent >= 90) return "success.main";
  if (percent >= 70) return "warning.main";
  return "error.main";
}

export function CustomerPerformanceTable({ rows }: { rows: CustomerPerformanceRow[] }) {
  if (rows.length === 0) return <EmptyChartState />;

  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Customer</TableCell>
            <TableCell align="right">Jobs</TableCell>
            <TableCell align="right">Avg Turnaround</TableCell>
            <TableCell align="right">SLA Compliance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.customer}>
              <TableCell>{row.customer}</TableCell>
              <TableCell align="right">{row.jobCount}</TableCell>
              <TableCell align="right">
                {row.avgTurnaroundDays !== null ? `${row.avgTurnaroundDays} days` : "—"}
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={600} color={complianceColor(row.slaCompliancePercent)}>
                  {row.slaCompliancePercent}%
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
