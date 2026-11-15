import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";
import { prisma } from "./lib/prisma";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import jobsRoutes from "./modules/jobs/jobs.routes";
import quotationRoutes from "./modules/quotation/quotation.routes";
import repairRoutes from "./modules/repair/repair.routes";
import dispatchRoutes from "./modules/dispatch/dispatch.routes";
import invoiceRoutes from "./modules/invoice/invoice.routes";
import auditRoutes from "./modules/audit/audit.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import forecastRoutes from "./modules/forecast/forecast.routes";
import importExportRoutes from "./modules/importExport/importExport.routes";
import boardRoutes from "./modules/board/board.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.trustProxy > 0) app.set("trust proxy", env.trustProxy);

  // Security headers (no sniffing, no framing, HSTS, strict CSP — the API only ever returns JSON or files).
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", apiLimiter);
  // API responses hold business data: never let a browser or proxy cache them.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/health", async (_req, res) => {
    try {
      await prisma.user.findFirst({ select: { id: true } });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/jobs", jobsRoutes);
  app.use("/api/jobs/:jobId/quotation", quotationRoutes);
  app.use("/api/jobs/:jobId/repair", repairRoutes);
  app.use("/api/jobs/:jobId/dispatch", dispatchRoutes);
  app.use("/api/jobs/:jobId/invoice", invoiceRoutes);
  app.use("/api/jobs/:jobId/audit", auditRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/forecast", forecastRoutes);
  app.use("/api/import-export", importExportRoutes);
  app.use("/api/board", boardRoutes);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
