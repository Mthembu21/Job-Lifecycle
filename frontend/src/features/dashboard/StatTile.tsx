import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, cn } from "../../components/ui";

type Tone = "default" | "warning" | "critical" | "good";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: Tone;
  /** Small line under the value, e.g. a count behind an amount. */
  sub?: ReactNode;
  /** Extra content under the value (e.g. a progress bar). */
  children?: ReactNode;
}

const ICON_TONE: Record<Tone, string> = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  warning: "bg-yellow text-gray-900",
  critical: "bg-danger-soft text-danger dark:bg-danger/20 dark:text-danger-light",
  good: "bg-success-soft text-success dark:bg-success/20 dark:text-success-light",
};

const BORDER_TONE: Record<Tone, string | false> = {
  default: false,
  warning: "border-l-4 border-l-yellow",
  critical: "border-l-4 border-l-danger",
  good: "border-l-4 border-l-success",
};

export function StatTile({ label, value, icon: Icon, tone = "default", sub, children }: StatTileProps) {
  return (
    <Card className={cn("flex h-full items-start justify-between gap-3 p-4", BORDER_TONE[tone])}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p
          className="mt-1 truncate text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-gray-50"
          title={String(value)}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        {children}
      </div>
      {Icon && (
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone])}>
          <Icon className="size-5" />
        </span>
      )}
    </Card>
  );
}
