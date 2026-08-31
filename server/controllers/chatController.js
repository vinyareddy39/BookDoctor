import Message from "../models/Message.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import { getIO } from "../socket.js";

// GET unread counts for all chats
export const getUnreadCounts = async (req, res, next) => {
  try {
    const unreadMsgs = await Message.aggregate([
      { $match: { receiverId: req.user._id, read: false } },
      { $group: { _id: "$appointmentId", count: { $sum: 1 } } }
    ]);
    const counts = {};
    unreadMsgs.forEach(item => {
      counts[item._id] = item.count;
    });
    return req.http.ok(counts);
  } catch (err) {
    next(err);
  }
};

// GET messages for an appointment
export const getMessages = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return req.http.notFound("Appointment not found.");

    // Authorization: must be patient or doctor of this appointment
    const userId = String(req.user._id);
    const isPatient = String(appointment.patientId) === userId;

    let isDoctor = false;
    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      isDoctor = doc && String(appointment.doctorId) === String(doc._id);
    }

    if (!isPatient && !isDoctor) {
      return req.http.forbidden("Privacy Lock: Only the Doctor and Patient can view this chat.");
    }

    const messages = await Message.find({ appointmentId })
      .populate("senderId", "name role profilePicture")
      .sort({ createdAt: 1 });

    return req.http.ok(messages, "Messages retrieved.");
  } catch (err) {
    next(err);
  }
};

// POST a message (REST fallback — Socket.io is preferred)
export const sendMessage = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { text, receiverId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return req.http.notFound("Appointment not found.");

    // Authorization check
    const userId = String(req.user._id);
    const isPatient = String(appointment.patientId) === userId;
    
    let isDoctor = false;
    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      isDoctor = doc && String(appointment.doctorId) === String(doc._id);
    }

    if (!isPatient && !isDoctor) {
      return req.http.forbidden("Privacy Lock: Only the Doctor and Patient can send messages in this chat.");
    }

    // Determine receiverId automatically based on role
    let resolvedReceiverId = receiverId;
    if (!resolvedReceiverId) {
      if (isPatient) {
        const doc = await Doctor.findById(appointment.doctorId);
        resolvedReceiverId = doc.userId;
      } else {
        resolvedReceiverId = appointment.patientId;
      }
    }

    const message = await Message.create({
      appointmentId,
      senderId: req.user._id,
      receiverId: resolvedReceiverId,
      text,
    });

    const populated = await message.populate("senderId", "name role profilePicture");

    // Emit to socket room for real-time update (Privacy: only sent to users in the room)
    try {
      const io = getIO();
      io.to(`chat-${appointmentId}`).emit("receive-message", populated);
    } catch (socketErr) {
      console.warn("Socket emission failed:", socketErr.message);
    }

    return req.http.created(populated, "Message sent.");
  } catch (err) {
    next(err);
  }
};

// PATCH mark messages as read
export const markAsRead = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    // Update all messages in this appointment where the receiver is the current user and read is false
    await Message.updateMany(
      { appointmentId, receiverId: req.user._id, read: false },
      { $set: { read: true } }
    );

    // Notify the other user via socket that messages were read
    try {
      const io = getIO();
      io.to(`chat-${appointmentId}`).emit("messages-read", { appointmentId, readerId: req.user._id });
    } catch (socketErr) {
      console.warn("Socket emission failed:", socketErr.message);
    }

    return req.http.ok(null, "Messages marked as read.");
  } catch (err) {
    next(err);
  }
};
