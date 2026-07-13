import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";

const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const logs = await prisma.jobAuditLog.findMany({
      where: { jobId },
      include: { changedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { changedAt: "asc" },
    });
    res.json(logs);
  })
);

export default router;
