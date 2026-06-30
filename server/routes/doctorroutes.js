import express from "express";
import {
  createDoctor,
  getDoctors,
  getDoctor,
  updateDoctor,
  deleteDoctor,
  getMyDoctorProfile,
  updateMyDoctorProfile,
  toggleAvailability,
} from "../controllers/doctorController.js";
import { auth, role } from "../middleware/index.js";

const router = express.Router();

// ─── IMPORTANT: specific named routes MUST come before /:id ───────────────────

// Doctor self — profile management (must be above /:id)
router.get("/profile/me",        auth, role("doctor"), getMyDoctorProfile);
router.put("/profile/me",        auth, role("doctor"), updateMyDoctorProfile);
router.patch("/profile/me/toggle", auth, role("doctor"), toggleAvailability);

// Public — list & single (supports ?city=&specialization=&available=true)
router.get("/",    getDoctors);
router.get("/:id", getDoctor);

// Admin only
router.post("/",      auth, role("admin"), createDoctor);
router.put("/:id",    auth, role("admin"), updateDoctor);
router.delete("/:id", auth, role("admin"), deleteDoctor);

export default router;