import express from "express";
import {
  bookAppointment,
  getAppointments,
  updateAppointment,
  rescheduleAppointment,
  addPrescription,
  cancelAppointment,
  markNoShow,
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

// Update status (doctor, clinic_admin, receptionist)
router.put("/:id", auth, role("doctor", "clinic_admin", "admin", "receptionist"), updateAppointment);

// Cancel / Reschedule / No-Show
router.patch("/:id/cancel", auth, cancelAppointment);
router.patch("/:id/reschedule", auth, validate(["appointmentDate", "appointmentTime"]), rescheduleAppointment);
router.patch("/:id/no-show", auth, role("doctor", "clinic_admin", "admin", "receptionist"), markNoShow);

// Video Consultation Room
router.get("/:id/room", auth, getAppointmentRoom);

// Feedback
router.patch("/:id/feedback", auth, role("patient"), validate(["rating"]), submitFeedback);

// Doctor specific
router.patch("/:id/prescription", auth, role("doctor"), validate(["prescription"]), addPrescription);

// Hard delete (admin only)
router.delete("/:id", auth, role("clinic_admin", "admin"), deleteAppointment);

export default router;