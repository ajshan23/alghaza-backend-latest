import express from "express";
import {
  createQuotation,
  getQuotationByProject,
  updateQuotation,
  approveQuotation,
  deleteQuotation,
  generateQuotationPdf,
} from "../controllers/quotationController";
import { authenticate, authorize } from "../middlewares/authMiddleware";
import { upload } from "../config/multer";

const router = express.Router();

router.use(authenticate);

// Add debugging middleware before upload
router.post(
  "/",
  authorize(["admin", "super_admin", "engineer"]),
  (req, res, next) => {
    console.log("Content-Type header:", req.headers["content-type"]);
    next();
  },
  upload.any(),
  (req, res, next) => {
    console.log("Multer processed files:", req.files);
    next();
  },
  createQuotation
);

// ... other routes
router.get(
  "/project/:projectId",
  authorize(["admin", "super_admin", "engineer", "finance"]),
  getQuotationByProject
);

router.put(
  "/:id",
  authorize(["admin", "super_admin", "engineer"]),
  upload.any(),
  updateQuotation
);

router.patch(
  "/:id/approval",
  authorize(["admin", "super_admin"]),
  approveQuotation
);

router.delete("/:id", authorize(["admin", "super_admin"]), deleteQuotation);


router.get("/:id/generate-pdf", authorize(["admin", "super_admin"]),generateQuotationPdf);
export default router;
