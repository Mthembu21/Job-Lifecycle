import { ReactNode } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Box sx={{ width: "100%", overflowX: "auto" }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

export function EmptyChartState() {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
      No data yet.
    </Typography>
  );
}
