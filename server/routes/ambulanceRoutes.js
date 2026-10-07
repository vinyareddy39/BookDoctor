
import express from "express";
import { optionalAuth } from "../middleware/index.js";
import {
  getAmbulanceStatus,
  updateAmbulanceLocation,
  completeAmbulanceTrip
} from "../controllers/ambulanceController.js";

const router = express.Router();

// Get status (Patient tracking or Ambulance driver login)
router.get("/:id", optionalAuth, getAmbulanceStatus);

// Driver actions (Demo driver app / tracking)
router.post("/:id/location", optionalAuth, updateAmbulanceLocation);
router.post("/:id/complete", optionalAuth, completeAmbulanceTrip);

export default router;

