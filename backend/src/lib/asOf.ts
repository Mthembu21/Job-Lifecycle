import { JobWithListRelations } from "../modules/jobs/jobs.dto";

/** Keeps a date only if it had already happened by `asOf`. */
function upTo(d: Date | null | undefined, asOf: Date): Date | null {
  return d && d.getTime() <= asOf.getTime() ? d : null;
}

/**
 * A copy of the job as it stood at the end of `asOf`: every "actual" date recorded after that point
 * is hidden, so the status engine reconstructs the stage the job was in then. Planned dates are
 * kept as-is — they're targets, not events.
 *
 * Used by the dashboard's month view: e.g. a job quoted on 20 Oct whose PO arrived on 5 Nov was
 * "Awaiting PO" at the end of October, even though it's in Repair today.
 */
export function jobAsOf(job: JobWithListRelations, asOf: Date): JobWithListRelations {
  const { quotation, repair, dispatch, invoice } = job;
  const woNumberSetAt = upTo(job.woNumberSetAt, asOf);
  const invoiceDate = upTo(invoice?.invoiceDate, asOf);

  return {
    ...job,
    woNumberSetAt,
    // A WO number recorded after the cut-off didn't exist yet. Legacy rows may have a WO number
    // without a timestamp — keep those, since there's no date to judge them by.
    woNumber: job.woNumberSetAt && !woNumberSetAt ? null : job.woNumber,
    quotation: quotation && {
      ...quotation,
      evaluationDate: upTo(quotation.evaluationDate, asOf),
      epirocQuotationDate: upTo(quotation.epirocQuotationDate, asOf),
    },
    repair: repair && {
      ...repair,
      purchaseOrderDate: upTo(repair.purchaseOrderDate, asOf),
      actualAssemblyDate: upTo(repair.actualAssemblyDate, asOf),
      repairStartDate: upTo(repair.repairStartDate, asOf),
      repairCompletionDate: upTo(repair.repairCompletionDate, asOf),
      outworkDateSent: upTo(repair.outworkDateSent, asOf),
      outworkDateReceived: upTo(repair.outworkDateReceived, asOf),
    },
    dispatch: dispatch && {
      ...dispatch,
      dispatchRequestDate: upTo(dispatch.dispatchRequestDate, asOf),
      dispatchDate: upTo(dispatch.dispatchDate, asOf),
    },
    invoice: invoice && {
      ...invoice,
      invoiceDate,
      invoiceNumber: invoiceDate ? invoice.invoiceNumber : null,
      invoiceAmount: invoiceDate ? invoice.invoiceAmount : null,
      closingDate: upTo(invoice.closingDate, asOf),
    },
  };
}
