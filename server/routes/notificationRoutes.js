import express from "express";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDeviceToken,
} from "../controllers/notificationController.js";
import { auth } from "../middleware/index.js";

const router = express.Router();

router.get("/", auth, getMyNotifications);
router.patch("/:id/read", auth, markNotificationRead);
router.patch("/read-all", auth, markAllNotificationsRead);

// Notification Preferences
router.get("/preferences", auth, getNotificationPreferences);
router.put("/preferences", auth, updateNotificationPreferences);

// Web Push / Device Tokens
router.post("/device-token", auth, registerDeviceToken);

export default router;
