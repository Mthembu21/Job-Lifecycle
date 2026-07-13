import { Chip } from "@mui/material";
import { StageStatus } from "../../types";

const STATUS_CONFIG: Record<
  StageStatus | "CLOSED",
  { label: string; color: "default" | "info" | "success" | "error" }
> = {
  NOT_STARTED: { label: "Not started", color: "default" },
  IN_PROGRESS: { label: "In progress", color: "info" },
  COMPLETED: { label: "Completed", color: "success" },
  DELAYED: { label: "Delayed", color: "error" },
  CLOSED: { label: "Closed", color: "success" },
};

export function StageStatusChip({ status }: { status: StageStatus | "CLOSED" }) {
  const config = STATUS_CONFIG[status];
  return <Chip size="small" label={config.label} color={config.color} />;
}
