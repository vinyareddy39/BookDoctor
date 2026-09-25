import { Server } from "socket.io";
import Message from "./models/Message.js";
import Conversation from "./models/Conversation.js";

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
    // ── User Registration & Online Status ────────────────────────────────────
    socket.on("register", (userId) => {
      if (userId) {
        const uid = String(userId);
        userSockets.set(uid, socket.id);
        socket.userId = uid;
        socket.join(`user-${uid}`);

        // Broadcast to all clients that this user is now online
        io.emit("user-status", { userId: uid, status: "online" });

        // Send current list of online users to the newly connected client
        socket.emit("online-users", Array.from(userSockets.keys()));
      }
    });

    // ── In-App Chat Rooms ───────────────────────────────────────────────────
    socket.on("join-chat", (roomId) => {
      if (roomId) {
        socket.join(`chat-${roomId}`);
      }
    });

    socket.on("leave-chat", (roomId) => {
      if (roomId) {
        socket.leave(`chat-${roomId}`);
      }
    });

    // ── Typing Indicators ───────────────────────────────────────────────────
    socket.on("typing", ({ roomId, userId, userName }) => {
      if (roomId) {
        socket.to(`chat-${roomId}`).emit("user-typing", { roomId, userId, userName });
      }
    });

    socket.on("stop-typing", ({ roomId, userId }) => {
      if (roomId) {
        socket.to(`chat-${roomId}`).emit("user-stop-typing", { roomId, userId });
      }
    });

    // ── Send Message via Socket (Persists to MongoDB & Broadcasts) ───────────
    socket.on("send-message", async (payload) => {
      // payload: { conversationId, appointmentId, senderId, receiverId, text, tempId }
      try {
        const { conversationId, appointmentId, senderId, receiverId, text, tempId } = payload;
        if (!senderId || !receiverId || !text?.trim()) return;

        let convId = conversationId;

        // If no conversationId provided, find or create one between sender and receiver
        if (!convId) {
          let conv = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] },
          });

          if (!conv) {
            conv = await Conversation.create({
              participants: [senderId, receiverId],
              appointmentId: appointmentId || undefined,
            });
          }
          convId = conv._id;
        }

        // 1. Create message in DB
        const msg = await Message.create({
          conversationId: convId,
          appointmentId: appointmentId || undefined,
          senderId,
          receiverId,
          text: text.trim(),
          read: false,
          status: "sent",
        });

        // 2. Update Conversation last message and increment unread count for receiver
        const conv = await Conversation.findById(convId);
        if (conv) {
          conv.lastMessage = {
            text: text.trim(),
            senderId,
            timestamp: msg.createdAt,
            status: "sent",
          };
          conv.lastMessageTimestamp = msg.createdAt;

          const recIdStr = String(receiverId);
          const currentUnread = conv.unreadCount.get(recIdStr) || 0;
          conv.unreadCount.set(recIdStr, currentUnread + 1);
          await conv.save();
        }

        const populatedMsg = await msg.populate("senderId", "name role profilePicture");

        const responsePayload = {
          message: populatedMsg,
          tempId: tempId || null,
          conversationId: convId,
          appointmentId: appointmentId || null,
        };

        // Broadcast to chat room(s)
        io.to(`chat-${convId}`).emit("receive-message", responsePayload);
        if (appointmentId && String(appointmentId) !== String(convId)) {
          io.to(`chat-${appointmentId}`).emit("receive-message", responsePayload);
        }

        // Also notify user personal rooms so conversation lists re-sort in real time
        const convSummary = {
          conversationId: convId,
          lastMessage: conv?.lastMessage,
          lastMessageTimestamp: conv?.lastMessageTimestamp,
          unreadCount: conv?.unreadCount,
        };
        io.to(`user-${receiverId}`).emit("conversation-updated", convSummary);
        io.to(`user-${senderId}`).emit("conversation-updated", convSummary);

      } catch (err) {
        console.error("Socket send-message error:", err.message);
        socket.emit("chat-error", { message: "Failed to send message: " + err.message });
      }
    });

    // ── Mark Messages as Read ───────────────────────────────────────────────
    socket.on("mark-read", async ({ conversationId, appointmentId, readerId }) => {
      try {
        if (!readerId) return;

        const query = { receiverId: readerId, read: false };
        if (conversationId) query.conversationId = conversationId;
        else if (appointmentId) query.appointmentId = appointmentId;

        await Message.updateMany(query, { $set: { read: true, status: "read" } });

        if (conversationId) {
          const conv = await Conversation.findById(conversationId);
          if (conv) {
            conv.unreadCount.set(String(readerId), 0);
            if (conv.lastMessage && String(conv.lastMessage.senderId) !== String(readerId)) {
              conv.lastMessage.status = "read";
            }
            await conv.save();
          }
          io.to(`chat-${conversationId}`).emit("messages-read", {
            conversationId,
            readerId,
          });
          io.to(`user-${readerId}`).emit("conversation-updated", {
            conversationId,
            unreadCount: conv?.unreadCount,
          });
        }

        if (appointmentId) {
          io.to(`chat-${appointmentId}`).emit("messages-read", {
            appointmentId,
            readerId,
          });
        }
      } catch (err) {
        console.error("Socket mark-read error:", err.message);
      }
    });

    // ── Disconnect & Offline Broadcast ──────────────────────────────────────
    socket.on("disconnect", () => {
      if (socket.userId) {
        userSockets.delete(socket.userId);
        io.emit("user-status", { userId: socket.userId, status: "offline" });
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

export const isUserOnline = (userId) => {
  return userSockets.has(String(userId));
};

export const getOnlineUserIds = () => {
  return Array.from(userSockets.keys());
};

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
    io.to(socketId).emit("dashboard-update", { message });
  }
};
