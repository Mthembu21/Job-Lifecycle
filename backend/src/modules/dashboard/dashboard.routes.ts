import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { buildDashboardSummary } from "../../lib/analytics";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router();

router.get(
  "/summary",
  authenticate,
  asyncHandler(async (_req, res) => {
    const jobs = await prisma.job.findMany({ include: jobListInclude });
    const dtos = jobs.map(toJobDto);
    res.json(buildDashboardSummary(dtos));
  })
);

export default router;
