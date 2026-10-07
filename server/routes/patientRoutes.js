import express from "express";
import {
  registerWalkInPatient,
  getPatients,
  getPatientById,
  updatePatient,
} from "../controllers/patientController.js";
import { auth, authorize } from "../middleware/index.js";

const router = express.Router();

// Front desk walk-in patient registration (Receptionist, Clinic Admin)
router.post("/walk-in", auth, authorize("patient_profile", "create"), registerWalkInPatient);

// Search & list patients (Receptionist, Doctor, Clinic Admin)
router.get("/", auth, authorize("patient_profile", "read"), getPatients);

// Individual patient medical record & profile
router.get("/:id", auth, authorize("patient_profile", "read"), getPatientById);
router.put("/:id", auth, authorize("patient_profile", "update"), updatePatient);

export default router;
