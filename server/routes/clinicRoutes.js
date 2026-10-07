import express from "express";
import { getClinicSettings, updateClinicSettings } from "../controllers/clinicController.js";
import { auth, authorize } from "../middleware/index.js";

const router = express.Router();

// Public or authenticated clinic information
router.get("/", getClinicSettings);

// Clinic Admin updates clinic operational settings
router.put("/", auth, authorize("clinic_settings", "update"), updateClinicSettings);

export default router;
