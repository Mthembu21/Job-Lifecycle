import { Badge, BadgeTone } from "../../components/ui";
import { StageStatus } from "../../types";

const STATUS_CONFIG: Record<StageStatus | "CLOSED", { label: string; tone: BadgeTone }> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "dark" },
  COMPLETED: { label: "Completed", tone: "success" },
  DELAYED: { label: "Delayed", tone: "danger" },
  CLOSED: { label: "Closed", tone: "success" },
};

export function StageStatusChip({ status }: { status: StageStatus | "CLOSED" }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
