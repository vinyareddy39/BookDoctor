import { Server } from "socket.io";

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
        // console.log(`User ${userId} registered with socket ${socket.id}`);
      }
    });

    socket.on("disconnect", () => {
      // Remove socket from the map on disconnect
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          // console.log(`User ${userId} disconnected`);
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
