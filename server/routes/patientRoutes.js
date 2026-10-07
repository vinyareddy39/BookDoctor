import express from "express";
import {
  registerWalkInPatient,
  getPatients,
  getPatientById,
  updatePatient,
} from "../controllers/patientController.js";
import { getPatientTimeline } from "../controllers/timelineController.js";
import { auth, authorize } from "../middleware/index.js";

const router = express.Router();

// Front desk walk-in patient registration (Receptionist, Clinic Admin)
router.post("/walk-in", auth, authorize("patient_profile", "create"), registerWalkInPatient);

// Search & list patients (Receptionist, Doctor, Clinic Admin)
router.get("/", auth, authorize("patient_profile", "read"), getPatients);

// Patient Chronological Timeline (Appointments, EMR, Rx, Labs, Invoices, Docs)
router.get("/me/timeline", auth, getPatientTimeline);
router.get("/:patientId/timeline", auth, authorize("patient_profile", "read"), getPatientTimeline);

// Individual patient medical record & profile
router.get("/:id", auth, authorize("patient_profile", "read"), getPatientById);
router.put("/:id", auth, authorize("patient_profile", "update"), updatePatient);

export default router;
