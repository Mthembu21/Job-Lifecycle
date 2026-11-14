import { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "outline" | "brand" | "dark" | "success" | "warning" | "danger";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  outline: "border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300",
  brand: "bg-yellow-soft text-gray-900 ring-1 ring-yellow/60 ring-inset dark:bg-yellow/15 dark:text-yellow",
  dark: "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900",
  success: "bg-success-soft text-success dark:bg-success/20 dark:text-success-light",
  warning: "bg-yellow text-gray-900",
  danger: "bg-danger-soft text-danger dark:bg-danger/20 dark:text-danger-light",
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

export function Badge({ tone = "neutral", icon, children, size = "sm", onClick, className }: BadgeProps) {
  const classes = cn(
    "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:size-3.5",
    size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-sm",
    TONE[tone],
    onClick && "transition-opacity hover:opacity-85",
    className
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {icon}
        {children}
      </button>
    );
  }
  return (
    <span className={classes}>
      {icon}
      {children}
    </span>
  );
}
