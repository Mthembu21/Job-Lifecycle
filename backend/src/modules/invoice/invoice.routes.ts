import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { invoiceSla } from "../../lib/sla";
import { isNonInvoicedJobType } from "../../lib/jobTypes";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router({ mergeParams: true });

const invoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.coerce.date().optional(),
  invoiceAmount: z.number().nonnegative().optional(),
  plannedClosingDate: z.coerce.date().optional(),
  closingDate: z.coerce.date().optional(),
  comments: z.string().optional(),
  delayReason: z.string().optional(),
});

router.patch(
  "/",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { dispatch: true, invoice: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (!job.dispatch?.dispatchDate) {
      throw new HttpError(400, "Cannot invoice or close a job that has not been dispatched yet");
    }

    const data = invoiceSchema.parse(req.body);
    // Internal and warranty jobs are never invoiced: this step closes them on the closing date.
    const noInvoice = isNonInvoicedJobType(job.jobType);

    let write: Record<string, unknown>;
    let completedOn: Date | null; // when this stage completes, for the SLA check
    if (noInvoice) {
      if (data.invoiceDate || data.invoiceNumber || data.invoiceAmount !== undefined) {
        throw new HttpError(
          400,
          "Internal and warranty jobs aren't invoiced — change the job's Service Type if this one should be invoiced"
        );
      }
      completedOn = data.closingDate ?? job.invoice?.closingDate ?? null;
      if (!completedOn) throw new HttpError(400, "Enter the closing date to close the job");
      write = { ...data, closingDate: completedOn, invoiceDate: null, invoiceNumber: null, invoiceAmount: null };
    } else {
      completedOn = data.invoiceDate ?? job.invoice?.invoiceDate ?? null;
      // Job auto-closes once invoicing is complete: default closingDate to invoiceDate if not supplied.
      write = { ...data, closingDate: data.closingDate ?? data.invoiceDate };
    }

    const sla = invoiceSla(job.dispatch.dispatchDate, completedOn);
    if (sla.status === "RED" && !(data.delayReason ?? job.invoice?.delayReason)) {
      const step = noInvoice ? "closing" : "invoicing";
      throw new HttpError(400, `Delay reason is required: ${step} has exceeded the 7-day SLA target`);
    }

    const before = job.invoice ?? {};
    const updated = await prisma.invoice.upsert({
      where: { jobId },
      create: { jobId, ...write },
      update: write,
    });

    await writeAuditLog({
      jobId,
      stage: "INVOICING",
      action: updated.closingDate ? "CLOSE" : "UPDATE",
      summary: diffSummary(before, updated),
      comment: data.comments ?? null,
      changedById: req.user!.sub,
    });

    const fullJob = await prisma.job.findUnique({ where: { id: jobId }, include: jobListInclude });
    res.json(toJobDto(fullJob!));
  })
);

router.delete(
  "/",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { invoice: true } });
    if (!job) throw new HttpError(404, "Job not found");
    if (!job.invoice) throw new HttpError(404, "This job has no invoice to delete");

    await prisma.invoice.delete({ where: { jobId } });

    await writeAuditLog({
      jobId,
      stage: "INVOICING",
      action: "DELETE",
      summary: "Invoice deleted",
      changedById: req.user!.sub,
    });

    const fullJob = await prisma.job.findUnique({ where: { id: jobId }, include: jobListInclude });
    res.json(toJobDto(fullJob!));
  })
);

export default router;
