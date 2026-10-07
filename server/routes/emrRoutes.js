import express from "express";
import {
  createClinicalNote,
  getClinicalNotes,
  getClinicalNoteById,
  updateClinicalNote,
  amendClinicalNote,
  getDiagnoses,
  createDiagnosis,
  updateDiagnosis,
  createPrescription,
  uploadPrescription,
  downloadPrescriptionAttachment,
  getPrescriptions,
  getPrescriptionById,
  createFollowUp,
  getFollowUps,
  requestFollowUp,
  approveFollowUp,
} from "../controllers/emrController.js";
import { auth } from "../middleware/index.js";
import { authorize } from "../middleware/rbac.js";
import { prescriptionUpload } from "../middleware/prescriptionUpload.js";

const router = express.Router();

// ── 1. Clinical Notes (Receptionists & Lab Techs blocked at RBAC level) ──
router.post("/notes", auth, authorize("clinical_note", "create"), createClinicalNote);
router.get("/notes", auth, authorize("clinical_note", "read"), getClinicalNotes);
router.get("/notes/:id", auth, authorize("clinical_note", "read"), getClinicalNoteById);
router.put("/notes/:id", auth, authorize("clinical_note", "update"), updateClinicalNote);
router.post("/notes/:id/amend", auth, authorize("clinical_note", "update"), amendClinicalNote);

// ── 2. Diagnoses (ICD codes) ──
router.get("/diagnoses", auth, authorize("diagnosis", "read"), getDiagnoses);
router.post("/diagnoses", auth, authorize("diagnosis", "create"), createDiagnosis);
router.put("/diagnoses/:id", auth, authorize("diagnosis", "update"), updateDiagnosis);

// ── 3. Prescriptions ──
router.post("/prescriptions", auth, authorize("prescription", "create"), createPrescription);
router.post("/prescriptions/upload", auth, authorize("prescription", "create"), prescriptionUpload.single("file"), uploadPrescription);
router.get("/prescriptions", auth, authorize("prescription", "read"), getPrescriptions);
router.get("/prescriptions/:id", auth, authorize("prescription", "read"), getPrescriptionById);
router.get("/prescriptions/:id/attachment", auth, authorize("prescription", "read"), downloadPrescriptionAttachment);

// ── 4. Follow-Ups ──
router.post("/follow-ups", auth, authorize("follow_up", "create"), createFollowUp);
router.get("/follow-ups", auth, authorize("follow_up", "read"), getFollowUps);
router.patch("/follow-ups/:id/request", auth, authorize("follow_up", "update"), requestFollowUp);
router.patch("/follow-ups/:id/approve", auth, authorize("follow_up", "update"), approveFollowUp);

export default router;
