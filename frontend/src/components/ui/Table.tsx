import { ReactNode } from "react";

/** Shared table styling, so every list in the app looks the same. */
export const TH =
  "px-3 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-600 uppercase dark:text-gray-300";
export const TD = "px-3 py-2.5";

/**
 * `<thead>` classes for a header that stays put while the rows scroll. A box-shadow stands in for
 * the bottom border, which doesn't stick with the header.
 */
export const STICKY_THEAD =
  "sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_var(--color-gray-200)] dark:bg-gray-800 dark:shadow-[0_1px_0_var(--color-gray-700)]";

/** A full-width row for "nothing to show" messages. */
export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
        {children}
      </td>
    </tr>
  );
}
