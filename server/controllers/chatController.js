import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { getIO, getOnlineUserIds, isUserOnline } from "../socket.js";

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

// ── POST create or get conversation (Open Access - Not Tied to Booking) ───────
export const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { targetUserId, doctorId, appointmentId } = req.body;

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

    const result = {
      ...conversation.toObject(),
      otherParticipant,
      doctorInfo,
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

// ── POST send message (REST fallback) ─────────────────────────────────────────
export const sendConversationMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { text, tempId } = req.body;
    const userId = req.user._id;

    if (!text?.trim()) {
      return req.http.badRequest("Message text cannot be empty.");
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

    const message = await Message.create({
      conversationId,
      senderId: userId,
      receiverId,
      text: text.trim(),
      read: false,
      status: "sent",
    });

    // Update conversation
    conversation.lastMessage = {
      text: text.trim(),
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

    // Broadcast via socket to room
    try {
      const io = getIO();
      io.to(`chat-${conversationId}`).emit("receive-message", {
        message: populated,
        tempId: tempId || null,
        conversationId,
      });

      const convSummary = {
        conversationId,
        lastMessage: conversation.lastMessage,
        lastMessageTimestamp: conversation.lastMessageTimestamp,
        unreadCount: conversation.unreadCount,
      };
      io.to(`user-${receiverId}`).emit("conversation-updated", convSummary);
      io.to(`user-${userId}`).emit("conversation-updated", convSummary);
    } catch (socketErr) {
      console.warn("Socket broadcast error:", socketErr.message);
    }

    return req.http.created(populated, "Message sent.");
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
