// routes/analytics.routes.ts
import express from "express";
import {
  getOverviewStats,
  getEmployeeTrend,
  getProjectAnalytics,
  getProjectAnalyticsAll,
} from "../controllers/attendanceAnalytics";
import { authenticate, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Main dashboard overview
router.get(
  "/overview",
  authenticate,
  authorize(["hr", "admin", "super_admin"]),
  getOverviewStats
);

// Individual employee trend
router.get(
  "/employee/:employeeId",
  authenticate,
  authorize(["hr", "admin", "super_admin"]),
  getEmployeeTrend
);

// All projects analytics
router.get(
  "/projects",
  authenticate,
  authorize(["hr", "admin", "super_admin"]),
  getProjectAnalyticsAll
);

// Specific project analytics
router.get(
  "/projects/:projectId",
  authenticate,
  authorize(["hr", "admin", "super_admin"]),
  getProjectAnalytics
);

export default router;
