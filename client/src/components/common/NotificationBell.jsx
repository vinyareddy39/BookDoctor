import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import io from "socket.io-client";
import toast from "react-hot-toast";

export default function NotificationBell() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await API.get("/notifications?limit=20");
      setNotifications(res.data?.data?.notifications || []);
      setUnreadCount(res.data?.data?.unreadCount || 0);
    } catch (err) {
      console.warn("Could not fetch notifications:", err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [isLoggedIn]);

  // Real-time socket listener for incoming notifications
  useEffect(() => {
    if (!isLoggedIn || !user?._id) return;

    const socketUrl = import.meta.env.VITE_API_URL?.replace("/api", "") || window.location.origin;
    const socket = io(socketUrl, { withCredentials: true });

    socket.emit("register", user._id);

    socket.on("notification", (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((c) => c + 1);
      toast(newNotif.title || "New Notification", {
        icon: "🔔",
        duration: 4000,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isLoggedIn, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark single as read
  const handleMarkAsRead = async (notif) => {
    try {
      if (!notif.isRead) {
        await API.patch(`/notifications/${notif._id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setIsOpen(false);
      if (notif.link) {
        navigate(notif.link);
      }
    } catch (err) {
      console.warn("Mark read error:", err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await API.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "lab_result_released":
        return "🧪";
      case "invoice_issued":
      case "payment_received":
        return "💳";
      case "appointment_booked":
      case "appointment_reminder":
        return "🗓️";
      case "queue_called":
        return "⚡";
      case "follow_up_due":
        return "📋";
      default:
        return "🔔";
    }
  };

  if (!isLoggedIn) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[9px] font-black items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-800">Notifications</h4>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <span className="text-2xl block mb-1">🔕</span>
                <p className="text-xs font-semibold">No notifications right now</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleMarkAsRead(n)}
                  className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start ${
                    !n.isRead ? "bg-primary-50/30" : ""
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{getTypeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs ${!n.isRead ? "font-black text-slate-900" : "font-semibold text-slate-700"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
