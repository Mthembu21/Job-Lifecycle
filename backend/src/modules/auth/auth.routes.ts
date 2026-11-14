import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { getFallbackUser, resolveLoginUser } from "./auth.service";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await resolveLoginUser({
      email,
      password,
      findUserByEmail: async (userEmail) => {
        const dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        return dbUser
          ? {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role,
              passwordHash: dbUser.passwordHash,
            }
          : null;
      },
      comparePassword: async (candidatePassword, passwordHash) => bcrypt.compare(candidatePassword, passwordHash),
      fallbackUser: getFallbackUser(email),
    });

    if (!user) throw new HttpError(401, "Invalid email or password");

    const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new HttpError(404, "User not found");
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

export default router;
