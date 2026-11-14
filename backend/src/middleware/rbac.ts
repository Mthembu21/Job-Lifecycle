import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

/** True if the user has one of the roles. ADMIN can do everything. */
export function hasRole(user: { role: Role } | undefined, ...roles: Role[]): boolean {
  return !!user && (user.role === "ADMIN" || roles.includes(user.role));
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (hasRole(req.user, ...roles)) {
      return next();
    }
    return res.status(403).json({ error: "You do not have permission to perform this action" });
  };
}
