import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { availableMonths, buildPeriodDashboard } from "../../lib/periodDashboard";
import { buildForecastReport, buildYearForecast } from "../../lib/forecast";
import { monthKeyOf, parseMonth, parseYear } from "../../lib/months";
import { jobListInclude } from "../jobs/jobs.dto";
import { customerKey } from "../../lib/insights";

const router = Router();

/** Every customer in the app, one entry per customer however the name was typed. */
function customerOptions(jobs: { customer: string }[]) {
  const names = new Map<string, Map<string, number>>();
  for (const j of jobs) {
    const key = customerKey(j.customer);
    if (!key) continue;
    const spellings = names.get(key) ?? new Map<string, number>();
    const display = j.customer.trim().replace(/\s+/g, " ");
    spellings.set(display, (spellings.get(display) ?? 0) + 1);
    names.set(key, spellings);
  }
  return [...names.entries()]
    .map(([key, spellings]) => ({ key, name: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * GET /dashboard/summary?month=2026-10  → that month's activity, pipeline at month end, forecast
 * GET /dashboard/summary?year=2026      → the year's activity, pipeline at year end, forecast by month
 * (no parameter = the current month)
 * &customer=<key>                       → the same dashboard for one customer's jobs only
 *
 * Every figure is built from the job list it's given, so a customer filter (and, later, a
 * customer manager's own dashboard) is just a narrower job list.
 */
router.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const allJobs = await prisma.job.findMany({ include: jobListInclude });
    const customers = customerOptions(allJobs);
    const customer = typeof req.query.customer === "string" && req.query.customer ? customerKey(req.query.customer) : null;
    if (customer && !customers.some((c) => c.key === customer)) throw new HttpError(400, "Unknown customer");
    const jobs = customer ? allJobs.filter((j) => customerKey(j.customer) === customer) : allJobs;
    // Period choices always cover the whole app, so switching customer keeps the period.
    const months = availableMonths(allJobs);
    const availableYears = [...new Set(months.map((m) => m.slice(0, 4)))];
    const now = new Date();
    const filter = { customer: customer ? customers.find((c) => c.key === customer)! : null, customers };

    if (req.query.year !== undefined) {
      const year = parseYear(req.query.year);
      if (year === null) throw new HttpError(400, "year must be YYYY");
      if (year > now.getFullYear()) throw new HttpError(400, "year cannot be in the future");
      // The forecast compares against frozen whole-workshop snapshots, so it isn't split by customer.
      const yearForecast = customer ? null : await buildYearForecast(jobs, year, now);
      res.json({
        ...buildPeriodDashboard(jobs, { kind: "year", year }, now),
        forecast: null,
        yearForecast,
        availableMonths: months,
        availableYears,
        filter,
      });
      return;
    }

    const month = req.query.month === undefined ? parseMonth(monthKeyOf(now)) : parseMonth(req.query.month);
    if (!month) throw new HttpError(400, "month must be in YYYY-MM format");
    if (month.key > monthKeyOf(now)) throw new HttpError(400, "month cannot be in the future");

    const forecast = customer ? null : await buildForecastReport(jobs, month.year, month.month, now);
    res.json({
      ...buildPeriodDashboard(jobs, { kind: "month", year: month.year, month: month.month }, now),
      forecast,
      yearForecast: null,
      availableMonths: months,
      availableYears,
      filter,
    });
  })
);

export default router;
