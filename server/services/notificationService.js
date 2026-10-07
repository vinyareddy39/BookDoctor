import Notification from "../models/Notification.js";
import { sendNotificationToUser } from "../socket.js";

/**
 * Creates a persistent notification in DB and emits real-time socket event.
 */
export const createNotification = async ({
  recipient,
  sender = null,
  title,
  message,
  type = "general",
  referenceId = null,
  referenceModel = null,
  link = null,
}) => {
  try {
    if (!recipient) return null;

    const notification = await Notification.create({
      recipient,
      sender,
      title,
      message,
      type,
      referenceId,
      referenceModel,
      link,
    });

    // Real-time dispatch via Socket.io
    sendNotificationToUser(recipient, {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link,
      createdAt: notification.createdAt,
      isRead: false,
    });

    return notification;
  } catch (err) {
    console.error("Error creating notification:", err.message);
    return null;
  }
};
