import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { availableMonths, buildPeriodDashboard } from "../../lib/periodDashboard";
import { buildForecastReport, buildYearForecast } from "../../lib/forecast";
import { monthKeyOf, parseMonth, parseYear } from "../../lib/months";
import { jobListInclude } from "../jobs/jobs.dto";

const router = Router();

/**
 * GET /dashboard/summary?month=2026-10  → that month's activity, pipeline at month end, forecast
 * GET /dashboard/summary?year=2026      → the year's activity, pipeline at year end, forecast by month
 * (no parameter = the current month)
 */
router.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const jobs = await prisma.job.findMany({ include: jobListInclude });
    const months = availableMonths(jobs);
    const availableYears = [...new Set(months.map((m) => m.slice(0, 4)))];
    const now = new Date();

    if (req.query.year !== undefined) {
      const year = parseYear(req.query.year);
      if (year === null) throw new HttpError(400, "year must be YYYY");
      if (year > now.getFullYear()) throw new HttpError(400, "year cannot be in the future");
      const yearForecast = await buildYearForecast(jobs, year, now);
      res.json({
        ...buildPeriodDashboard(jobs, { kind: "year", year }, now),
        forecast: null,
        yearForecast,
        availableMonths: months,
        availableYears,
      });
      return;
    }

    const month = req.query.month === undefined ? parseMonth(monthKeyOf(now)) : parseMonth(req.query.month);
    if (!month) throw new HttpError(400, "month must be in YYYY-MM format");
    if (month.key > monthKeyOf(now)) throw new HttpError(400, "month cannot be in the future");

    const forecast = await buildForecastReport(jobs, month.year, month.month, now);
    res.json({
      ...buildPeriodDashboard(jobs, { kind: "month", year: month.year, month: month.month }, now),
      forecast,
      yearForecast: null,
      availableMonths: months,
      availableYears,
    });
  })
);

export default router;
