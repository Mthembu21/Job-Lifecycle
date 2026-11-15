import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";
import { loginIpLimiter, loginLimiter } from "../../middleware/rateLimit";
import { passwordProblem, resolveLoginUser } from "./auth.service";

const router = Router();

export const BCRYPT_COST = 12;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
});

function sessionFor(user: { id: string; name: string; email: string; role: any; tokenVersion: number }) {
  return {
    token: signToken({ sub: user.id, role: user.role, name: user.name, email: user.email, ver: user.tokenVersion }),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

router.post(
  "/login",
  loginIpLimiter,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await resolveLoginUser({
      email,
      password,
      findUserByEmail: (userEmail) =>
        prisma.user.findUnique({
          where: { email: userEmail },
          select: { id: true, name: true, email: true, role: true, passwordHash: true, tokenVersion: true },
        }),
      comparePassword: (candidate, hash) => bcrypt.compare(candidate, hash),
    });

    if (!user) throw new HttpError(401, "Invalid email or password");
    res.json(sessionFor(user));
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const { sub, name, email, role } = req.user!;
    res.json({ id: sub, name, email, role });
  })
);

/**
 * Change your own password. Signs out every other session (tokenVersion bump) and returns a
 * fresh token for this one.
 */
router.post(
  "/change-password",
  authenticate,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const current = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!current || !(await bcrypt.compare(currentPassword, current.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    const problem = passwordProblem(newPassword, current.email);
    if (problem) throw new HttpError(400, problem);
    if (await bcrypt.compare(newPassword, current.passwordHash)) {
      throw new HttpError(400, "Choose a password different from the current one");
    }

    const updated = await prisma.user.update({
      where: { id: current.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST), tokenVersion: { increment: 1 } },
    });
    res.json(sessionFor(updated));
  })
);

/** Sign out everywhere: every token issued so far stops working. */
router.post(
  "/logout-all",
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.user!.sub }, data: { tokenVersion: { increment: 1 } } });
    res.status(204).end();
  })
);

export default router;
