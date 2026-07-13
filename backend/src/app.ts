import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import jobsRoutes from "./modules/jobs/jobs.routes";
import quotationRoutes from "./modules/quotation/quotation.routes";
import repairRoutes from "./modules/repair/repair.routes";
import dispatchRoutes from "./modules/dispatch/dispatch.routes";
import invoiceRoutes from "./modules/invoice/invoice.routes";
import auditRoutes from "./modules/audit/audit.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/jobs", jobsRoutes);
  app.use("/api/jobs/:jobId/quotation", quotationRoutes);
  app.use("/api/jobs/:jobId/repair", repairRoutes);
  app.use("/api/jobs/:jobId/dispatch", dispatchRoutes);
  app.use("/api/jobs/:jobId/invoice", invoiceRoutes);
  app.use("/api/jobs/:jobId/audit", auditRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(errorHandler);

  return app;
}
