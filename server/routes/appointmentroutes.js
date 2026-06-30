import express from "express";
import {
  bookAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";
import { auth, validate } from "../middleware/index.js";

const router = express.Router();

// POST: validate that booking body has required fields before controller runs
router.post(
  "/",
  auth,
  validate(["doctorId", "appointmentDate", "appointmentTime", "amount"]),
  bookAppointment
);

router.get("/",      auth, getAppointments);
router.put("/:id",   auth, updateAppointment);
router.delete("/:id", auth, deleteAppointment);

export default router;