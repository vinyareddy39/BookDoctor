import express from "express";
import {
  bookAppointment,
  getAppointments,
  updateAppointment,
  cancelAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";
import { auth, role, validate } from "../middleware/index.js";

const router = express.Router();

// Book — patient only (validate required fields first)
router.post(
  "/",
  auth,
  role("patient"),
  validate(["doctorId", "appointmentDate", "appointmentTime", "amount"]),
  bookAppointment
);

// Get all (role-scoped: patient sees own, doctor sees their clinic's, admin sees all)
router.get("/", auth, getAppointments);

// Update status (doctor or admin — ownership enforced in controller)
router.put("/:id", auth, role("doctor", "admin"), updateAppointment);

// Soft-cancel (patient, doctor, or admin — ownership enforced in controller)
router.patch("/:id/cancel", auth, cancelAppointment);

// Hard delete (admin only — for data cleanup)
router.delete("/:id", auth, role("admin"), deleteAppointment);

export default router;