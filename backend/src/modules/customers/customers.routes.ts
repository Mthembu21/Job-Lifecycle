import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { hasRole, requireRole } from "../../middleware/rbac";
import { customerNameProblem, findMatchingCustomer, normalizeCustomerName, similarCustomers } from "../../lib/customers";

const router = Router();

/** GET /customers — the whole customer list A–Z with each customer's job count (small enough to search on the client). */
router.get(
  "/",
  authenticate,
  asyncHandler(async (_req, res) => {
    const [customers, counts] = await Promise.all([
      prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.job.groupBy({ by: ["customer"], _count: { _all: true } }),
    ]);
    const jobsByName = new Map(counts.map((c) => [c.customer, c._count._all]));
    res.json(customers.map((c) => ({ ...c, jobCount: jobsByName.get(c.name) ?? 0 })));
  })
);

const createSchema = z.object({
  name: z.string(),
  /** "It's a different customer, not a typo" — accepted from planners / admins only. */
  confirmSimilar: z.boolean().optional(),
});

/**
 * Refuses a name that looks like a typo of a customer already on the list (409 with `similar`).
 * Planners and admins, who look after the list, can confirm it's a different customer; nobody
 * else can, so a storeman's typo can't create a second copy of a customer.
 */
function refuseLookAlike(
  name: string,
  others: { id: string; name: string }[],
  user: Express.Request["user"],
  confirmSimilar: boolean | undefined
) {
  const similar = similarCustomers(name, others);
  if (similar.length === 0) return;
  const canOverride = hasRole(user, "PLANNER");
  if (canOverride && confirmSimilar === true) return;
  const names = similar.map((c) => c.name).join(", ");
  throw new HttpError(
    409,
    `${name} looks like ${names}, already on the customer list — check for a typo` +
      (canOverride ? "" : ". If it really is a different customer, ask a planner to add it"),
    { similar, canOverride }
  );
}

/**
 * POST /customers — adds a customer. The name is saved in capitals; a name that's already on the
 * list — or only differs by spaces / punctuation ("IVAN PLATS" vs "IVANPLATS") — is refused (409)
 * with the existing customer, so the form can pick that one instead.
 */
router.post(
  "/",
  authenticate,
  requireRole("STOREMAN", "PLANNER"),
  asyncHandler(async (req, res) => {
    const { name: raw, confirmSimilar } = createSchema.parse(req.body);
    const name = normalizeCustomerName(raw);

    // First: is it a customer we already have (same name, near-copy, or a SASOL site)? The form
    // then simply picks that customer.
    const all = await prisma.customer.findMany({ select: { id: true, name: true } });
    const existing = findMatchingCustomer(name, all);
    if (existing) {
      throw new HttpError(409, `${existing.name} is already on the customer list`, { existing });
    }
    const problem = customerNameProblem(raw);
    if (problem) throw new HttpError(400, problem);
    refuseLookAlike(name, all, req.user, confirmSimilar);

    try {
      const created = await prisma.customer.create({ data: { name, createdById: req.user!.sub }, select: { id: true, name: true } });
      res.status(201).json(created);
    } catch (err) {
      // Two people adding the same name at once: the unique index stops the second.
      if ((err as { code?: string }).code === "P2002") {
        const existingNow = await prisma.customer.findUnique({ where: { name }, select: { id: true, name: true } });
        throw new HttpError(409, `${name} is already on the customer list`, { existing: existingNow });
      }
      throw err;
    }
  })
);

/**
 * PATCH /customers/:id — renames a customer, and every job carrying the old name with it, in one
 * go. Each job's history records the change. The new name follows the same rules as a new customer
 * and can't be (or nearly be) another customer's name.
 */
router.patch(
  "/:id",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const { name: raw, confirmSimilar } = createSchema.parse(req.body);
    const problem = customerNameProblem(raw);
    if (problem) throw new HttpError(400, problem);
    const name = normalizeCustomerName(raw);

    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) throw new HttpError(404, "Customer not found");
    if (customer.name === name) {
      res.json({ id: customer.id, name, jobsUpdated: 0 });
      return;
    }
    const others = await prisma.customer.findMany({ where: { id: { not: customer.id } }, select: { id: true, name: true } });
    const clash = findMatchingCustomer(name, others);
    if (clash) throw new HttpError(409, `${clash.name} is already on the customer list`, { existing: clash });
    refuseLookAlike(name, others, req.user, confirmSimilar);

    const jobs = await prisma.job.findMany({ where: { customer: customer.name }, select: { id: true } });
    await prisma.$transaction([
      prisma.customer.update({ where: { id: customer.id }, data: { name } }),
      prisma.job.updateMany({ where: { customer: customer.name }, data: { customer: name } }),
      // Frozen forecasts keep their amounts; only the customer's label follows the rename.
      prisma.forecastSnapshot.updateMany({ where: { customer: customer.name }, data: { customer: name } }),
      // MongoDB refuses an empty insert, so a customer with no jobs gets no history entries.
      ...(jobs.length > 0
        ? [
            prisma.jobAuditLog.createMany({
              data: jobs.map((j) => ({
                jobId: j.id,
                stage: "JOB",
                action: "UPDATE",
                summary: `Customer: ${customer.name} -> ${name}`,
                comment: "Customer renamed on the customer list",
                changedById: req.user!.sub,
              })),
            }),
          ]
        : []),
    ]);
    res.json({ id: customer.id, name, jobsUpdated: jobs.length });
  })
);

/**
 * DELETE /customers/:id — removes a customer from the list (e.g. a duplicate added by mistake).
 * Only a customer with no jobs can go: a job's customer must always be on the list. To merge a
 * duplicate that has jobs, move its jobs to the right customer first.
 */
router.delete(
  "/:id",
  authenticate,
  requireRole("PLANNER"),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) throw new HttpError(404, "Customer not found");
    const jobCount = await prisma.job.count({ where: { customer: customer.name } });
    if (jobCount > 0) {
      throw new HttpError(
        409,
        `${customer.name} has ${jobCount} job${jobCount === 1 ? "" : "s"} — move ${jobCount === 1 ? "it" : "them"} to another customer before deleting`
      );
    }
    await prisma.customer.delete({ where: { id: customer.id } });
    res.status(204).end();
  })
);

export default router;
