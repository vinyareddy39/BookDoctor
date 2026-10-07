import Notification from "../models/Notification.js";

// ── GET USER NOTIFICATIONS ──────────────────────────────────────────────────
export const getMyNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, limit = 30 } = req.query;
    let query = { recipient: req.user._id };

    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate("sender", "name role")
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    return req.http.ok({
      notifications,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

// ── MARK SINGLE NOTIFICATION READ ───────────────────────────────────────────
export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return req.http.notFound("Notification not found");
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return req.http.ok({ notification, unreadCount }, "Notification marked as read");
  } catch (err) {
    next(err);
  }
};

// ── MARK ALL NOTIFICATIONS AS READ ─────────────────────────────────────────
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return req.http.ok({ unreadCount: 0 }, "All notifications marked as read");
  } catch (err) {
    next(err);
  }
};
