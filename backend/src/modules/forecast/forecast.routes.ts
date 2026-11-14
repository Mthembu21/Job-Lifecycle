import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { diffSummary, writeAuditLog } from "../../lib/audit";
import { applyBackdatedForecast, committedForecast, ensureForecastsFrozen, previousMonthKey } from "../../lib/forecast";
import { hasPurchaseOrder, isNonInvoicedJobType } from "../../lib/jobTypes";
import { MONTH_KEY_RE, monthKeyOf, parseMonth } from "../../lib/months";

const router = Router();

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

// Every route here is keyed by month ("YYYY-MM").
router.param("month", (_req, _res, next, month) => {
  next(MONTH_KEY_RE.test(month) ? undefined : new HttpError(400, "month must be in YYYY-MM format"));
});

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
    const { month } = req.params;
    const jobId = objectId.parse(req.params.jobId);
    const comment = noteSchema.parse(req.body).comment.trim();

    const [user, existing, jobExists] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.sub }, select: { name: true } }),
      prisma.forecastNote.findUnique({ where: { month_jobId: { month, jobId } } }),
      prisma.job.count({ where: { id: jobId } }),
    ]);

    if (!comment) {
      if (existing) await prisma.forecastNote.delete({ where: { id: existing.id } });
    } else {
      const author = { updatedById: req.user!.sub, updatedByName: user?.name ?? "Unknown" };
      await prisma.forecastNote.upsert({
        where: { month_jobId: { month, jobId } },
        create: { month, jobId, comment, ...author },
        update: { comment, ...author },
      });
    }

    // Keep it in the job's audit trail too (the job may have been deleted since — then skip).
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
    const { year, month, key } = parseMonth(req.params.month)!;
    const freeze = await prisma.forecastFreeze.findUnique({ where: { month: key } });
    res.json({
      month: key,
      started: key <= monthKeyOf(new Date()),
      locked: Boolean(freeze?.lockedAt),
      provisional: Boolean(freeze?.provisional && !freeze.lockedAt),
      /** The month has ended but can still be backdated (previous month only). */
      backdating: key === previousMonthKey(),
      /** The moment the previous month ends — when this month's forecast locks. */
      locksAt: new Date(year, month - 1, 1).toISOString(),
    });
  })
);

/**
 * GET /api/forecast/:month/committed — a past month's committed forecast entries
 * ([{ jobId, amount, backdated }]), for the Forecast page's backdating view.
 */
router.get(
  "/:month/committed",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await committedForecast(req.params.month));
  })
);

const assignSchema = z.object({
  /** Jobs to forecast for this month, with the amount. */
  set: z.array(z.object({ jobId: objectId, amount: z.number().nonnegative() })).default([]),
  /** Jobs to take out of this month's forecast (ignored if they're forecast for another month). */
  clear: z.array(objectId).default([]),
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
    const { set, clear } = assignSchema.parse(req.body);

    // The previous month has ended: changes are backdated straight into its committed forecast.
    if (month === previousMonthKey()) {
      res.json({ updated: await applyBackdatedForecast(month, set, clear, req.user!.sub) });
      return;
    }
    if (month < monthKeyOf(new Date())) {
      throw new HttpError(400, "Only the previous month can be backdated — earlier months are closed");
    }

    // Lock any month that has started before its forecast changes (see lib/forecast.ts).
    await ensureForecastsFrozen();

    const jobs = await prisma.job.findMany({
      where: { id: { in: [...set.map((s) => s.jobId), ...clear] } },
      select: {
        id: true,
        jobType: true,
        forecastMonth: true,
        forecastAmount: true,
        poNumber: true,
        repair: { select: { purchaseOrderNumber: true, purchaseOrderDate: true } },
        invoice: { select: { invoiceDate: true } },
      },
    });
    const byId = new Map(jobs.map((j) => [j.id, j]));

    // Work out every change first, then write them all together.
    const changes: { jobId: string; before: (typeof jobs)[number]; forecastMonth: string | null; forecastAmount: number | null }[] = [];
    for (const { jobId, amount } of set) {
      const job = byId.get(jobId);
      // Gone, already invoiced, an internal / warranty job (never invoiced), or no PO yet.
      if (!job || job.invoice?.invoiceDate || isNonInvoicedJobType(job.jobType) || !hasPurchaseOrder(job)) continue;
      if (job.forecastMonth === month && job.forecastAmount === amount) continue;
      changes.push({ jobId, before: job, forecastMonth: month, forecastAmount: amount });
    }
    for (const jobId of clear) {
      const job = byId.get(jobId);
      if (job && job.forecastMonth === month) changes.push({ jobId, before: job, forecastMonth: null, forecastAmount: null });
    }

    await prisma.$transaction(
      changes.map((c) =>
        prisma.job.update({ where: { id: c.jobId }, data: { forecastMonth: c.forecastMonth, forecastAmount: c.forecastAmount } })
      )
    );
    if (changes.length > 0) {
      await prisma.jobAuditLog.createMany({
        data: changes.map((c) => ({
          jobId: c.jobId,
          stage: "JOB",
          action: "UPDATE",
          summary: diffSummary(
            { forecastMonth: c.before.forecastMonth, forecastAmount: c.before.forecastAmount },
            { forecastMonth: c.forecastMonth, forecastAmount: c.forecastAmount }
          ),
          comment: null,
          changedById: req.user!.sub,
        })),
      });
    }

    res.json({ updated: changes.length });
  })
);

export default router;
