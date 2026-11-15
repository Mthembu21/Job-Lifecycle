import { useState } from "react";
import { MonthDetail } from "../../api/dashboard";
import { JOB_TYPE_LABELS, STAGE_LABELS } from "../../constants";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import { Badge, Card, Segmented, cn } from "../../components/ui";
import { EmptyRow, TH } from "../../components/ui/Table";
import { DashboardTable as Table, TD, useJobRowLink } from "./DashboardTable";

type Tab = "invoiced" | "awaitingPo" | "received" | "closedNoInvoice";

/** The jobs behind the month's headline numbers: invoiced, waiting for PO, received,
 * closed without invoice. */
export function MonthDetailCard({ detail, periodLabel, asOfLabel }: { detail: MonthDetail; periodLabel: string; asOfLabel: string }) {
  const [tab, setTab] = useState<Tab>("invoiced");
  const row = useJobRowLink();

  const invoicedTotal = detail.invoiced.reduce((s, r) => s + r.invoiceAmount, 0);
  const awaitingTotal = detail.awaitingPo.reduce((s, r) => s + (r.quotationAmount || r.poValue), 0);
  const receivedTotal = detail.received.reduce((s, r) => s + r.value, 0);
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
          {detail.invoiced.length === 0 && <EmptyRow cols={5}>Nothing invoiced in {periodLabel} yet.</EmptyRow>}
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
            {detail.awaitingPo.length === 0 && <EmptyRow cols={5}>No jobs were waiting for a PO.</EmptyRow>}
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
              <th className={cn(TH, "text-right")} title="Order value, else the quotation amount">
                Value
              </th>
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
          {detail.received.length === 0 && <EmptyRow cols={6}>No jobs received in {periodLabel}.</EmptyRow>}
          {detail.received.map((r) => (
            <tr key={r.id} {...row(r.id)}>
              <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
              <td className={TD}>{r.customer}</td>
              <td className={TD}>{JOB_TYPE_LABELS[r.jobType]}</td>
              <td className={TD}>{formatDate(r.jobCreatedDate)}</td>
              <td className={TD}>
                <Badge tone={r.currentStage === "CLOSED" ? "success" : "neutral"}>{STAGE_LABELS[r.currentStage]}</Badge>
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatCurrency(r.value)}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "closedNoInvoice" && (
        <>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Internal and warranty jobs closed in {periodLabel} with no invoice raised, valued at their PO value (or quotation amount).
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
            {detail.closedNoInvoice.length === 0 && <EmptyRow cols={6}>No jobs were closed without an invoice in {periodLabel}.</EmptyRow>}
            {detail.closedNoInvoice.map((r) => (
              <tr key={r.id} {...row(r.id)}>
                <td className={cn(TD, "font-semibold")}>{r.referenceNumber}</td>
                <td className={TD}>{r.customer}</td>
                <td className={TD}>{JOB_TYPE_LABELS[r.jobType]}</td>
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
