import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";

const router = Router();

const querySchema = z.object({ role: z.nativeEnum(Role).optional() });

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { role } = querySchema.parse(req.query);
    const users = await prisma.user.findMany({
      where: role ? { role } : undefined,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  })
);

export default router;
