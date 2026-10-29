import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import DeviceToken from "../models/DeviceToken.js";

// ── GET USER NOTIFICATIONS (GROUPED TODAY VS EARLIER) ───────────────────────
export const getMyNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;
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

    // Group into Today and Earlier
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const today = [];
    const earlier = [];

    for (const notif of notifications) {
      const createdTime = new Date(notif.createdAt).getTime();
      if (createdTime >= startOfToday) {
        today.push(notif);
      } else {
        earlier.push(notif);
      }
    }

    return req.http.ok({
      notifications,
      grouped: { today, earlier },
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

// ── GET NOTIFICATION PREFERENCES ───────────────────────────────────────────
export const getNotificationPreferences = async (req, res, next) => {
  try {
    let prefs = await NotificationPreference.findOne({ userId: req.user._id });

    if (!prefs) {
      prefs = await NotificationPreference.create({ userId: req.user._id });
    }

    return req.http.ok(prefs);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE NOTIFICATION PREFERENCES ────────────────────────────────────────
export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const { channels, quietHours, language } = req.body;

    let prefs = await NotificationPreference.findOne({ userId: req.user._id });
    if (!prefs) {
      prefs = new NotificationPreference({ userId: req.user._id });
    }

    if (channels) {
      for (const [evt, val] of Object.entries(channels)) {
        prefs.channels[evt] = { ...prefs.channels[evt], ...val };
      }
    }

    if (quietHours) {
      prefs.quietHours = { ...prefs.quietHours, ...quietHours };
    }

    if (language && ["en", "te", "hi"].includes(language)) {
      prefs.language = language;
    }

    await prefs.save();
    return req.http.ok(prefs, "Notification preferences updated successfully");
  } catch (err) {
    next(err);
  }
};

// ── REGISTER DEVICE TOKEN (WEB PUSH / MOBILE PUSH) ──────────────────────────
export const registerDeviceToken = async (req, res, next) => {
  try {
    const { platform = "web", token, endpoint, keys } = req.body;

    if (!token && !endpoint) {
      return req.http.badRequest("Token or endpoint is required to register device");
    }

    const device = await DeviceToken.findOneAndUpdate(
      { userId: req.user._id, ...(endpoint ? { endpoint } : { token }) },
      {
        userId: req.user._id,
        platform,
        token: token || null,
        endpoint: endpoint || null,
        keys: keys || {},
        userAgent: req.headers["user-agent"] || "",
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return req.http.ok(device, "Device registered for push notifications");
  } catch (err) {
    next(err);
  }
};
