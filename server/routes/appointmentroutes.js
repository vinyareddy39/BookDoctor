import express from "express";
import {
  bookAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";

import { auth } from "../middleware/index.js";

const router = express.Router();

// Patient/Doctor/Admin (auth required)
router.post("/", auth, bookAppointment);
router.get("/", auth, getAppointments);
router.put("/:id", auth, updateAppointment);
router.delete("/:id", auth, deleteAppointment);

export default router;