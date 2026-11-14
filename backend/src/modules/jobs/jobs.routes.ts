import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { jobListInclude, toJobDto } from "./jobs.dto";
import { ensureForecastsFrozen, MONTH_KEY_RE } from "../../lib/forecast";
import { isNonInvoicedJobType } from "../../lib/jobTypes";

const router = Router();

const createJobSchema = z.object({
  referenceNumber: z.string().min(1),
  description: z.string().min(1),
  customer: z.string().min(1),
  serialNumber: z.string().min(1),
  partNumber: z.string().optional(),
  woNumber: z.string().optional(),
  poNumber: z.string().optional(),
  jobType: z.enum(["WARRANTY", "CUSTOMER_REPAIR", "INTERNAL", "SERVICE", "REBUILD", "INSURANCE", "OTHER"]),
  poValue: z.number().nonnegative(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  jobCreatedDate: z.coerce.date(),
  comments: z.string().optional(),
});

const updateJobSchema = z
  .object({
    woNumber: z.string().min(1).optional(),
    poNumber: z.string().min(1).optional(),
    woNumberSetAt: z.coerce.date().optional(),
    jobCreatedDate: z.coerce.date().optional(),
    // Service type — decides whether the job is invoiced or closed without invoice (internal / warranty).
    jobType: z.enum(["WARRANTY", "CUSTOMER_REPAIR", "INTERNAL", "SERVICE", "REBUILD", "INSURANCE", "OTHER"]).optional(),
    // Invoice forecast (planner / admin only). null clears it.
    forecastMonth: z.string().regex(MONTH_KEY_RE, "Forecast month must be YYYY-MM").nullable().optional(),
    forecastAmount: z.number().nonnegative().nullable().optional(),
  })
  .refine(
    (data) =>
      data.woNumber !== undefined ||
      data.poNumber !== undefined ||
      data.woNumberSetAt !== undefined ||
      data.jobCreatedDate !== undefined ||
      data.jobType !== undefined ||
      data.forecastMonth !== undefined ||
      data.forecastAmount !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

router.post(
  "/",
  authenticate,
  requireRole("STOREMAN"),
  asyncHandler(async (req, res) => {
    const data = createJobSchema.parse(req.body);

    const existing = await prisma.job.findUnique({ where: { referenceNumber: data.referenceNumber } });
    if (existing) throw new HttpError(409, "A job with this reference number already exists");

    const job = await prisma.job.create({
      data: {
        ...data,
        woNumberSetAt: data.woNumber ? new Date() : null,
        createdById: req.user!.sub,
      },
      include: jobListInclude,
    });

    await writeAuditLog({
      jobId: job.id,
      stage: "CREATED",
      action: "CREATE",
      summary: `Job ${job.referenceNumber} created`,
      changedById: req.user!.sub,
    });

    res.status(201).json(toJobDto(job));
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { search, customer, createdById, jobType, priority, createdFrom, createdTo, stage, status, missingWo } =
      req.query as Record<string, string | undefined>;

    const where: Prisma.JobWhereInput = {};
    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { customer: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (customer) where.customer = { contains: customer, mode: "insensitive" };
    if (createdById) where.createdById = createdById;
    if (jobType) where.jobType = jobType as any;
    if (priority) where.priority = priority as any;
    if (missingWo === "true") where.woNumber = null;
    if (createdFrom || createdTo) {
      where.jobCreatedDate = {
        ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
        ...(createdTo ? { lte: new Date(createdTo) } : {}),
      };
    }

    const jobs = await prisma.job.findMany({
      where,
      include: jobListInclude,
      orderBy: { referenceNumber: "asc" },
    });

    let dtos = jobs.map((job) => toJobDto(job));

    if (stage) dtos = dtos.filter((j) => j.status.currentStage === stage);
    if (status) dtos = dtos.filter((j) => j.status.currentStatus === status);

    res.json(dtos);
  })
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: jobListInclude,
    });
    if (!job) throw new HttpError(404, "Job not found");
    res.json(toJobDto(job));
  })
);

router.patch(
  "/:id",
  authenticate,
  requireRole("STOREMAN", "PLANNER"),
  asyncHandler(async (req, res) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new HttpError(404, "Job not found");

    const data = updateJobSchema.parse(req.body);

    // Changing the service type between invoiced and not-invoiced (internal / warranty) changes how
    // the job closes, so keep the invoice record and forecast consistent with it.
    const typeChanged = data.jobType !== undefined && data.jobType !== job.jobType;
    const becomesNonInvoiced = typeChanged && isNonInvoicedJobType(data.jobType!);
    if (typeChanged) {
      const invoice = await prisma.invoice.findUnique({ where: { jobId: job.id } });
      if (invoice?.invoiceDate && becomesNonInvoiced) {
        throw new HttpError(
          400,
          "This job has already been invoiced. Remove the invoice first if it should be an internal or warranty job."
        );
      }
      if (invoice && !invoice.invoiceDate) {
        // A closing date with no invoice closes the job only for internal / warranty types.
        await prisma.invoice.update({ where: { jobId: job.id }, data: { closedWithoutInvoice: becomesNonInvoiced } });
      }
    }

    const touchesForecast = data.forecastMonth !== undefined || data.forecastAmount !== undefined || becomesNonInvoiced;
    if (data.forecastMonth !== undefined || data.forecastAmount !== undefined) {
      if (req.user!.role !== "PLANNER" && req.user!.role !== "ADMIN") {
        throw new HttpError(403, "Only planners can set invoice forecasts");
      }
      if (data.forecastMonth && isNonInvoicedJobType(data.jobType ?? job.jobType)) {
        throw new HttpError(400, "Internal and warranty jobs aren't invoiced, so they can't be forecast");
      }
    }
    // Freeze any month that has started before its forecast can change (see lib/forecast.ts).
    if (touchesForecast) await ensureForecastsFrozen();

    if (data.woNumberSetAt !== undefined) {
      if (!job.woNumber && !data.woNumber) {
        throw new HttpError(400, "A WO number must be set before its date can be edited");
      }
      // One day of slack so a user ahead of UTC can still pick their local "today".
      if (data.woNumberSetAt.getTime() > Date.now() + 86_400_000) {
        throw new HttpError(400, "WO number date cannot be in the future");
      }
      const jobCreatedDateFloor = data.jobCreatedDate ?? job.jobCreatedDate;
      if (data.woNumberSetAt.toISOString().slice(0, 10) < jobCreatedDateFloor.toISOString().slice(0, 10)) {
        throw new HttpError(400, "WO number date cannot be before the job created date");
      }
    }

    if (data.jobCreatedDate !== undefined) {
      if (data.jobCreatedDate.getTime() > Date.now() + 86_400_000) {
        throw new HttpError(400, "Job created date cannot be in the future");
      }
      const woNumberSetAtCeiling = data.woNumberSetAt ?? job.woNumberSetAt;
      if (woNumberSetAtCeiling && data.jobCreatedDate.toISOString().slice(0, 10) > woNumberSetAtCeiling.toISOString().slice(0, 10)) {
        throw new HttpError(400, "Job created date cannot be after the WO number date");
      }
    }

    const before = {
      woNumber: job.woNumber,
      poNumber: job.poNumber,
      woNumberSetAt: job.woNumberSetAt,
      jobCreatedDate: job.jobCreatedDate,
      jobType: job.jobType,
      forecastMonth: job.forecastMonth,
      forecastAmount: job.forecastAmount,
    };

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        ...(data.woNumber !== undefined && {
          woNumber: data.woNumber,
          woNumberSetAt: job.woNumberSetAt ?? new Date(),
        }),
        ...(data.woNumberSetAt !== undefined && { woNumberSetAt: data.woNumberSetAt }),
        ...(data.poNumber !== undefined && { poNumber: data.poNumber }),
        ...(data.jobCreatedDate !== undefined && { jobCreatedDate: data.jobCreatedDate }),
        ...(data.forecastMonth !== undefined && { forecastMonth: data.forecastMonth }),
        ...(data.forecastAmount !== undefined && { forecastAmount: data.forecastAmount }),
        ...(data.jobType !== undefined && { jobType: data.jobType }),
        // Internal / warranty jobs are never invoiced, so they can't be part of an invoice forecast.
        ...(becomesNonInvoiced && { forecastMonth: null, forecastAmount: null }),
      },
      include: jobListInclude,
    });

    await writeAuditLog({
      jobId: job.id,
      stage: "JOB",
      action: "UPDATE",
      summary: diffSummary(before, {
        woNumber: updated.woNumber,
        poNumber: updated.poNumber,
        // Only log the date when it was edited by hand, not when auto-stamped with a new WO number.
        ...(data.woNumberSetAt !== undefined && { woNumberSetAt: updated.woNumberSetAt }),
        ...(data.jobCreatedDate !== undefined && { jobCreatedDate: updated.jobCreatedDate }),
        ...(touchesForecast && { forecastMonth: updated.forecastMonth, forecastAmount: updated.forecastAmount }),
        ...(typeChanged && { jobType: updated.jobType }),
      }),
      changedById: req.user!.sub,
    });

    res.json(toJobDto(updated));
  })
);

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

router.delete(
  "/",
  authenticate,
  requireRole("STOREMAN"),
  asyncHandler(async (req, res) => {
    const { ids } = bulkDeleteSchema.parse(req.body);

    // Capture the forecast of any month that has started before its jobs disappear.
    await ensureForecastsFrozen();
    const { count } = await prisma.job.deleteMany({ where: { id: { in: ids } } });

    res.json({ deletedCount: count });
  })
);

router.delete(
  "/:id",
  authenticate,
  requireRole("STOREMAN"),
  asyncHandler(async (req, res) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new HttpError(404, "Job not found");

    await ensureForecastsFrozen();
    await prisma.job.delete({ where: { id: job.id } });

    res.status(204).send();
  })
);

export default router;
