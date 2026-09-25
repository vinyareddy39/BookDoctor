import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import API from "../services/api";
import ChatWindow from "../components/chat/ChatWindow";
import toast from "react-hot-toast";

export default function Messages() {
  const { user, isDoctor } = useAuth();
  const socketContext = useSocket();
  const socket = socketContext?.socket || socketContext;
  const location = useLocation();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(null);

  // New Chat Modal State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [doctorsList, setDoctorsList] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");

  /**
   * 1. Fetch Conversations from backend
   */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await API.get("/chat/conversations");
      const list = res.data?.data || [];
      setConversations(list);
    } catch (err) {
      console.warn("Could not load conversations:", err);
      // Fallback: try loading legacy appointments if conversations is empty
      try {
        const apptRes = await API.get("/appointments");
        const appts = apptRes.data?.data || [];
        setConversations(
          appts.map((a) => ({
            _id: a._id,
            appointmentId: a,
            otherParticipant: isDoctor ? a.patientId : a.doctorId?.userId || a.doctorId,
            doctorInfo: a.doctorId,
            lastMessage: { text: "Click to start consultation chat" },
            lastMessageTimestamp: a.updatedAt || a.createdAt,
            unreadCount: 0,
          }))
        );
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, [isDoctor]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /**
   * 2. Auto-open chat if navigated with ?doctorId= or ?targetUserId=
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const doctorId = params.get("doctorId");
    const targetUserId = params.get("targetUserId");

    if (doctorId || targetUserId) {
      const openDirectChat = async () => {
        try {
          const res = await API.post("/chat/conversations", {
            doctorId,
            targetUserId,
          });
          if (res.data?.data) {
            setActiveChat(res.data.data);
            fetchConversations();
          }
        } catch (err) {
          console.warn("Failed to open direct chat:", err);
        }
      };
      openDirectChat();
    }
  }, [location.search, fetchConversations]);

  /**
   * 3. Socket Live Updates (Real-Time Re-sorting & Unread Badges)
   */
  useEffect(() => {
    if (!socket || typeof socket.on !== "function") return;

    // Real-time conversation updates: updates last message and re-sorts list
    const handleConversationUpdated = (updatedSummary) => {
      setConversations((prev) => {
        const exists = prev.find((c) => String(c._id) === String(updatedSummary.conversationId));

        let nextList;
        if (exists) {
          nextList = prev.map((c) => {
            if (String(c._id) === String(updatedSummary.conversationId)) {
              return {
                ...c,
                lastMessage: updatedSummary.lastMessage || c.lastMessage,
                lastMessageTimestamp: updatedSummary.lastMessageTimestamp || new Date().toISOString(),
                unreadCount:
                  updatedSummary.unreadCount?.[String(user?._id)] ??
                  (activeChat?._id === c._id ? 0 : (c.unreadCount || 0) + 1),
              };
            }
            return c;
          });
        } else {
          // If conversation is brand new, refresh list from server
          fetchConversations();
          return prev;
        }

        // Sort descending by lastMessageTimestamp
        return nextList.sort(
          (a, b) => new Date(b.lastMessageTimestamp || 0) - new Date(a.lastMessageTimestamp || 0)
        );
      });
    };

    // Online status updates
    const handleUserStatus = ({ userId, status }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.otherParticipant && String(c.otherParticipant._id) === String(userId)) {
            return { ...c, isOnline: status === "online" };
          }
          return c;
        })
      );
    };

    socket.on("conversation-updated", handleConversationUpdated);
    socket.on("user-status", handleUserStatus);

    return () => {
      socket.off("conversation-updated", handleConversationUpdated);
      socket.off("user-status", handleUserStatus);
    };
  }, [socket, user?._id, activeChat?._id, fetchConversations]);

  /**
   * 4. Open "New Chat" directory of doctors
   */
  const handleOpenNewChatModal = async () => {
    setShowNewChatModal(true);
    setLoadingDoctors(true);
    try {
      const res = await API.get("/doctors");
      setDoctorsList(res.data?.data || []);
    } catch (err) {
      toast.error("Could not load doctors directory.");
    } finally {
      setLoadingDoctors(false);
    }
  };

  /**
   * 5. Start a chat with a specific doctor (Open access - No booking required)
   */
  const handleSelectDoctorForChat = async (doctor) => {
    try {
      setShowNewChatModal(false);
      const res = await API.post("/chat/conversations", {
        doctorId: doctor._id,
      });

      if (res.data?.data) {
        setActiveChat(res.data.data);
        fetchConversations();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start chat with doctor.");
    }
  };

  const filteredDoctors = doctorsList.filter((doc) => {
    const name = doc.userId?.name || doc.name || "";
    const spec = doc.specialization || "";
    const q = doctorSearch.toLowerCase();
    return name.toLowerCase().includes(q) || spec.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-[calc(100vh-140px)]">
      {/* ── Inbox Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
            💬
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Messages</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              {isDoctor ? "Consult with patients in real time" : "Chat with your verified doctors"}
            </p>
          </div>
        </div>

        {/* New Chat Button (Open Access to all doctors) */}
        {!isDoctor && (
          <button
            onClick={handleOpenNewChatModal}
            className="w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>+</span>
            <span>Chat with a Doctor</span>
          </button>
        )}
      </div>

      {/* ── Loading State ── */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <span className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Loading conversations...</p>
          </div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
          <div className="text-5xl">📭</div>
          <h3 className="text-lg font-black text-slate-800">No active conversations yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isDoctor
              ? "Patient consultations and inquiries will appear here."
              : "You can start a real-time consultation with any doctor without booking an appointment."}
          </p>
          {!isDoctor && (
            <button
              onClick={handleOpenNewChatModal}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md transition inline-flex items-center gap-2"
            >
              <span>🔍 Find a Doctor to Chat</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
          {conversations.map((conv) => {
            const other = conv.otherParticipant;
            const docInfo = conv.doctorInfo;
            const otherRole = other?.role || (isDoctor ? "patient" : "doctor");
            const otherName = other?.name || (otherRole === "doctor" ? "Doctor" : "Patient");
            const unread = conv.unreadCount || 0;

            const timeStr = conv.lastMessageTimestamp
              ? new Date(conv.lastMessageTimestamp).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })
              : "";

            return (
              <div
                key={conv._id}
                onClick={() => {
                  setActiveChat(conv);
                  // Optimistically clear unread badge in UI
                  setConversations((prev) =>
                    prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
                  );
                }}
                className={`p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50/80 transition-all cursor-pointer group ${
                  unread > 0 ? "bg-primary-50/30" : ""
                }`}
              >
                {/* Avatar with Online/Offline indicator */}
                <div className="relative flex-shrink-0">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200/80 flex items-center justify-center font-black text-primary-700 text-lg shadow-sm overflow-hidden">
                    {other?.profilePicture || docInfo?.image ? (
                      <img
                        src={other?.profilePicture || docInfo?.image}
                        alt={otherName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{otherName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  {/* Online Status Dot */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      conv.isOnline ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-slate-300"
                    }`}
                    title={conv.isOnline ? "Online" : "Offline"}
                  />
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4
                        className={`text-sm truncate font-black ${
                          unread > 0 ? "text-slate-900 font-extrabold" : "text-slate-800"
                        }`}
                      >
                        {otherRole === "doctor" ? `Dr. ${otherName}` : otherName}
                      </h4>

                      {docInfo?.specialization && (
                        <span className="text-[10px] text-primary-700 bg-primary-50 font-semibold px-2 py-0.5 rounded-md border border-primary-100 hidden sm:inline-block truncate">
                          {docInfo.specialization}
                        </span>
                      )}

                      {docInfo?.isAvailable !== undefined && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full hidden md:inline-block ${
                            docInfo.isAvailable
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {docInfo.isAvailable ? "Available" : "Busy"}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0">
                      {timeStr}
                    </span>
                  </div>

                  {/* Last Message Preview & Unread Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs truncate ${
                        unread > 0 ? "font-bold text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {conv.lastMessage?.text || "No messages yet"}
                    </p>

                    {/* Unread Count Badge */}
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm flex-shrink-0 animate-scale-up">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Active Chat Modal / Window ── */}
      {activeChat && (
        <ChatWindow
          conversation={activeChat}
          onClose={() => {
            setActiveChat(null);
            fetchConversations();
          }}
        />
      )}

      {/* ── New Chat: Doctor Directory Modal (Open Access) ── */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-primary-600 to-primary-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">Start a New Consultation Chat</h3>
                <p className="text-xs text-primary-100">Message any doctor directly &bull; No booking required</p>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Search doctors by name or specialization..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Doctor List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-2">
              {loadingDoctors ? (
                <div className="flex justify-center py-10">
                  <span className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No doctors found matching "{doctorSearch}".
                </div>
              ) : (
                filteredDoctors.map((doc) => {
                  const docName = doc.userId?.name || doc.name || "Doctor";
                  return (
                    <div
                      key={doc._id}
                      onClick={() => handleSelectDoctorForChat(doc)}
                      className="p-3.5 rounded-2xl hover:bg-primary-50/60 transition cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-primary-100 text-primary-700 font-bold flex items-center justify-center flex-shrink-0 text-base overflow-hidden">
                          {doc.image ? (
                            <img src={doc.image} alt={docName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{docName.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-primary-600 transition truncate">
                            Dr. {docName}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">{doc.specialization}</p>
                          <span className="text-[10px] text-slate-400">
                            {doc.experience} yrs exp &bull; ₹{doc.consultationFee}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            doc.isAvailable !== false
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {doc.isAvailable !== false ? "Available" : "Busy"}
                        </span>
                        <span className="text-primary-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                          Chat ➔
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
