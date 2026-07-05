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
  getDoctorAnalytics,
} from "../controllers/doctorController.js";
import { auth, role } from "../middleware/index.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// ─── IMPORTANT: specific named routes MUST come before /:id ───────────────────

// Doctor self — profile management (must be above /:id)
router.get("/analytics",         auth, role("doctor"), getDoctorAnalytics);
router.get("/profile/me",        auth, role("doctor"), getMyDoctorProfile);
router.put("/profile/me",        auth, role("doctor"), updateMyDoctorProfile);
router.patch("/profile/me/toggle", auth, role("doctor"), toggleAvailability);

// Public — list & single (supports ?city=&specialization=&available=true)
// Cache list for 5 minutes (300s), single doctor for 5 minutes
router.get("/",    cacheMiddleware(300), getDoctors);
router.get("/:id", cacheMiddleware(300), getDoctor);

// Admin only
router.post("/",      auth, role("admin"), createDoctor);
router.put("/:id",    auth, role("admin"), updateDoctor);
router.delete("/:id", auth, role("admin"), deleteDoctor);

export default router;