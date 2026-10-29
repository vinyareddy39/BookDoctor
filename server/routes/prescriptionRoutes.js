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
  uploadHandwrittenPrescription,
} from "../controllers/prescriptionController.js";
import {
  submitSymptomCheckin,
  getSymptomTrends,
  requestRefill,
  getDoctorAdherenceAnalytics,
  getMedicalId,
  updateMedicalId,
  generateShareableMedicalIdToken,
  getPublicMedicalId,
  revokeMedicalIdToken,
} from "../controllers/recoveryEnhancementController.js";
import { auth, role } from "../middleware/index.js";
import { prescriptionUpload } from "../middleware/prescriptionUpload.js";

const router = express.Router();

// ── Prescriptions & Recovery Plans ──
router.post("/prescriptions/upload", auth, prescriptionUpload.single("file"), uploadHandwrittenPrescription);
router.post("/prescriptions", auth, saveStructuredPrescription);
router.get("/prescriptions/by-appointment/:appointmentId", auth, getPrescriptionByAppointment);
router.post("/prescriptions/:id/extract", auth, extractPrescription);
router.post("/prescriptions/:id/confirm", auth, confirmPrescription);
router.get("/prescriptions/patient/plan", auth, getPatientRecoveryPlan);
router.get("/prescriptions/:id/adherence", auth, getAdherenceSummary);

// ── Daily Symptom Check-ins & Trends ──
router.post("/prescriptions/symptoms/checkin", auth, submitSymptomCheckin);
router.get("/prescriptions/symptoms/trends", auth, getSymptomTrends);

// ── Refill Requests & Doctor Recovery Analytics ──
router.post("/prescriptions/refill/request", auth, requestRefill);
router.get("/prescriptions/doctor/adherence-analytics", auth, role("doctor", "clinic_admin", "admin"), getDoctorAdherenceAnalytics);

// ── Medical ID & Offline Emergency Card ──
router.get("/prescriptions/medical-id", auth, getMedicalId);
router.put("/prescriptions/medical-id", auth, updateMedicalId);
router.post("/prescriptions/medical-id/share", auth, generateShareableMedicalIdToken);
router.get("/prescriptions/medical-id/public/:token", getPublicMedicalId);
router.delete("/prescriptions/medical-id/share/:token", auth, revokeMedicalIdToken);

// ── Dose Events & Check-ins ──
router.get("/dose-events/today", auth, getTodayDoses);
router.get("/dose-events/history", auth, getDoseHistory);
router.post("/dose-events/:id/checkin", auth, checkInDose);

// ── Caregiver Management ──
router.post("/caregiver/invite", auth, inviteCaregiver);
router.get("/caregiver/links", auth, getCaregiverLinks);
router.patch("/caregiver/links/:id/revoke", auth, revokeCaregiverLink);

export default router;
