import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { quotationSla } from "../../lib/sla";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router({ mergeParams: true });

const quotationSchema = z.object({
  evaluationDate: z.coerce.date().optional(),
  epirocQuotationDate: z.coerce.date().optional(),
  mcoNumber: z.string().optional(),
  quotationAmount: z.number().nonnegative().optional(),
  comments: z.string().optional(),
  delayReason: z.string().optional(),
});

router.patch(
  "/",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { quotation: true } });
    if (!job) throw new HttpError(404, "Job not found");

    const data = quotationSchema.parse(req.body);
    const effectiveDate = data.epirocQuotationDate ?? job.quotation?.epirocQuotationDate ?? null;
    const sla = quotationSla(job.jobCreatedDate, effectiveDate);
    const hasDelayReason = data.delayReason ?? job.quotation?.delayReason;
    if (sla.status === "RED" && !hasDelayReason) {
      throw new HttpError(400, "Delay reason is required: this quotation has exceeded the 7-day SLA target");
    }

    const before = job.quotation ?? {};
    const updated = await prisma.quotation.upsert({
      where: { jobId },
      create: { jobId, quotedById: req.user!.sub, ...data },
      update: data,
    });

    await writeAuditLog({
      jobId,
      stage: "QUOTATION",
      action: "UPDATE",
      summary: diffSummary(before, updated),
      comment: data.comments ?? null,
      changedById: req.user!.sub,
    });

    const fullJob = await prisma.job.findUnique({ where: { id: jobId }, include: jobListInclude });
    res.json(toJobDto(fullJob!));
  })
);

export default router;
