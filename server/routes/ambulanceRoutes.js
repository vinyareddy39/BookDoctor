
import express from "express";
import { auth } from "../middleware/index.js";
import {
  getAmbulanceStatus,
  updateAmbulanceLocation,
  completeAmbulanceTrip
} from "../controllers/ambulanceController.js";

const router = express.Router();

// Get status (Patient uses this)
router.get("/:id", auth, getAmbulanceStatus);

// Driver actions
router.post("/:id/location", updateAmbulanceLocation); // Unprotected for demo simulation, in real app needs driver auth
router.post("/:id/complete", completeAmbulanceTrip);

export default router;

