import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { exportSchedulerWorkbook, previewSchedulerImport, runSchedulerImport } from "./scheduler.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post(
  "/scheduler/preview",
  authenticate,
  requireRole("ADMIN"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "No file uploaded (expected field 'file')");
    const summary = await previewSchedulerImport(req.file.buffer);
    res.json(summary);
  })
);

router.post(
  "/scheduler",
  authenticate,
  requireRole("ADMIN"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "No file uploaded (expected field 'file')");
    const summary = await runSchedulerImport(req.file.buffer, { createdById: req.user!.sub });
    res.json(summary);
  })
);

router.get(
  "/scheduler/export",
  authenticate,
  requireRole("STOREMAN", "PLANNER"),
  asyncHandler(async (_req, res) => {
    const buffer = await exportSchedulerWorkbook();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Epiroc-Job-Tracker-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  })
);

export default router;
