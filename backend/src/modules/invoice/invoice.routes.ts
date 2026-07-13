import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { invoiceSla } from "../../lib/sla";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router({ mergeParams: true });

const invoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.coerce.date().optional(),
  invoiceAmount: z.number().nonnegative().optional(),
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
      throw new HttpError(400, "Cannot invoice a job that has not been dispatched yet");
    }

    const data = invoiceSchema.parse(req.body);
    const effectiveInvoiceDate = data.invoiceDate ?? job.invoice?.invoiceDate ?? null;
    const sla = invoiceSla(job.dispatch.dispatchDate, effectiveInvoiceDate);
    const hasDelayReason = data.delayReason ?? job.invoice?.delayReason;
    if (sla.status === "RED" && !hasDelayReason) {
      throw new HttpError(400, "Delay reason is required: invoicing has exceeded the 7-day SLA target");
    }

    // Job auto-closes once invoicing is complete: default closingDate to invoiceDate if not supplied.
    const closingDate = data.closingDate ?? (data.invoiceDate ? data.invoiceDate : undefined);

    const before = job.invoice ?? {};
    const updated = await prisma.invoice.upsert({
      where: { jobId },
      create: { jobId, ...data, closingDate },
      update: { ...data, closingDate },
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

export default router;
