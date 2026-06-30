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
      const socketUrl = import.meta.env.VITE_API_URL.replace("/api", ""); // fallback to root URL
      const newSocket = io(socketUrl, {
        withCredentials: true,
      });

      setSocket(newSocket);

      // Once connected, register the user ID so the backend knows who this socket belongs to
      newSocket.on("connect", () => {
        newSocket.emit("register", user._id);
      });

      // Listen for notifications
      newSocket.on("notification", (payload) => {
        // Display a toast using react-hot-toast
        toast(
          (t) => (
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
    }
  }, [isLoggedIn, user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
