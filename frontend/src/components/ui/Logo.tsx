import logoUrl from "./logo.png";
import { cn } from "./cn";

/**
 * Epiroc wordmark. The PNG is slate on transparent, so on dark surfaces it's
 * flipped to white with a CSS filter rather than shipping a second file.
 *  - "auto":  slate in light mode, white in dark mode
 *  - "white": always white (for permanently dark surfaces)
 *  - "color": always the original slate (for permanently light surfaces like the TV board)
 */
export function Logo({ variant = "auto", className }: { variant?: "auto" | "white" | "color"; className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Epiroc"
      draggable={false}
      className={cn(
        "h-7 w-auto shrink-0 select-none",
        variant === "white" && "brightness-0 invert",
        variant === "auto" && "dark:brightness-0 dark:invert",
        className
      )}
    />
  );
}
