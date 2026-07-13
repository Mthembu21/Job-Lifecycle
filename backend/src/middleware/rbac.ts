import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.role === "ADMIN" || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: "You do not have permission to perform this action" });
  };
}
