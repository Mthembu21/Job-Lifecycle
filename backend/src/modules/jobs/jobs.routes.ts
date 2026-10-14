import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog, diffSummary } from "../../lib/audit";
import { jobListInclude, toJobDto } from "./jobs.dto";

const router = Router();

const createJobSchema = z.object({
  referenceNumber: z.string().min(1),
  description: z.string().min(1),
  customer: z.string().min(1),
  serialNumber: z.string().min(1),
  partNumber: z.string().optional(),
  machineNumber: z.string().optional(),
  machineSerialNumber: z.string().optional(),
  customerRef: z.string().optional(),
  customerAccount: z.string().optional(),
  dateReceived: z.coerce.date().optional(),
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
  })
  .refine(
    (data) =>
      data.woNumber !== undefined ||
      data.poNumber !== undefined ||
      data.woNumberSetAt !== undefined ||
      data.jobCreatedDate !== undefined,
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

    let dtos = jobs.map(toJobDto);

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
      if (job.dateReceived && data.jobCreatedDate.toISOString().slice(0, 10) < job.dateReceived.toISOString().slice(0, 10)) {
        throw new HttpError(400, "Job created date cannot be before the date received");
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

    await prisma.job.delete({ where: { id: job.id } });

    res.status(204).send();
  })
);

export default router;
