import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function ChatWindow({ conversation, appointment, doctorId, targetUser, onClose }) {
  const { user } = useAuth();
  const socketContext = useSocket();
  const socket = socketContext?.socket || socketContext;

  const [activeConv, setActiveConv] = useState(conversation || null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. Resolve participant identities
  const isDoctor = user?.role === "doctor";

  // Determine other participant
  const otherParticipant =
    activeConv?.otherParticipant ||
    activeConv?.participants?.find((p) => String(p._id || p) !== String(user?._id)) ||
    targetUser ||
    (isDoctor ? appointment?.patientId : appointment?.doctorId?.userId || appointment?.doctorId) ||
    null;

  const doctorProfile = activeConv?.doctorInfo || (otherParticipant?.role === "doctor" ? otherParticipant : null);

  const otherPersonName =
    otherParticipant?.name ||
    (isDoctor
      ? appointment?.patientId?.name || "Patient"
      : appointment?.doctorId?.userId?.name || appointment?.doctorId?.name || "Doctor");

  const otherPersonRole = otherParticipant?.role || (isDoctor ? "Patient" : "Doctor");

  // 2. Initialize Conversation (Open access or appointment-backed)
  useEffect(() => {
    let isMounted = true;

    const initChat = async () => {
      setLoading(true);
      try {
        let conv = activeConv;

        // If no conversation object provided yet, find or create one via backend
        if (!conv?._id) {
          const payload = {};
          if (doctorId) payload.doctorId = doctorId;
          else if (otherParticipant?._id) payload.targetUserId = otherParticipant._id;
          else if (appointment?._id) {
            payload.appointmentId = appointment._id;
            payload.targetUserId = isDoctor
              ? appointment.patientId?._id || appointment.patientId
              : appointment.doctorId?.userId?._id || appointment.doctorId?.userId || appointment.doctorId?._id;
          }

          if (payload.doctorId || payload.targetUserId || payload.appointmentId) {
            const res = await API.post("/chat/conversations", payload);
            if (isMounted && res.data?.data) {
              conv = res.data.data;
              setActiveConv(conv);
            }
          }
        }

        const convId = conv?._id || appointment?._id;
        if (!convId) {
          if (isMounted) setLoading(false);
          return;
        }

        // Fetch persisted messages from database
        let msgs = [];
        try {
          if (conv?._id) {
            const res = await API.get(`/chat/conversations/${conv._id}/messages`);
            msgs = res.data?.data || [];
          } else if (appointment?._id) {
            const res = await API.get(`/chat/${appointment._id}`);
            msgs = res.data?.data || [];
          }
        } catch (fetchErr) {
          console.warn("Could not fetch messages:", fetchErr.message);
        }

        if (isMounted) {
          setMessages(msgs);
          setIsOtherOnline(conv?.isOnline || false);
          setLoading(false);
        }

        // Mark unread messages as read
        if (conv?._id) {
          API.patch(`/chat/conversations/${conv._id}/read`).catch(() => {});
          if (socket && typeof socket.emit === "function") {
            socket.emit("mark-read", { conversationId: conv._id, readerId: user?._id });
          }
        } else if (appointment?._id) {
          API.patch(`/chat/${appointment._id}/read`).catch(() => {});
          if (socket && typeof socket.emit === "function") {
            socket.emit("mark-read", { appointmentId: appointment._id, readerId: user?._id });
          }
        }
      } catch (err) {
        console.error("Chat initialization error:", err);
        if (isMounted) {
          toast.error("Could not load chat history.");
          setLoading(false);
        }
      }
    };

    initChat();

    return () => {
      isMounted = false;
    };
  }, [conversation?._id, appointment?._id, doctorId, otherParticipant?._id]);

  // 3. Socket Event Listeners with Bulletproof Cleanup
  useEffect(() => {
    const roomId = activeConv?._id || appointment?._id;
    if (!socket || !roomId || typeof socket.on !== "function") return;

    // Join room
    socket.emit("join-chat", roomId);

    // Handler: Incoming Message (Deduplicated with tempId replacement)
    const handleReceiveMessage = (payload) => {
      const incoming = payload.message || payload;
      const tempId = payload.tempId;

      // Verify message belongs to this conversation/appointment
      const matchesConv =
        (incoming.conversationId && String(incoming.conversationId) === String(roomId)) ||
        (incoming.appointmentId && String(incoming.appointmentId) === String(roomId)) ||
        (payload.conversationId && String(payload.conversationId) === String(roomId));

      if (!matchesConv) return;

      setMessages((prev) => {
        // Prevent duplicate if real _id already exists
        if (incoming._id && prev.some((m) => String(m._id) === String(incoming._id))) {
          return prev;
        }

        // If tempId matches optimistic message, replace it in place!
        if (tempId && prev.some((m) => m._id === tempId)) {
          return prev.map((m) => (m._id === tempId ? incoming : m));
        }

        return [...prev, incoming];
      });

      // If message is for current user, automatically mark as read
      const receiverId = incoming.receiverId?._id || incoming.receiverId;
      if (String(receiverId) === String(user?._id)) {
        if (activeConv?._id) {
          API.patch(`/chat/conversations/${activeConv._id}/read`).catch(() => {});
          socket.emit("mark-read", { conversationId: activeConv._id, readerId: user?._id });
        } else if (appointment?._id) {
          API.patch(`/chat/${appointment._id}/read`).catch(() => {});
          socket.emit("mark-read", { appointmentId: appointment._id, readerId: user?._id });
        }
      }
    };

    // Handler: Read Receipts
    const handleMessagesRead = ({ readerId }) => {
      if (String(readerId) !== String(user?._id)) {
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = m.senderId?._id || m.senderId;
            if (String(senderId) === String(user?._id)) {
              return { ...m, read: true, status: "read" };
            }
            return m;
          })
        );
      }
    };

    // Handler: Typing Indicator
    const handleUserTyping = ({ userId }) => {
      if (String(userId) !== String(user?._id)) {
        setIsOtherTyping(true);
      }
    };

    const handleUserStopTyping = ({ userId }) => {
      if (String(userId) !== String(user?._id)) {
        setIsOtherTyping(false);
      }
    };

    // Handler: Online / Offline status
    const handleUserStatus = ({ userId, status }) => {
      if (otherParticipant?._id && String(userId) === String(otherParticipant._id)) {
        setIsOtherOnline(status === "online");
      }
    };

    // Register socket listeners
    socket.on("receive-message", handleReceiveMessage);
    socket.on("messages-read", handleMessagesRead);
    socket.on("user-typing", handleUserTyping);
    socket.on("user-stop-typing", handleUserStopTyping);
    socket.on("user-status", handleUserStatus);

    // Cleanup: Unregister exact listeners to prevent duplicate triggers
    return () => {
      socket.emit("leave-chat", roomId);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("messages-read", handleMessagesRead);
      socket.off("user-typing", handleUserTyping);
      socket.off("user-stop-typing", handleUserStopTyping);
      socket.off("user-status", handleUserStatus);
    };
  }, [socket, activeConv?._id, appointment?._id, user?._id, otherParticipant?._id]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  // Handle typing debounce
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    const roomId = activeConv?._id || appointment?._id;
    if (!socket || !roomId || typeof socket.emit !== "function") return;

    socket.emit("typing", { roomId, userId: user?._id, userName: user?.name });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { roomId, userId: user?._id });
    }, 1500);
  };

  // 4. Send Message (Zero Duplication & Single Persistence)
  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const roomId = activeConv?._id || appointment?._id;
    const receiverId =
      otherParticipant?._id ||
      (isDoctor
        ? appointment?.patientId?._id || appointment?.patientId
        : appointment?.doctorId?.userId?._id || appointment?.doctorId?.userId);

    if (!receiverId) {
      toast.error("Unable to identify message recipient.");
      return;
    }

    setNewMessage("");

    // Generate unique temporary ID for optimistic UI
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const optimisticMsg = {
      _id: tempId,
      conversationId: activeConv?._id || null,
      appointmentId: appointment?._id || null,
      senderId: {
        _id: user?._id,
        name: user?.name,
        role: user?.role,
        profilePicture: user?.profilePicture,
      },
      receiverId,
      text: trimmed,
      read: false,
      status: "sending",
      createdAt: new Date().toISOString(),
    };

    // Optimistically append message to local UI
    setMessages((prev) => [...prev, optimisticMsg]);

    // Emit stop-typing
    if (socket && roomId && typeof socket.emit === "function") {
      socket.emit("stop-typing", { roomId, userId: user?._id });
    }

    try {
      // Primary: Send via Socket.io (persists to DB and broadcasts in one step)
      if (socket && typeof socket.emit === "function" && socket.connected) {
        socket.emit("send-message", {
          conversationId: activeConv?._id,
          appointmentId: appointment?._id,
          senderId: user?._id,
          receiverId,
          text: trimmed,
          tempId,
        });
      } else {
        // Fallback: Send via REST endpoint if socket is temporarily offline
        let res;
        if (activeConv?._id) {
          res = await API.post(`/chat/conversations/${activeConv._id}/messages`, {
            text: trimmed,
            tempId,
          });
        } else if (appointment?._id) {
          res = await API.post(`/chat/${appointment._id}`, {
            text: trimmed,
            receiverId,
          });
        }

        if (res?.data?.data) {
          const saved = res.data.data;
          setMessages((prev) => prev.map((m) => (m._id === tempId ? saved : m)));
        }
      }
    } catch (err) {
      console.warn("Message send error:", err);
      toast.error("Failed to deliver message.");
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[85vh] max-h-[720px] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
        {/* ── WhatsApp-Style Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white shadow-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with live status dot */}
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-lg text-white shadow-inner overflow-hidden">
                {otherParticipant?.profilePicture || doctorProfile?.image ? (
                  <img
                    src={otherParticipant?.profilePicture || doctorProfile?.image}
                    alt={otherPersonName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{otherPersonName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-primary-700 ${
                  isOtherOnline ? "bg-emerald-400" : "bg-slate-400"
                }`}
                title={isOtherOnline ? "Online" : "Offline"}
              />
            </div>

            {/* Name, Specialty & Status */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm truncate text-white">
                  {otherPersonRole === "doctor" ? `Dr. ${otherPersonName}` : otherPersonName}
                </h3>
                {doctorProfile?.isAvailable !== undefined && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      doctorProfile.isAvailable
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                        : "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                    }`}
                  >
                    {doctorProfile.isAvailable ? "Available" : "Busy"}
                  </span>
                )}
              </div>

              <p className="text-xs text-primary-100/90 truncate flex items-center gap-1.5">
                {isOtherTyping ? (
                  <span className="text-emerald-200 font-bold animate-pulse flex items-center gap-1">
                    <span>typing...</span>
                  </span>
                ) : (
                  <span>
                    {isOtherOnline ? "Online" : "Offline"}
                    {doctorProfile?.specialization ? ` &bull; ${doctorProfile.specialization}` : ""}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm transition"
          >
            ✕
          </button>
        </div>

        {/* ── Chat Messages Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#efeae2]/30 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
              <span className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400 space-y-2">
              <span className="text-4xl">💬</span>
              <p className="text-sm font-bold text-slate-600">Start of conversation</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Send a message to begin consulting with{" "}
                <span className="font-semibold text-slate-600">
                  {otherPersonRole === "doctor" ? `Dr. ${otherPersonName}` : otherPersonName}
                </span>
                .
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine =
                String(msg.senderId?._id || msg.senderId) === String(user?._id);

              const timeStr = msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <div
                  key={msg._id || idx}
                  className={`flex items-end gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 shadow-sm text-sm relative break-words ${
                      isMine
                        ? "bg-primary-600 text-white rounded-br-none"
                        : "bg-white text-slate-800 rounded-bl-none border border-slate-200/80"
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMine ? "text-primary-100" : "text-slate-400"
                      }`}
                    >
                      <span>{timeStr}</span>

                      {/* WhatsApp-Style Read Receipts */}
                      {isMine && (
                        <span className="ml-0.5" title={msg.read ? "Read" : "Delivered"}>
                          {msg.status === "sending" ? (
                            <span className="text-[9px] opacity-75">⏱</span>
                          ) : msg.read || msg.status === "read" ? (
                            <span className="text-sky-300 font-black">✓✓</span>
                          ) : (
                            <span className="opacity-80">✓✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator bubble */}
          {isOtherTyping && (
            <div className="flex items-center gap-2 text-slate-500 text-xs bg-white rounded-2xl px-3.5 py-2 w-fit shadow-sm border border-slate-200/70 animate-pulse">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
              </span>
              <span>{otherPersonName} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Message Input Bar ── */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder={`Message ${otherPersonRole === "doctor" ? `Dr. ${otherPersonName}` : otherPersonName}...`}
            className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition"
          />

          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-10 h-10 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 text-white flex items-center justify-center transition shadow-md active:scale-95 disabled:scale-100 flex-shrink-0"
            title="Send Message"
          >
            <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
