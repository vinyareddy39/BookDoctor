import express from "express";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";
import { auth } from "../middleware/index.js";

const router = express.Router();

router.get("/", auth, getMyNotifications);
router.patch("/:id/read", auth, markNotificationRead);
router.patch("/read-all", auth, markAllNotificationsRead);

export default router;
