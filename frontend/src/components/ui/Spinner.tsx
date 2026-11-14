import { cn } from "./cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block size-8 animate-spin rounded-full border-[3px] border-gray-300 border-t-yellow dark:border-gray-600 dark:border-t-yellow", className)}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
