import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-yellow text-gray-900 hover:bg-yellow-hover focus-visible:ring-yellow/60 shadow-sm",
  secondary:
    "border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 focus-visible:ring-gray-400/50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
  ghost:
    "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400/50 dark:text-gray-200 dark:hover:bg-gray-800",
  danger: "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40 shadow-sm",
  "danger-outline":
    "border border-danger/50 text-danger hover:bg-danger-soft focus-visible:ring-danger/40 dark:hover:bg-danger/15",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, loading, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  size?: "sm" | "md";
  tone?: "default" | "danger" | "inverse";
}

export function IconButton({ label, size = "md", tone = "default", className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "size-7 [&_svg]:size-4" : "size-9 [&_svg]:size-5",
        tone === "default" &&
          "text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-gray-400/40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100",
        tone === "danger" &&
          "text-gray-500 hover:bg-danger-soft hover:text-danger focus-visible:ring-danger/30 dark:text-gray-400 dark:hover:bg-danger/15",
        tone === "inverse" && "text-gray-200 hover:bg-white/10 hover:text-white focus-visible:ring-white/30",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
