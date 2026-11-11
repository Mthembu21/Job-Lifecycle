import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { jobListInclude } from "../jobs/jobs.dto";
import { toBoardJobDto } from "./board.dto";

const router = Router();

const CLOSED_RETENTION_DAYS = 14;

// Intentionally public: this is the meeting-room TV board, meant to stay up
// on a screen nobody logs into. No `authenticate` middleware on this route —
// see board.dto.ts for the allowlist that keeps money fields out of it.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const jobs = await prisma.job.findMany({ include: jobListInclude, orderBy: { jobCreatedDate: "desc" } });
    const cutoff = new Date(Date.now() - CLOSED_RETENTION_DAYS * 86_400_000);

    const board = jobs
      .map((job) => ({ job, dto: toBoardJobDto(job) }))
      .filter(({ job, dto }) => {
        if (!dto.isClosed) return true;
        const closedAt = job.invoice?.closingDate ?? job.invoice?.invoiceDate;
        return !closedAt || closedAt >= cutoff;
      })
      .map(({ dto }) => dto);

    res.json({ jobs: board });
  })
);

export default router;
