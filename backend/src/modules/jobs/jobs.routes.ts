import { Router } from "express";
import { z } from "zod";
import { JobType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { hasRole, requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { jobListInclude, toJobDto } from "./jobs.dto";
import { ensureForecastsFrozen } from "../../lib/forecast";
import { MONTH_KEY_RE, monthKeyOf } from "../../lib/months";
import { hasPurchaseOrder, isNonInvoicedJobType } from "../../lib/jobTypes";
import { checkJobDates, dayKey, flowDatesOf, pickFlowDates } from "../../lib/dateRules";
import { customerKey } from "../../lib/insights";
import { normalizeCustomerName } from "../../lib/customers";

const router = Router();

/** The customer-list entry a job's customer must be (Create Job and customer edits). */
async function customerFromList(name: string) {
  const customer = await prisma.customer.findUnique({ where: { name: normalizeCustomerName(name) } });
  if (!customer) {
    throw new HttpError(400, "Choose the customer from the list — or add them as a new customer first");
  }
  return customer;
}

const createJobSchema = z.object({
  referenceNumber: z.string().min(1),
  description: z.string().min(1),
  customer: z.string().min(1),
  serialNumber: z.string().min(1),
  partNumber: z.string().optional(),
  // These five were missing here, so the Create Job form's values were silently dropped.
  machineNumber: z.string().optional(),
  machineSerialNumber: z.string().optional(),
  customerRef: z.string().optional(),
  customerAccount: z.string().optional(),
  dateReceived: z.coerce.date().optional(),
  woNumber: z.string().optional(),
  poNumber: z.string().optional(),
  jobType: z.nativeEnum(JobType),
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
    jobType: z.nativeEnum(JobType).optional(),
    // Invoice forecast (planner / admin only). null clears it.
    forecastMonth: z.string().regex(MONTH_KEY_RE, "Forecast month must be YYYY-MM").nullable().optional(),
    forecastAmount: z.number().nonnegative().nullable().optional(),
    // Correcting the customer — must be a name from the customer list.
    customer: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.customer !== undefined ||
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
    const customer = await customerFromList(data.customer);
    checkJobDates({}, pickFlowDates(data), req.body);

    const job = await prisma.job.create({
      data: {
        ...data,
        customer: customer.name,
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
    const { search, customer, createdById, jobType, priority, createdFrom, createdTo, stage, status, missingWo, open, dateIssues, customerKey: customerExact } =
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
    // Filters the dashboard links use, so a tile's number and the list behind it always match.
    if (open === "true") dtos = dtos.filter((j) => !j.status.isClosed);
    if (dateIssues === "true") dtos = dtos.filter((j) => j.dateWarnings.length > 0);
    if (customerExact) dtos = dtos.filter((j) => customerKey(j.customer) === customerKey(customerExact));

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
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { quotation: true, repair: true, dispatch: true, invoice: true },
    });
    if (!job) throw new HttpError(404, "Job not found");

    const data = updateJobSchema.parse(req.body);

    // The service type decides whether the job is invoiced or closed without invoice (internal /
    // warranty — see lib/statusEngine.ts), so an invoiced job can't switch to a non-invoiced type.
    const typeChanged = data.jobType !== undefined && data.jobType !== job.jobType;
    const becomesNonInvoiced = typeChanged && isNonInvoicedJobType(data.jobType!);
    if (becomesNonInvoiced && job.invoice?.invoiceDate) {
      throw new HttpError(
        400,
        "This job has already been invoiced. Remove the invoice first if it should be an internal or warranty job."
      );
    }

    const editsForecast = data.forecastMonth !== undefined || data.forecastAmount !== undefined;
    // Switching to a non-invoiced type also removes the job's forecast.
    const touchesForecast = editsForecast || becomesNonInvoiced;
    if (editsForecast) {
      if (!hasRole(req.user, "PLANNER")) {
        throw new HttpError(403, "Only planners can set invoice forecasts");
      }
      if (data.forecastMonth && isNonInvoicedJobType(data.jobType ?? job.jobType)) {
        throw new HttpError(400, "Internal and warranty jobs aren't invoiced, so they can't be forecast");
      }
      if (data.forecastMonth && !hasPurchaseOrder({ poNumber: data.poNumber ?? job.poNumber, repair: job.repair })) {
        throw new HttpError(400, "Only jobs with a PO can be forecast — record the PO first");
      }
      if (data.forecastMonth && data.forecastMonth < monthKeyOf(new Date())) {
        throw new HttpError(400, "That month has ended — backdate it from the Forecast page instead");
      }
    }
    // Freeze any month that has started before its forecast can change (see lib/forecast.ts).
    if (touchesForecast) await ensureForecastsFrozen();

    if (data.woNumberSetAt !== undefined) {
      if (!job.woNumber && !data.woNumber) {
        throw new HttpError(400, "A WO number must be set before its date can be edited");
      }
      const jobCreatedDateFloor = data.jobCreatedDate ?? job.jobCreatedDate;
      if (dayKey(data.woNumberSetAt) < dayKey(jobCreatedDateFloor)) {
        throw new HttpError(400, "WO number date cannot be before the Job Opening date");
      }
    }

    if (data.jobCreatedDate !== undefined) {
      const woNumberSetAtCeiling = data.woNumberSetAt ?? job.woNumberSetAt;
      if (woNumberSetAtCeiling && dayKey(data.jobCreatedDate) > dayKey(woNumberSetAtCeiling)) {
        throw new HttpError(400, "Job Opening cannot be after the WO number date");
      }
    }

    // Same date rules as every other form: no future dates; out-of-order dates need confirming.
    checkJobDates(flowDatesOf(job), pickFlowDates(data), req.body);
    const customer = data.customer !== undefined ? await customerFromList(data.customer) : null;

    const before = {
      customer: job.customer,
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
        ...(customer && { customer: customer.name }),
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
        customer: updated.customer,
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
  ids: z.array(z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id")).min(1).max(2000),
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
