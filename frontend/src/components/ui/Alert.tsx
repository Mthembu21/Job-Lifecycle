import { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./cn";

type Severity = "error" | "warning" | "success" | "info";

const STYLE: Record<Severity, string> = {
  error: "border-danger/30 bg-danger-soft text-danger dark:bg-danger/15 dark:text-danger-light",
  warning: "border-yellow bg-yellow-soft text-gray-900 dark:bg-yellow/10 dark:text-yellow",
  success: "border-success/30 bg-success-soft text-success dark:bg-success/15 dark:text-success-light",
  info: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
};

const ICON: Record<Severity, ReactNode> = {
  error: <XCircle />,
  warning: <AlertTriangle />,
  success: <CheckCircle2 />,
  info: <Info />,
};

export function Alert({ severity = "info", children, className }: { severity?: Severity; children: ReactNode; className?: string }) {
  return (
    <div
      role={severity === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", STYLE[severity], className)}
    >
      {ICON[severity]}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
