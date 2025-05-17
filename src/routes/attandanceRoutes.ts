import express from "express";
import {
  markAttendance,
  getAttendance,
  getProjectAttendance,
  getTodayProjectAttendance,
  getAttendanceSummary,
} from "../controllers/attendanceController";
import { authenticate, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Driver marks attendance
router.post(
  "/project/:projectId/user/:userId",
  authenticate,
  authorize(["driver"]),
  markAttendance
);

// Get user attendance
router.get("/project/:projectId/user/:userId", authenticate, getAttendance);

// Get project-wide attendance
router.get(
  "/project/:projectId",
  authenticate,
  authorize(["admin", "super_admin", "project_manager"]),
  getProjectAttendance
);

router.get(
  "/project/:projectId/today",
  authenticate,
  authorize(["admin", "super_admin", "project_manager", "driver"]),
  getTodayProjectAttendance
);

// Add this to your existing attendanceRoutes.ts
router.get(
  "/project/:projectId/summary",
  authenticate,
  authorize(["admin", "super_admin", "project_manager", "engineer"]),
  getAttendanceSummary
);
export default router;
