import express from "express";
import { auth } from "../middleware/index.js";
import {
  triggerEmergency,
  updateLocation,
  getEmergencyStatus,
  resolveEmergency,
  getIncomingEmergencies,
  markCapacityUpdated
} from "../controllers/emergencyController.js";

const router = express.Router();

// Patient routes
router.post("/trigger", auth, triggerEmergency);
router.post("/:id/location", auth, updateLocation);

// Shared routes
router.get("/:id/status", auth, getEmergencyStatus);
router.patch("/:id/resolve", auth, resolveEmergency);

// Doctor routes
router.get("/doctor/incoming", auth, getIncomingEmergencies);
router.patch("/doctor/capacity", auth, markCapacityUpdated);

export default router;

