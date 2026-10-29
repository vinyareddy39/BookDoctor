import express from "express";
import {
  bookAppointment,
  getAppointments,
  updateAppointment,
  rescheduleAppointment,
  rescheduleDecision,
  getDoctorActivityFeed,
  markOfflinePayment,
  correctPayment,
  disputePayment,
  getDoctorPaymentsSummary,
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

// Doctor specific routes (BEFORE /:id parameter routes)
router.get("/doctor/activity-feed", auth, role("doctor", "clinic_admin", "admin"), getDoctorActivityFeed);
router.get("/doctor/payments-summary", auth, role("doctor", "clinic_admin", "admin"), getDoctorPaymentsSummary);

// Get all
router.get("/", auth, getAppointments);

// Update status (doctor, clinic_admin, receptionist)
router.put("/:id", auth, role("doctor", "clinic_admin", "admin", "receptionist"), updateAppointment);

// Cancel / Reschedule / Decisions
router.patch("/:id/cancel", auth, cancelAppointment);
router.patch("/:id/reschedule", auth, validate(["appointmentDate", "appointmentTime"]), rescheduleAppointment);
router.post("/:id/reschedule-decision", auth, role("doctor", "clinic_admin", "admin"), validate(["action"]), rescheduleDecision);
router.patch("/:id/no-show", auth, role("doctor", "clinic_admin", "admin", "receptionist"), markNoShow);

// Payments (Offline Marking, Corrections, Disputes)
router.post("/:id/payments/offline", auth, role("doctor", "clinic_admin", "admin", "receptionist"), validate(["amount", "paymentMode"]), markOfflinePayment);
router.put("/:id/payments/correct", auth, role("doctor", "clinic_admin", "admin"), validate(["reason"]), correctPayment);
router.post("/:id/payments/dispute", auth, role("patient"), validate(["reason"]), disputePayment);

// Video Consultation Room
router.get("/:id/room", auth, getAppointmentRoom);

// Feedback
router.patch("/:id/feedback", auth, role("patient"), validate(["rating"]), submitFeedback);

// Doctor specific
router.patch("/:id/prescription", auth, role("doctor"), validate(["prescription"]), addPrescription);

// Hard delete (admin only)
router.delete("/:id", auth, role("clinic_admin", "admin"), deleteAppointment);

export default router;