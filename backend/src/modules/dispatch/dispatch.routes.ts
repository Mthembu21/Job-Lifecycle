import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { dispatchSla } from "../../lib/sla";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router({ mergeParams: true });

const dispatchSchema = z.object({
  dispatchDate: z.coerce.date().optional(),
  courier: z.string().optional(),
  trackingNumber: z.string().optional(),
  comments: z.string().optional(),
  delayReason: z.string().optional(),
});

router.patch(
  "/",
  authenticate,
  requireRole("STOREMAN", "PLANNER"),
  asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { repair: true, dispatch: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (!job.repair?.repairCompletionDate) {
      throw new HttpError(400, "Cannot dispatch a job whose repair has not been completed yet");
    }

    const data = dispatchSchema.parse(req.body);
    const effectiveDispatchDate = data.dispatchDate ?? job.dispatch?.dispatchDate ?? null;
    const sla = dispatchSla(job.repair.repairCompletionDate, effectiveDispatchDate);
    const hasDelayReason = data.delayReason ?? job.dispatch?.delayReason;
    if (sla.status === "RED" && !hasDelayReason) {
      throw new HttpError(400, "Delay reason is required: dispatch has exceeded the 2-day SLA target");
    }

    const before = job.dispatch ?? {};
    const updated = await prisma.dispatch.upsert({
      where: { jobId },
      create: { jobId, dispatchedById: req.user!.sub, ...data },
      update: data,
    });

    await writeAuditLog({
      jobId,
      stage: "DISPATCH",
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
