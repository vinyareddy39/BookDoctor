import express from "express";
import {
  saveStructuredPrescription,
  getPrescriptionByAppointment,
  extractPrescription,
  confirmPrescription,
  getPatientRecoveryPlan,
  getTodayDoses,
  getDoseHistory,
  checkInDose,
  getAdherenceSummary,
  inviteCaregiver,
  getCaregiverLinks,
  revokeCaregiverLink,
} from "../controllers/prescriptionController.js";
import { auth } from "../middleware/index.js";

const router = express.Router();

// ── Prescriptions & Recovery Plans ──
router.post("/prescriptions", auth, saveStructuredPrescription);
router.get("/prescriptions/by-appointment/:appointmentId", auth, getPrescriptionByAppointment);
router.post("/prescriptions/:id/extract", auth, extractPrescription);
router.post("/prescriptions/:id/confirm", auth, confirmPrescription);
router.get("/prescriptions/patient/plan", auth, getPatientRecoveryPlan);
router.get("/prescriptions/:id/adherence", auth, getAdherenceSummary);

// ── Dose Events & Check-ins ──
router.get("/dose-events/today", auth, getTodayDoses);
router.get("/dose-events/history", auth, getDoseHistory);
router.post("/dose-events/:id/checkin", auth, checkInDose);

// ── Caregiver Management ──
router.post("/caregiver/invite", auth, inviteCaregiver);
router.get("/caregiver/links", auth, getCaregiverLinks);
router.patch("/caregiver/links/:id/revoke", auth, revokeCaregiverLink);

export default router;
