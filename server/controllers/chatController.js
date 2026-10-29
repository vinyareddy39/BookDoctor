import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { getIO, getOnlineUserIds, isUserOnline } from "../socket.js";
import { dispatchNotification, EVENT_TYPES } from "../services/centralNotificationService.js";

// Red-flag keyword regex for life-threatening symptoms
export const RED_FLAG_REGEX = /\b(chest\s+pain|cannot\s+breathe|hard\s+to\s+breathe|trouble\s+breathing|shortness\s+of\s+breath|loss\s+of\s+consciousness|unconscious|fainted|stroke|slurred\s+speech|face\s+droop|bleeding\s+heavily|heavy\s+bleeding|suicid\w*|severe\s+allergic|anaphylax\w*)\b/gi;

/**
 * Check if a patient and doctor have an active or recent appointment together (past 30 days or upcoming)
 */
export const checkDoctorPatientRelationship = async (patientUserId, doctorUserId) => {
  const doctor = await Doctor.findOne({ userId: doctorUserId });
  if (!doctor) return true; // not a doctor role or doc record missing

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const appt = await Appointment.findOne({
    patientId: patientUserId,
    doctorId: doctor._id,
    $or: [
      { appointmentDate: { $gte: thirtyDaysAgo } },
      { status: { $in: ["pending", "confirmed", "waiting", "called", "in_consultation"] } },
    ],
  });

  return Boolean(appt);
};

// ── GET all conversations for current user (Inbox View) ──────────────────────
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "name email role profilePicture")
      .populate("appointmentId", "appointmentDate timeSlot status")
      .sort({ lastMessageTimestamp: -1 })
      .lean();

    // Attach doctor profile details (specialization, availability, image) if a doctor is participant
    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant = conv.participants.find(
          (p) => String(p._id) !== String(userId)
        );

        let doctorInfo = null;
        if (otherParticipant?.role === "doctor") {
          const doc = await Doctor.findOne({ userId: otherParticipant._id })
            .select("specialization isAvailable image consultationFee experience clinicName")
            .lean();
          if (doc) doctorInfo = doc;
        }

        const unreadForMe = conv.unreadCount?.[String(userId)] || 0;

        return {
          ...conv,
          otherParticipant: otherParticipant || null,
          doctorInfo: doctorInfo || null,
          isOnline: otherParticipant ? isUserOnline(otherParticipant._id) : false,
          unreadCount: unreadForMe,
        };
      })
    );

    return req.http.ok(formatted, "Conversations retrieved.");
  } catch (err) {
    next(err);
  }
};

// ── POST create or get conversation (1-to-1 Guarded by Appointment Relationship) ──
export const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { targetUserId, doctorId, appointmentId, force = false } = req.body;

    // If doctorId is provided (Doctor model _id), resolve to doctor's User _id
    if (doctorId && !targetUserId) {
      const doc = await Doctor.findById(doctorId);
      if (doc?.userId) {
        targetUserId = doc.userId;
      }
    }

    if (!targetUserId) {
      return req.http.badRequest("Target user or doctor is required.");
    }

    if (String(userId) === String(targetUserId)) {
      return req.http.badRequest("Cannot start a conversation with yourself.");
    }

    // 1-to-1 Relationship Guard:
    // Patient can only message a doctor if they have an active or recent appointment together
    if (req.user.role === "patient" && !force) {
      const targetUser = await User.findById(targetUserId);
      if (targetUser?.role === "doctor") {
        const hasRelationship = await checkDoctorPatientRelationship(userId, targetUserId);
        if (!hasRelationship) {
          return req.http.forbidden("You can only message doctors you have an active or recent appointment with.");
        }
      }
    }

    // Find existing conversation between these two participants
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, targetUserId] },
    })
      .populate("participants", "name email role profilePicture")
      .populate("appointmentId", "appointmentDate timeSlot status");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId, targetUserId],
        appointmentId: appointmentId || undefined,
        unreadCount: {},
      });
      conversation = await conversation.populate(
        "participants",
        "name email role profilePicture"
      );
    }

    let doctorInfo = null;
    const otherParticipant = conversation.participants.find(
      (p) => String(p._id) !== String(userId)
    );
    if (otherParticipant?.role === "doctor") {
      doctorInfo = await Doctor.findOne({ userId: otherParticipant._id })
        .select("specialization isAvailable image consultationFee experience clinicName")
        .lean();
    }

    const isMuted = conversation.mutedBy?.some((m) => String(m) === String(userId)) || false;
    const isArchived = conversation.archivedBy?.some((a) => String(a) === String(userId)) || false;

    const result = {
      ...conversation.toObject(),
      otherParticipant,
      doctorInfo,
      doctorStatus: conversation.doctorStatus || "available",
      isMuted,
      isArchived,
      isOnline: otherParticipant ? isUserOnline(otherParticipant._id) : false,
      unreadCount: conversation.unreadCount?.get(String(userId)) || 0,
    };

    return req.http.ok(result, "Conversation ready.");
  } catch (err) {
    next(err);
  }
};

// ── GET messages for a conversation ──────────────────────────────────────────
export const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return req.http.notFound("Conversation not found.");
    }

    // Security check: Must be a participant
    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(userId)
    );
    if (!isParticipant) {
      return req.http.forbidden("Access denied: You are not a participant in this conversation.");
    }

    const messages = await Message.find({ conversationId })
      .populate("senderId", "name role profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    return req.http.ok(messages, "Messages retrieved.");
  } catch (err) {
    next(err);
  }
};

// ── POST send message (Real-time with Red-Flag Scan & Attachments) ───────────
export const sendConversationMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { text = "", tempId, attachments = [], messageType = "text" } = req.body;
    const userId = req.user._id;

    if (!text?.trim() && (!attachments || attachments.length === 0)) {
      return req.http.badRequest("Message must contain text or attachments.");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return req.http.notFound("Conversation not found.");
    }

    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(userId)
    );
    if (!isParticipant) {
      return req.http.forbidden("Access denied: You are not a participant in this conversation.");
    }

    const receiverId = conversation.participants.find(
      (p) => String(p) !== String(userId)
    );

    // Red-flag keyword scan
    const matches = (text || "").match(RED_FLAG_REGEX);
    let hasRedFlag = false;
    let redFlagKeywords = [];
    let emergencyAlert = null;

    if (matches && matches.length > 0) {
      hasRedFlag = true;
      redFlagKeywords = Array.from(new Set(matches.map((m) => m.toLowerCase().trim())));
      conversation.hasActiveEmergencyAlert = true;
      emergencyAlert = {
        warning: "⚠️ This sounds like an emergency. BookDoctor chat is not for life-threatening situations. In an emergency call 108 / 112 immediately.",
        emergencyContacts: [
          { label: "Call Ambulance 108", tel: "108" },
          { label: "Emergency 112", tel: "112" },
        ],
        triggerSOS: true,
      };
    }

    // Attachment validation (max 5 MB)
    const validAttachments = (attachments || []).map((att) => ({
      url: att.url,
      fileType: att.fileType || "image",
      originalName: att.originalName || "attachment",
      sizeBytes: Math.min(Number(att.sizeBytes) || 0, 5 * 1024 * 1024),
    }));

    const message = await Message.create({
      conversationId,
      senderId: userId,
      receiverId,
      text: text.trim(),
      attachments: validAttachments,
      hasRedFlag,
      redFlagKeywords,
      redFlagSeverity: hasRedFlag ? "critical" : "none",
      messageType: validAttachments.length > 0 ? (validAttachments[0].fileType === "application/pdf" ? "document" : "image") : messageType,
      read: false,
      status: "sent",
    });

    // Update conversation
    conversation.lastMessage = {
      text: text.trim() || (validAttachments.length > 0 ? `[Attachment]` : ""),
      senderId: userId,
      timestamp: message.createdAt,
      status: "sent",
    };
    conversation.lastMessageTimestamp = message.createdAt;

    const recIdStr = String(receiverId);
    const currUnread = conversation.unreadCount.get(recIdStr) || 0;
    conversation.unreadCount.set(recIdStr, currUnread + 1);
    await conversation.save();

    const populated = await message.populate("senderId", "name role profilePicture");

    // Check if recipient has muted this thread
    const isMuted = conversation.mutedBy?.some((m) => String(m) === String(receiverId));

    // Broadcast via socket to room
    try {
      const io = getIO();
      io.to(`chat-${conversationId}`).emit("receive-message", {
        message: populated,
        tempId: tempId || null,
        conversationId,
        emergencyAlert,
      });

      const convSummary = {
        conversationId,
        lastMessage: conversation.lastMessage,
        lastMessageTimestamp: conversation.lastMessageTimestamp,
        unreadCount: conversation.unreadCount,
        hasActiveEmergencyAlert: conversation.hasActiveEmergencyAlert,
      };
      io.to(`user-${receiverId}`).emit("conversation-updated", convSummary);
      io.to(`user-${userId}`).emit("conversation-updated", convSummary);
    } catch (socketErr) {
      console.warn("Socket broadcast error:", socketErr.message);
    }

    // External / Central notification dispatch if not muted
    if (!isMuted && receiverId) {
      if (hasRedFlag) {
        await dispatchNotification({
          userId: receiverId,
          eventType: EVENT_TYPES.SYMPTOM_RED_FLAG,
          title: "⚠️ Emergency Keyword Detected in Chat",
          message: `Patient ${req.user.name || "Patient"} mentioned "${redFlagKeywords.join(", ")}" in chat. Immediate review suggested.`,
          channels: ["in_app", "sms", "email"],
          data: {
            entityType: "chat",
            entityId: conversationId,
            deepLink: "/messages",
            metadata: {
              patientName: req.user.name || "Patient",
              alertReason: `Chat message flagged for ${redFlagKeywords.join(", ")}`,
            },
          },
        });
      } else {
        await dispatchNotification({
          userId: receiverId,
          eventType: EVENT_TYPES.CHAT_MESSAGE_RECEIVED,
          title: "New Message",
          message: `New message from ${req.user.name || "User"}`,
          channels: ["in_app", "email"],
          data: {
            entityType: "chat",
            entityId: conversationId,
            deepLink: "/messages",
            metadata: {
              senderName: req.user.name || "User",
              snippet: text.length > 50 ? text.substring(0, 50) + "..." : text,
            },
          },
        });
      }
    }

    // Auto-reply when doctor is away or in consultation
    let autoReplyMessage = null;
    const receiverUser = await User.findById(receiverId);
    if (
      req.user.role === "patient" &&
      receiverUser?.role === "doctor" &&
      (conversation.doctorStatus === "away" || conversation.doctorStatus === "in_consultation")
    ) {
      const statusText = conversation.doctorStatus === "away" ? "currently away" : "currently in consultation";
      const autoReplyText = `Dr. ${receiverUser.name} is ${statusText}. For urgent medical concerns, please call 108 or 112.`;

      const autoReplyDoc = await Message.create({
        conversationId,
        senderId: receiverId,
        receiverId: userId,
        text: autoReplyText,
        messageType: "system_alert",
        read: false,
        status: "sent",
      });

      autoReplyMessage = await autoReplyDoc.populate("senderId", "name role profilePicture");
      try {
        const io = getIO();
        io.to(`chat-${conversationId}`).emit("receive-message", {
          message: autoReplyMessage,
          conversationId,
        });
      } catch (e) {
        console.warn("Auto-reply socket failed:", e.message);
      }
    }

    return req.http.created(
      {
        message: populated,
        emergencyAlert,
        autoReply: autoReplyMessage,
      },
      "Message sent."
    );
  } catch (err) {
    next(err);
  }
};

// ── PATCH doctor status on conversation ("available", "in_consultation", "away")
export const updateDoctorStatus = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    if (!["available", "in_consultation", "away"].includes(status)) {
      return req.http.badRequest("Invalid status. Must be available, in_consultation, or away.");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return req.http.notFound("Conversation not found.");

    conversation.doctorStatus = status;
    await conversation.save();

    return req.http.ok({ doctorStatus: status }, "Doctor status updated.");
  } catch (err) {
    next(err);
  }
};

// ── PATCH toggle mute conversation ──────────────────────────────────────────
export const toggleMuteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return req.http.notFound("Conversation not found.");

    if (!Array.isArray(conversation.mutedBy)) conversation.mutedBy = [];
    const index = conversation.mutedBy.findIndex((id) => String(id) === String(userId));
    let isMuted = false;

    if (index > -1) {
      conversation.mutedBy.splice(index, 1);
    } else {
      conversation.mutedBy.push(userId);
      isMuted = true;
    }

    await conversation.save();
    return req.http.ok({ isMuted }, isMuted ? "Conversation muted." : "Conversation unmuted.");
  } catch (err) {
    next(err);
  }
};

// ── PATCH toggle archive conversation ───────────────────────────────────────
export const toggleArchiveConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return req.http.notFound("Conversation not found.");

    if (!Array.isArray(conversation.archivedBy)) conversation.archivedBy = [];
    const index = conversation.archivedBy.findIndex((id) => String(id) === String(userId));
    let isArchived = false;

    if (index > -1) {
      conversation.archivedBy.splice(index, 1);
    } else {
      conversation.archivedBy.push(userId);
      isArchived = true;
    }

    await conversation.save();
    return req.http.ok({ isArchived }, isArchived ? "Conversation archived." : "Conversation unarchived.");
  } catch (err) {
    next(err);
  }
};

// ── PATCH mark conversation messages as read ────────────────────────────────
export const markConversationRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      { conversationId, receiverId: userId, read: false },
      { $set: { read: true, status: "read" } }
    );

    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      conversation.unreadCount.set(String(userId), 0);
      if (conversation.lastMessage && String(conversation.lastMessage.senderId) !== String(userId)) {
        conversation.lastMessage.status = "read";
      }
      await conversation.save();
    }

    try {
      const io = getIO();
      io.to(`chat-${conversationId}`).emit("messages-read", {
        conversationId,
        readerId: userId,
      });
      io.to(`user-${userId}`).emit("conversation-updated", {
        conversationId,
        unreadCount: conversation?.unreadCount,
      });
    } catch (socketErr) {
      console.warn("Socket read broadcast error:", socketErr.message);
    }

    return req.http.ok(null, "Messages marked as read.");
  } catch (err) {
    next(err);
  }
};

// ── GET list of currently online user IDs ────────────────────────────────────
export const getOnlineUsers = (req, res) => {
  const onlineIds = getOnlineUserIds();
  return req.http.ok(onlineIds, "Online users retrieved.");
};

// ── Legacy / Backward Compatibility Handlers ─────────────────────────────────
export const getUnreadCounts = async (req, res, next) => {
  try {
    const unreadMsgs = await Message.aggregate([
      { $match: { receiverId: req.user._id, read: false } },
      { $group: { _id: "$appointmentId", count: { $sum: 1 } } },
    ]);
    const counts = {};
    unreadMsgs.forEach((item) => {
      if (item._id) counts[item._id] = item.count;
    });
    return req.http.ok(counts);
  } catch (err) {
    next(err);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const messages = await Message.find({ appointmentId })
      .populate("senderId", "name role profilePicture")
      .sort({ createdAt: 1 });
    return req.http.ok(messages, "Messages retrieved.");
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { text, receiverId } = req.body;

    const message = await Message.create({
      appointmentId,
      senderId: req.user._id,
      receiverId,
      text: text?.trim(),
    });
    const populated = await message.populate("senderId", "name role profilePicture");

    try {
      const io = getIO();
      io.to(`chat-${appointmentId}`).emit("receive-message", {
        message: populated,
        appointmentId,
      });
    } catch (err) {}

    return req.http.created(populated, "Message sent.");
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    await Message.updateMany(
      { appointmentId, receiverId: req.user._id, read: false },
      { $set: { read: true, status: "read" } }
    );
    try {
      const io = getIO();
      io.to(`chat-${appointmentId}`).emit("messages-read", {
        appointmentId,
        readerId: req.user._id,
      });
    } catch (err) {}
    return req.http.ok(null, "Messages marked as read.");
  } catch (err) {
    next(err);
  }
};
