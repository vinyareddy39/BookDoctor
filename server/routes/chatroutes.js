import express from "express";
import { getMessages, sendMessage } from "../controllers/chatController.js";
import { auth } from "../middleware/index.js";

const router = express.Router();

// Get all messages for an appointment
router.get("/:appointmentId", auth, getMessages);

// Send a message (REST fallback)
router.post("/:appointmentId", auth, sendMessage);

export default router;
