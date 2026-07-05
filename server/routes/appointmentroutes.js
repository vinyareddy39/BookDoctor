import express from "express";
import {
  bookAppointment,
  getAppointments,
  updateAppointment,
  rescheduleAppointment,
  addPrescription,
  cancelAppointment,
  deleteAppointment,
  getAppointmentRoom,
  submitFeedback,
} from "../controllers/appointmentController.js";
import { auth, role, validate } from "../middleware/index.js";

const router = express.Router();

// Book — patient only
router.post(
  "/",
  auth,
  role("patient"),
  validate(["doctorId", "appointmentDate", "appointmentTime", "amount"]),
  bookAppointment
);

// Get all
router.get("/", auth, getAppointments);

// Update status (doctor or admin)
router.put("/:id", auth, role("doctor", "admin"), updateAppointment);

// Cancel / Reschedule
router.patch("/:id/cancel", auth, cancelAppointment);
router.patch("/:id/reschedule", auth, validate(["appointmentDate", "appointmentTime"]), rescheduleAppointment);

// Video Consultation Room
router.get("/:id/room", auth, getAppointmentRoom);

// Feedback
router.patch("/:id/feedback", auth, role("patient"), validate(["rating"]), submitFeedback);

// Doctor specific
router.patch("/:id/prescription", auth, role("doctor"), validate(["prescription"]), addPrescription);

// Hard delete (admin only)
router.delete("/:id", auth, role("admin"), deleteAppointment);

export default router;