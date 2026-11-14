import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { buildDashboardSummary } from "../../lib/analytics";
import { availableMonths, buildMonthlyDashboard } from "../../lib/monthlyDashboard";
import { buildForecastReport } from "../../lib/forecast";
import { monthKeyOf, parseMonth } from "../../lib/months";
import { jobListInclude, toJobDto } from "../jobs/jobs.dto";

const router = Router();

/**
 * GET /dashboard/summary                → all-time figures
 * GET /dashboard/summary?month=2026-10  → that month's activity + pipeline at month end + forecast
 */
router.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const jobs = await prisma.job.findMany({ include: jobListInclude });
    const months = availableMonths(jobs);
    const monthParam = req.query.month;

    if (monthParam === undefined || monthParam === "" || monthParam === "all") {
      const summary = buildDashboardSummary(jobs.map((j) => toJobDto(j)));
      res.json({ ...summary, period: null, monthDetail: null, forecast: null, availableMonths: months });
      return;
    }

    const month = parseMonth(monthParam);
    if (!month) throw new HttpError(400, "month must be in YYYY-MM format");
    if (month.key > monthKeyOf(new Date())) throw new HttpError(400, "month cannot be in the future");

    const forecast = await buildForecastReport(jobs, month.year, month.month);
    res.json({ ...buildMonthlyDashboard(jobs, month.year, month.month), forecast, availableMonths: months });
  })
);

export default router;
