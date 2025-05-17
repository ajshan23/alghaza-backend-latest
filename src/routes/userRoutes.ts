import express from "express";
import {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  login,
  getActiveEngineers,
  getActiveDrivers,
  getActiveWorkers,
} from "../controllers/userController";
import { authenticate, authorize } from "../middlewares/authMiddleware";
import { upload } from "../config/multer";

const router = express.Router();

router.post("/login", login);
// Apply authentication to all routes
router.use(authenticate);
//
router.get(
  "/engineers",
  authorize(["admin", "super_admin", "finance"]),
  getActiveEngineers
);
router.get(
  "/drivers",
  authorize(["admin", "super_admin", "finance"]),
  getActiveDrivers
);
router.get(
  "/workers",
  authorize(["admin", "super_admin", "finance"]),
  getActiveWorkers
);

// Create user - Admin only
router.post(
  "/",
  authorize(["admin", "super_admin"]),
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "signatureImage", maxCount: 1 },
  ]),
  createUser
);

// Get all users - Admin + Finance
router.get("/", authorize(["admin", "super_admin", "finance"]), getUsers);

// Get single user
router.get("/:id", getUser);

// Update user
router.put(
  "/:id",
  authorize(["admin", "super_admin", "finance"]), // This should verify the user is authenticated
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "signatureImage", maxCount: 1 },
  ]),
  updateUser
);

// Delete user - Admin only
router.delete("/:id", authorize(["admin", "super_admin"]), deleteUser);

export default router;
