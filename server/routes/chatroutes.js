import express from "express";
import { getMessages, sendMessage, markAsRead, getUnreadCounts } from "../controllers/chatController.js";
import { auth } from "../middleware/index.js";

const router = express.Router();

// Get unread counts
router.get("/unread", auth, getUnreadCounts);

// Get all messages for an appointment
router.get("/:appointmentId", auth, getMessages);

// Send a message (REST fallback)
router.post("/:appointmentId", auth, sendMessage);

// Mark messages as read
router.patch("/:appointmentId/read", auth, markAsRead);

export default router;
