import crypto from "crypto";
import { NextFunction, Request, Response, Router } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/errorHandler";
import { jobListInclude } from "../jobs/jobs.dto";
import { toBoardJobDto } from "./board.dto";

const router = Router();

const CLOSED_RETENTION_DAYS = 14;

function keyMatches(given: unknown): boolean {
  if (!env.boardAccessKey || typeof given !== "string") return false;
  // Compare hashes so the comparison is constant-time whatever the lengths.
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(env.boardAccessKey).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * The meeting-room TV runs without anyone signed in, so it opens the board with a secret link
 * (/board?key=…, BOARD_ACCESS_KEY). Signed-in users can open it with their session instead.
 */
function boardAccess(req: Request, res: Response, next: NextFunction) {
  if (keyMatches(req.query.key)) return next();
  return authenticate(req, res, next);
}

// See board.dto.ts for the allowlist that keeps money fields out of the board.
router.get(
  "/",
  boardAccess,
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

/** The secret TV link's key, for an admin to set up the screen. */
router.get("/link", authenticate, requireRole("ADMIN"), (_req, res) => {
  res.json({ key: env.boardAccessKey || null });
});

export default router;
