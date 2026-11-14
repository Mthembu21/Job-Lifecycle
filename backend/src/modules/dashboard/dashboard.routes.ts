import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { buildDashboardSummary } from "../../lib/analytics";
import { availableMonths, buildMonthlyDashboard, monthKeyOf, parseMonth } from "../../lib/monthlyDashboard";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";
import { buildForecastReport } from "../../lib/forecast";

const router = Router();

/**
 * GET /dashboard/summary            → all-time figures (as before)
 * GET /dashboard/summary?month=2026-10 → that month's activity + pipeline at month end
 */
router.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const jobs = await prisma.job.findMany({ include: jobListInclude });
    const months = availableMonths(jobs);
    const monthParam = req.query.month;

    if (monthParam === undefined || monthParam === "" || monthParam === "all") {
      res.json({ ...buildDashboardSummary(jobs.map((j) => toJobDto(j))), period: null, monthDetail: null, forecast: null, availableMonths: months });
      return;
    }

    const parsed = parseMonth(monthParam);
    if (!parsed) throw new HttpError(400, "month must be in YYYY-MM format");
    const requested = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    if (requested > monthKeyOf(new Date())) throw new HttpError(400, "month cannot be in the future");

    const forecast = await buildForecastReport(jobs, parsed.year, parsed.month);
    res.json({ ...buildMonthlyDashboard(jobs, parsed.year, parsed.month), forecast, availableMonths: months });
  })
);

export default router;
