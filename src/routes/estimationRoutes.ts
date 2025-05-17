import express from "express";
import {
  createEstimation,
  markAsChecked,
  approveEstimation,
  getEstimationsByProject,
  getEstimationDetails,
  updateEstimation,
  deleteEstimation,
  generateEstimationPdf,
} from "../controllers/estimationController";
import { authenticate, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(authenticate);

// Create estimation - Engineer/Estimator only
router.post(
  "/",
  authorize(["admin", "super_admin", "engineer", "estimator"]),
  createEstimation
);

// Get estimations by project
router.get(
  "/project/:projectId",
  authorize([
    "admin",
    "super_admin",
    "engineer",
    "estimator",
    "project_manager",
    "client",
  ]),
  getEstimationsByProject
);

// Get estimation details
router.get(
  "/:id",
  authorize([
    "admin",
    "super_admin",
    "engineer",
    "estimator",
    "project_manager",
    "client",
  ]),
  getEstimationDetails
);

// Mark as checked - Project Manager/Engineer
router.patch(
  "/:id/check",
  authorize(["admin", "super_admin", "engineer", "project_manager"]),
  markAsChecked
);

// Approve/reject estimation - Admin/Project Manager
router.patch(
  "/:id/approve",
  authorize(["admin", "super_admin", "project_manager"]),
  approveEstimation
);

// Update estimation - Only before approval
router.put(
  "/:id",
  authorize(["admin", "super_admin", "engineer", "estimator"]),
  updateEstimation
);

// Delete estimation - Only before approval
router.delete(
  "/:id",
  authorize(["admin", "super_admin", "engineer", "estimator"]),
  deleteEstimation
);

router.get("/:id/estimation-pdf", generateEstimationPdf);
export default router;
