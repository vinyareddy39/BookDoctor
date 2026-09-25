import express from "express";
import {
  getConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
  getOnlineUsers,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCounts,
} from "../controllers/chatController.js";
import { auth } from "../middleware/index.js";

const router = express.Router();

// ── Open-Access Conversation Endpoints ────────────────────────────────────────
router.get("/conversations", auth, getConversations);
router.post("/conversations", auth, getOrCreateConversation);
router.get("/conversations/:conversationId/messages", auth, getConversationMessages);
router.post("/conversations/:conversationId/messages", auth, sendConversationMessage);
router.patch("/conversations/:conversationId/read", auth, markConversationRead);

// ── Online Users ─────────────────────────────────────────────────────────────
router.get("/online-users", auth, getOnlineUsers);

// ── Legacy / Appointment-based Compatibility ─────────────────────────────────
router.get("/unread", auth, getUnreadCounts);
router.get("/:appointmentId", auth, getMessages);
router.post("/:appointmentId", auth, sendMessage);
router.patch("/:appointmentId/read", auth, markAsRead);

export default router;
