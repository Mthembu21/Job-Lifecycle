import { ReactNode, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./Button";

interface DialogProps {
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: "xs" | "sm";
}

/** Always-open modal; mount it conditionally (`{open && <Dialog …/>}`). */
export function Dialog({ onClose, title, children, actions, size = "sm" }: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative my-8 w-full rounded-xl border-t-4 border-yellow bg-white shadow-2xl dark:bg-gray-900",
          size === "xs" ? "max-w-md" : "max-w-2xl"
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {title}
          </h2>
          <IconButton label="Close" size="sm" onClick={onClose} className="-mr-2">
            <X />
          </IconButton>
        </div>
        <div className="px-6 pb-5 text-sm text-gray-700 dark:text-gray-300">{children}</div>
        {actions && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-gray-100 bg-gray-50 px-6 py-3.5 dark:border-gray-800 dark:bg-gray-950/40">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
