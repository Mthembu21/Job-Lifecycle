import { Card, CardContent, Stack, Typography } from "@mui/material";
import { SvgIconComponent } from "@mui/icons-material";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: SvgIconComponent;
  tone?: "default" | "warning" | "critical";
}

const TONE_COLOR: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "primary.main",
  warning: "warning.main",
  critical: "error.main",
};

export function StatTile({ label, value, icon: Icon, tone = "default" }: StatTileProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {value}
            </Typography>
          </Stack>
          <Icon sx={{ color: TONE_COLOR[tone], opacity: 0.8 }} />
        </Stack>
      </CardContent>
    </Card>
  );
}
