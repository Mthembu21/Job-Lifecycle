import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { diffSummary, writeAuditLog } from "../../lib/audit";
import { ensureForecastsFrozen, MONTH_KEY_RE, monthKeyOf } from "../../lib/forecast";
import { isNonInvoicedJobType } from "../../lib/jobTypes";

const router = Router();

const noteSchema = z.object({ comment: z.string().max(1000) });

/**
 * PUT /api/forecast/:month/notes/:jobId  { comment }
 * Sets (or, with an empty comment, removes) the planner's explanation for a job's forecast outcome
 * in that month.
 */
router.put(
  "/:month/notes/:jobId",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const { month, jobId } = req.params;
    if (!MONTH_KEY_RE.test(month)) throw new HttpError(400, "month must be in YYYY-MM format");
    if (!/^[0-9a-f]{24}$/i.test(jobId)) throw new HttpError(400, "Invalid job id");
    const comment = noteSchema.parse(req.body).comment.trim();

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { name: true } });
    const existing = await prisma.forecastNote.findUnique({ where: { month_jobId: { month, jobId } } });

    if (!comment) {
      if (existing) await prisma.forecastNote.delete({ where: { id: existing.id } });
    } else {
      await prisma.forecastNote.upsert({
        where: { month_jobId: { month, jobId } },
        create: { month, jobId, comment, updatedById: req.user!.sub, updatedByName: user?.name ?? "Unknown" },
        update: { comment, updatedById: req.user!.sub, updatedByName: user?.name ?? "Unknown" },
      });
    }

    // Keep it in the job's audit trail too (the job may have been deleted since — then skip).
    const jobExists = await prisma.job.count({ where: { id: jobId } });
    if (jobExists && (existing?.comment ?? "") !== comment) {
      await writeAuditLog({
        jobId,
        stage: "FORECAST",
        action: comment ? "COMMENT" : "COMMENT_REMOVED",
        summary: comment ? `Forecast comment for ${month}` : `Forecast comment for ${month} removed`,
        comment: comment || null,
        changedById: req.user!.sub,
      });
    }

    res.json({ ok: true });
  })
);

/**
 * GET /api/forecast/:month/status — whether the month's forecast is locked yet, and when it locks.
 * Read-only (doesn't trigger a freeze).
 */
router.get(
  "/:month/status",
  authenticate,
  asyncHandler(async (req, res) => {
    const { month } = req.params;
    if (!MONTH_KEY_RE.test(month)) throw new HttpError(400, "month must be in YYYY-MM format");
    const [y, m] = month.split("-").map(Number);
    const freeze = await prisma.forecastFreeze.findUnique({ where: { month } });
    res.json({
      month,
      started: month <= monthKeyOf(new Date()),
      locked: Boolean(freeze && !freeze.provisional),
      provisional: Boolean(freeze?.provisional),
      /** The moment the previous month ends — when this month's forecast locks. */
      locksAt: new Date(y, m - 1, 1).toISOString(),
    });
  })
);

const assignSchema = z.object({
  /** Jobs to forecast for this month, with the amount. */
  set: z.array(z.object({ jobId: z.string().regex(/^[0-9a-f]{24}$/i), amount: z.number().nonnegative() })).default([]),
  /** Jobs to take out of this month's forecast (ignored if they're forecast for another month). */
  clear: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).default([]),
});

/**
 * PUT /api/forecast/:month/jobs  { set: [{ jobId, amount }], clear: [jobId] }
 * The Forecast page's tick boxes: put jobs into (or take them out of) a month's invoice forecast.
 */
router.put(
  "/:month/jobs",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const { month } = req.params;
    if (!MONTH_KEY_RE.test(month)) throw new HttpError(400, "month must be in YYYY-MM format");
    if (month < monthKeyOf(new Date())) throw new HttpError(400, "You can't forecast into a month that has already ended");
    const { set, clear } = assignSchema.parse(req.body);

    // Lock any month that has started before its forecast changes (see lib/forecast.ts).
    await ensureForecastsFrozen();

    const ids = [...set.map((s) => s.jobId), ...clear];
    const jobs = await prisma.job.findMany({
      where: { id: { in: ids } },
      select: { id: true, jobType: true, forecastMonth: true, forecastAmount: true, invoice: { select: { invoiceDate: true, closedWithoutInvoice: true, closingDate: true } } },
    });
    const byId = new Map(jobs.map((j) => [j.id, j]));
    let updated = 0;

    for (const { jobId, amount } of set) {
      const job = byId.get(jobId);
      // Gone, already invoiced, or an internal / warranty job (never invoiced).
      if (!job || job.invoice?.invoiceDate || isNonInvoicedJobType(job.jobType)) continue;
      if (job.forecastMonth === month && job.forecastAmount === amount) continue;
      await prisma.job.update({ where: { id: jobId }, data: { forecastMonth: month, forecastAmount: amount } });
      await writeAuditLog({
        jobId,
        stage: "JOB",
        action: "UPDATE",
        summary: diffSummary(
          { forecastMonth: job.forecastMonth, forecastAmount: job.forecastAmount },
          { forecastMonth: month, forecastAmount: amount }
        ),
        changedById: req.user!.sub,
      });
      updated++;
    }

    for (const jobId of clear) {
      const job = byId.get(jobId);
      if (!job || job.forecastMonth !== month) continue;
      await prisma.job.update({ where: { id: jobId }, data: { forecastMonth: null, forecastAmount: null } });
      await writeAuditLog({
        jobId,
        stage: "JOB",
        action: "UPDATE",
        summary: diffSummary(
          { forecastMonth: job.forecastMonth, forecastAmount: job.forecastAmount },
          { forecastMonth: null, forecastAmount: null }
        ),
        changedById: req.user!.sub,
      });
      updated++;
    }

    res.json({ updated });
  })
);

export default router;
