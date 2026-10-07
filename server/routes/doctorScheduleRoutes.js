import express from "express";
import {
  getDoctorAvailability,
  updateDoctorAvailability,
  getDoctorLeaves,
  addDoctorLeave,
  deleteDoctorLeave,
  getAvailableSlots,
} from "../controllers/doctorScheduleController.js";
import { auth, role } from "../middleware/index.js";

const router = express.Router();

// Public / Authenticated slots query
router.get("/slots", getAvailableSlots);

// Availability
router.get("/availability/:doctorId", auth, getDoctorAvailability);
router.put("/availability/:doctorId", auth, role("doctor", "clinic_admin", "admin"), updateDoctorAvailability);

// Leaves / Exceptions
router.get("/leaves", auth, getDoctorLeaves);
router.post("/leaves", auth, role("doctor", "clinic_admin", "admin", "receptionist"), addDoctorLeave);
router.delete("/leaves/:id", auth, role("doctor", "clinic_admin", "admin"), deleteDoctorLeave);

export default router;
