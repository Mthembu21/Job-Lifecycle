import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonthDetail } from "../../api/dashboard";
import { STAGE_LABELS } from "../../constants";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import { Badge, Card, Segmented, cn } from "../../components/ui";

type Tab = "invoiced" | "awaitingPo" | "received" | "closedNoInvoice";

const TH = "px-3 py-2 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-600 uppercase dark:text-gray-300";
const TD = "px-3 py-2 whitespace-nowrap";

function Table({ head, children, footer }: { head: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
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

function Empty({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
        {children}
      </td>
    </tr>
  );
}

/** The jobs behind the month's headline numbers: invoiced, waiting for PO, received. */
export function MonthDetailCard({ detail, periodLabel, asOfLabel }: { detail: MonthDetail; periodLabel: string; asOfLabel: string }) {
  const [tab, setTab] = useState<Tab>("invoiced");
  const navigate = useNavigate();
  const row = (id: string) => ({
    onClick: () => navigate(`/jobs/${id}`),
    className: "cursor-pointer transition-colors hover:bg-yellow-soft/60 dark:hover:bg-yellow/5",
  });

  const invoicedTotal = detail.invoiced.reduce((s, r) => s + r.invoiceAmount, 0);
  const awaitingTotal = detail.awaitingPo.reduce((s, r) => s + (r.quotationAmount || r.poValue), 0);
  const receivedTotal = detail.received.reduce((s, r) => s + r.poValue, 0);
  const closedNoInvoiceTotal = detail.closedNoInvoice.reduce((s, r) => s + r.value, 0);

  return (
    <Card className="mb-8 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{periodLabel} in detail</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Click a job to open it</p>
        </div>
        <Segmented
          label="Detail list"
          value={tab}
          onChange={setTab}
          options={[
            { value: "invoiced", label: `Invoiced (${detail.invoiced.length})` },
            { value: "awaitingPo", label: `Waiting for PO (${detail.awaitingPo.length})` },
            { value: "received", label: `Received (${detail.received.length})` },
            { value: "closedNoInvoice", label: `Closed, no invoice (${detail.closedNoInvoice.length})` },
          ]}
        />
      </div>

      {tab === "invoiced" && (
        <Table
          head={
            <>
              <th className={TH}>Reference</th>
              <th className={TH}>Customer</th>
              <th className={TH}>Invoice #</th>
              <th className={TH}>Invoice Date</th>
              <th className={cn(TH, "text-right")}>Invoice Amount</th>
            </>
          }
          footer={
            detail.invoiced.length > 0 && (
              <>
                <td className={TD} colSpan={4}>
                  Total invoiced in {periodLabel}
                </td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(invoicedTotal)}</td>
              </>
            )
          }
        >
          {detail.invoiced.length === 0 && <Empty cols={5}>Nothing invoiced in {periodLabel} yet.</Empty>}
          {detail.invoiced.map((r) => (
            <tr key={r.id} {...row(r.id)}>
              <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
              <td className={TD}>{r.customer}</td>
              <td className={TD}>{r.invoiceNumber ?? "—"}</td>
              <td className={TD}>{formatDate(r.invoiceDate)}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(r.invoiceAmount)}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "awaitingPo" && (
        <>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Jobs quoted but still without a PO / go-ahead {asOfLabel}. PO target is 20 days from the quote.
          </p>
          <Table
            head={
              <>
                <th className={TH}>Reference</th>
                <th className={TH}>Customer</th>
                <th className={TH}>Date Quoted</th>
                <th className={cn(TH, "text-right")}>Days Waiting</th>
                <th className={cn(TH, "text-right")}>Quoted Value</th>
              </>
            }
            footer={
              detail.awaitingPo.length > 0 && (
                <>
                  <td className={TD} colSpan={4}>
                    Value waiting on PO
                  </td>
                  <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(awaitingTotal)}</td>
                </>
              )
            }
          >
            {detail.awaitingPo.length === 0 && <Empty cols={5}>No jobs were waiting for a PO.</Empty>}
            {detail.awaitingPo.map((r) => (
              <tr key={r.id} {...row(r.id)}>
                <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
                <td className={TD}>{r.customer}</td>
                <td className={TD}>{formatDate(r.quotedDate)}</td>
                <td className={cn(TD, "text-right")}>
                  {r.overdue ? (
                    <Badge tone="danger">{r.daysWaiting} days</Badge>
                  ) : (
                    <span className="tabular-nums">{r.daysWaiting} days</span>
                  )}
                </td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(r.quotationAmount || r.poValue)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {tab === "received" && (
        <Table
          head={
            <>
              <th className={TH}>Reference</th>
              <th className={TH}>Customer</th>
              <th className={TH}>Job Type</th>
              <th className={TH}>Job Opening</th>
              <th className={TH}>Stage {asOfLabel}</th>
              <th className={cn(TH, "text-right")}>Order Value</th>
            </>
          }
          footer={
            detail.received.length > 0 && (
              <>
                <td className={TD} colSpan={5}>
                  New job value in {periodLabel}
                </td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(receivedTotal)}</td>
              </>
            )
          }
        >
          {detail.received.length === 0 && <Empty cols={6}>No jobs received in {periodLabel}.</Empty>}
          {detail.received.map((r) => (
            <tr key={r.id} {...row(r.id)}>
              <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
              <td className={TD}>{r.customer}</td>
              <td className={TD}>{r.jobType}</td>
              <td className={TD}>{formatDate(r.jobCreatedDate)}</td>
              <td className={TD}>
                <Badge tone={r.currentStage === "CLOSED" ? "success" : "neutral"}>{STAGE_LABELS[r.currentStage]}</Badge>
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(r.poValue)}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "closedNoInvoice" && (
        <>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Internal jobs closed in {periodLabel} with no invoice raised, valued at their PO value (or quotation amount).
          </p>
          <Table
            head={
              <>
                <th className={TH}>Reference</th>
                <th className={TH}>Customer</th>
                <th className={TH}>Job Type</th>
                <th className={TH}>Closed</th>
                <th className={TH}>Remark</th>
                <th className={cn(TH, "text-right")}>Value</th>
              </>
            }
            footer={
              detail.closedNoInvoice.length > 0 && (
                <>
                  <td className={TD} colSpan={5}>
                    Closed without invoice in {periodLabel}
                  </td>
                  <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(closedNoInvoiceTotal)}</td>
                </>
              )
            }
          >
            {detail.closedNoInvoice.length === 0 && <Empty cols={6}>No jobs were closed without an invoice in {periodLabel}.</Empty>}
            {detail.closedNoInvoice.map((r) => (
              <tr key={r.id} {...row(r.id)}>
                <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
                <td className={TD}>{r.customer}</td>
                <td className={TD}>{r.jobType}</td>
                <td className={TD}>{formatDate(r.closingDate)}</td>
                <td className={cn(TD, "max-w-xs truncate text-gray-600 dark:text-gray-400")}>{r.comments ?? "—"}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(r.value)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Card>
  );
}
