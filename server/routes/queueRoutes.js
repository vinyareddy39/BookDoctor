import express from "express";
import {
  generateToken,
  getTodayQueue,
  callToken,
  startConsultation,
  completeConsultation,
  skipToken,
} from "../controllers/queueController.js";
import { auth, role } from "../middleware/index.js";

const router = express.Router();

// Get today's queue (authenticated staff or public waiting room display)
router.get("/", auth, getTodayQueue);

// Generate walk-in token (Receptionist, Doctor, Clinic Admin)
router.post("/token", auth, role("receptionist", "doctor", "clinic_admin", "admin"), generateToken);

// Status transitions
router.patch("/:id/call", auth, role("receptionist", "doctor", "clinic_admin", "admin"), callToken);
router.patch("/:id/start", auth, role("doctor", "clinic_admin", "admin"), startConsultation);
router.patch("/:id/complete", auth, role("doctor", "receptionist", "clinic_admin", "admin"), completeConsultation);
router.patch("/:id/skip", auth, role("doctor", "receptionist", "clinic_admin", "admin"), skipToken);

export default router;
