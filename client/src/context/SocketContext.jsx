import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, isLoggedIn } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Only connect if the user is logged in
    if (isLoggedIn && user?._id) {
      // Connect to the backend server
      let apiUrl = import.meta.env.VITE_API_URL || "https://bookdoctor-9ns2.onrender.com";
      if (!apiUrl.startsWith("http")) {
        apiUrl = "https://bookdoctor-9ns2.onrender.com";
      }
      const socketUrl = apiUrl.replace(/\/api\/?$/, "");
      const newSocket = io(socketUrl, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      setSocket(newSocket);

      // Once connected, register the user ID so the backend knows who this socket belongs to
      newSocket.on("connect", () => {
        newSocket.emit("register", user._id);
      });

      // Listen for notifications
      newSocket.on("notification", (payload) => {
        toast(
          () => (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-800">{payload.title}</span>
              <span className="text-sm text-slate-500">{payload.message}</span>
            </div>
          ),
          {
            icon: payload.type === "CANCEL_APPOINTMENT" ? "⚠️" : "🔔",
            duration: 6000,
          }
        );
      });

      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [isLoggedIn, user?._id]);

  // Context value supports both `const socket = useSocket()` and `const { socket } = useSocket()`
  const value = {
    socket,
    emit: (...args) => (socket && typeof socket.emit === "function" ? socket.emit(...args) : undefined),
    on: (...args) => (socket && typeof socket.on === "function" ? socket.on(...args) : undefined),
    off: (...args) => (socket && typeof socket.off === "function" ? socket.off(...args) : undefined),
    connected: !!socket?.connected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
