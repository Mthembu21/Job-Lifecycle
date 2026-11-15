import { NextFunction, Request, Response } from "express";
import { JwtPayload, verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Checks the Bearer token, then the account itself: a deleted account, a changed role or a
 * password change (tokenVersion bump) takes effect on the very next request, not when the
 * token expires. Role and name always come from the database, never from the token.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  let payload: JwtPayload;
  try {
    payload = verifyToken(header.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.ver) {
      return res.status(401).json({ error: "Session ended — please sign in again" });
    }
    req.user = { sub: user.id, name: user.name, email: user.email, role: user.role, ver: user.tokenVersion };
    next();
  } catch (error) {
    next(error);
  }
}
