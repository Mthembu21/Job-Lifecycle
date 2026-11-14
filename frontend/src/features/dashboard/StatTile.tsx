import type { LucideIcon } from "lucide-react";
import { Card, cn } from "../../components/ui";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "critical";
  /** Small line under the value, e.g. a count behind an amount. */
  sub?: string;
}

const ICON_TONE: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  warning: "bg-yellow text-gray-900",
  critical: "bg-danger-soft text-danger dark:bg-danger/20 dark:text-danger-light",
};

export function StatTile({ label, value, icon: Icon, tone = "default", sub }: StatTileProps) {
  return (
    <Card
      className={cn(
        "flex h-full items-start justify-between gap-3 p-4",
        tone === "critical" && "border-l-4 border-l-danger",
        tone === "warning" && "border-l-4 border-l-yellow"
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
      </div>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone])}>
        <Icon className="size-5" />
      </span>
    </Card>
  );
}
