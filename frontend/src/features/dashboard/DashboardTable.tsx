import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { STICKY_THEAD, TD as TD_BASE } from "../../components/ui/Table";

export const TD = `${TD_BASE} whitespace-nowrap`;

/** A scrolling table with a sticky header and an optional sticky total row, as used across the dashboard. */
export function DashboardTable({
  head,
  children,
  footer,
  maxHeight = 420,
}: {
  head: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: number;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800" style={{ maxHeight }}>
      <table className="w-full text-sm">
        <thead className={STICKY_THEAD}>
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
        {footer && (
          <tfoot className="sticky bottom-0 border-t-2 border-yellow bg-gray-50 font-semibold dark:bg-gray-800">
            <tr>{footer}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Props that make a table row open its job. */
export function useJobRowLink() {
  const navigate = useNavigate();
  return (id: string) => ({
    onClick: () => navigate(`/jobs/${id}`),
    className: "cursor-pointer transition-colors hover:bg-yellow-soft/60 dark:hover:bg-yellow/5",
  });
}
