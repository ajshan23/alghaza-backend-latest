import express from "express";
import {
  createWorkCompletion,
  uploadWorkCompletionImages,
  getWorkCompletion,
  deleteWorkCompletionImage,
  getProjectWorkCompletionImages,
  getCompletionData,
} from "../controllers/workCompletionController";
import { authenticate, authorize } from "../middlewares/authMiddleware";
import { upload } from "../config/multer";

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorize(["engineer", "admin", "super_admin"]),
  createWorkCompletion
);

router.post(
  "/project/:projectId/images",
  authorize(["engineer", "admin", "super_admin"]),
  upload.array("images", 10),
  uploadWorkCompletionImages
);

router.get("/project/:projectId", getWorkCompletion);

router.get("/project/:projectId/images", getProjectWorkCompletionImages);
router.get("/project/:projectId/work-comp", getCompletionData);
router.delete(
  "/:workCompletionId/images/:imageId",
  authorize(["engineer", "admin", "super_admin"]),
  deleteWorkCompletionImage
);

export default router;
