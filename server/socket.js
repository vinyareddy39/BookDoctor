import { Server } from "socket.io";
import Message from "./models/Message.js";

let io;
// Map to keep track of connected users: { userId: socketId }
const userSockets = new Map();

export const initSocket = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // console.log("A user connected:", socket.id);

    // Client should emit 'register' with their userId immediately after connecting
    socket.on("register", (userId) => {
      if (userId) {
        userSockets.set(userId, socket.id);
      }
    });

    // ── In-App Chat Rooms ───────────────────────────────────────────────────
    // Join a shared chat room scoped to an appointment
    socket.on("join-chat", (appointmentId) => {
      socket.join(`chat-${appointmentId}`);
    });

    socket.on("leave-chat", (appointmentId) => {
      socket.leave(`chat-${appointmentId}`);
    });

    // When user sends a message, persist it then broadcast to room
    socket.on("send-message", async (payload) => {
      // payload: { appointmentId, senderId, senderName, receiverId, text }
      try {
        const msg = await Message.create({
          appointmentId: payload.appointmentId,
          senderId:      payload.senderId,
          receiverId:    payload.receiverId,
          text:          payload.text,
        });

        const response = {
          _id:           msg._id,
          appointmentId: payload.appointmentId,
          senderId:      { _id: payload.senderId, name: payload.senderName },
          text:          payload.text,
          createdAt:     msg.createdAt,
        };

        // Broadcast to all sockets in the appointment chat room
        io.to(`chat-${payload.appointmentId}`).emit("receive-message", response);

      } catch (err) {
        console.error("Socket send-message error:", err.message);
        socket.emit("chat-error", { message: "Failed to send message." });
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

/**
 * Send a targeted notification to a specific user
 * @param {string} userId - The target user's ID
 * @param {object} messagePayload - The notification data
 */
export const sendNotificationToUser = (userId, messagePayload) => {
  if (!io) return;
  const socketId = userSockets.get(String(userId));
  if (socketId) {
    io.to(socketId).emit("notification", messagePayload);
  }
};

export const triggerDashboardUpdate = (userId, message) => {
  if (!io) return;
  const socketId = userSockets.get(String(userId));
  if (socketId) {
    io.to(socketId).emit("DASHBOARD_UPDATE", { message });
  }
};
