import { Chip } from "@mui/material";
import { SlaColor } from "../../types";

const SLA_CONFIG: Record<SlaColor, { label: string; color: "success" | "warning" | "error" | "default" }> = {
  GREEN: { label: "On track", color: "success" },
  AMBER: { label: "Approaching SLA", color: "warning" },
  RED: { label: "Overdue", color: "error" },
  NOT_APPLICABLE: { label: "N/A", color: "default" },
};

export function SlaChip({ status }: { status: SlaColor }) {
  const config = SLA_CONFIG[status];
  return <Chip size="small" label={config.label} color={config.color} variant={status === "NOT_APPLICABLE" ? "outlined" : "filled"} />;
}
