import express from "express";
import {
  createClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
  getClientByTrn,
  getClientsByPincode,
  addLocationToClient,
  addBuildingToLocation,
  addApartmentToBuilding,
} from "../controllers/clientController";
import { authenticate, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Client CRUD routes
router.post("/", authorize(["admin", "super_admin"]), createClient);
router.get("/", getClients);
router.get("/:id", getClient);
router.put("/:id", authorize(["admin", "super_admin"]), updateClient);
router.delete("/:id", authorize(["admin", "super_admin"]), deleteClient);

// Special client routes
router.get("/trn/:trnNumber", getClientByTrn);
router.get("/pincode/:pincode", getClientsByPincode);

// Location management routes
router.post(
  "/:id/locations",
  authorize(["admin", "super_admin"]),
  addLocationToClient
);

// Building management routes
router.post(
  "/:clientId/locations/:locationId/buildings",
  authorize(["admin", "super_admin"]),
  addBuildingToLocation
);

// Apartment management routes
router.post(
  "/:clientId/locations/:locationId/buildings/:buildingId/apartments",
  authorize(["admin", "super_admin"]),
  addApartmentToBuilding
);

export default router;
