import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { repairSla } from "../../lib/sla";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router({ mergeParams: true });

const repairSchema = z.object({
  purchaseOrderNumber: z.string().optional(),
  purchaseOrderDate: z.coerce.date().optional(),
  plannedAssemblyDate: z.coerce.date().optional(),
  actualAssemblyDate: z.coerce.date().optional(),
  repairStartDate: z.coerce.date().optional(),
  repairCompletionDate: z.coerce.date().optional(),
  outworkRequired: z.string().optional(),
  supplierName: z.string().optional(),
  outworkDateSent: z.coerce.date().optional(),
  outworkDateReceived: z.coerce.date().optional(),
  waitingForGoAhead: z.boolean().optional(),
  technicianName: z.string().optional(),
  labourHours: z.number().nonnegative().optional(),
  partsCost: z.number().nonnegative().optional(),
  totalRepairCost: z.number().nonnegative().optional(),
  comments: z.string().optional(),
  delayReason: z.string().optional(),
});

router.patch(
  "/",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { repair: true } });
    if (!job) throw new HttpError(404, "Job not found");

    const data = repairSchema.parse(req.body);
    const effectivePoDate = data.purchaseOrderDate ?? job.repair?.purchaseOrderDate ?? null;
    const effectiveCompletionDate = data.repairCompletionDate ?? job.repair?.repairCompletionDate ?? null;
    const sla = repairSla(effectivePoDate, effectiveCompletionDate);
    const hasDelayReason = data.delayReason ?? job.repair?.delayReason;
    if (sla.status === "RED" && !hasDelayReason) {
      throw new HttpError(400, "Delay reason is required: this repair has exceeded the 20-day SLA target");
    }

    const before = job.repair ?? {};
    const updated = await prisma.repair.upsert({
      where: { jobId },
      create: { jobId, ...data },
      update: data,
    });

    await writeAuditLog({
      jobId,
      stage: "REPAIR",
      action: "UPDATE",
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
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { repair: true, dispatch: true } });
    if (!job) throw new HttpError(404, "Job not found");
    if (!job.repair) throw new HttpError(404, "This job has no repair to delete");
    if (job.dispatch) {
      throw new HttpError(400, "Delete this job's dispatch first — it depends on the repair being complete");
    }

    await prisma.repair.delete({ where: { jobId } });

    await writeAuditLog({
      jobId,
      stage: "REPAIR",
      action: "DELETE",
      summary: "Repair deleted",
      changedById: req.user!.sub,
    });

    const fullJob = await prisma.job.findUnique({ where: { id: jobId }, include: jobListInclude });
    res.json(toJobDto(fullJob!));
  })
);

export default router;
