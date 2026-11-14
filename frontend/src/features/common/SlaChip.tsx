import { Badge, BadgeTone } from "../../components/ui";
import { SlaColor } from "../../types";

const SLA_CONFIG: Record<SlaColor, { label: string; tone: BadgeTone }> = {
  GREEN: { label: "On track", tone: "success" },
  AMBER: { label: "Approaching SLA", tone: "warning" },
  RED: { label: "Overdue", tone: "danger" },
  NOT_APPLICABLE: { label: "N/A", tone: "outline" },
};

export function SlaChip({ status }: { status: SlaColor }) {
  const config = SLA_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
