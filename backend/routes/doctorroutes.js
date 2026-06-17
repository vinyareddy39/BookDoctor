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

// Public - list & single (supports ?city=&specialization=&available=true)
router.get("/", getDoctors);
router.get("/:id", getDoctor);

// Doctor self - profile management
router.get("/profile/me", auth, role("doctor"), getMyDoctorProfile);
router.put("/profile/me", auth, role("doctor"), updateMyDoctorProfile);
router.patch("/profile/me/toggle", auth, role("doctor"), toggleAvailability);

// Admin only
router.post("/", auth, role("admin"), createDoctor);
router.put("/:id", auth, role("admin"), updateDoctor);
router.delete("/:id", auth, role("admin"), deleteDoctor);

export default router;