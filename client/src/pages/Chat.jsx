import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import API from "../services/api";
import toast from "react-hot-toast";

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Chat() {
  const { id: appointmentId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [appointment, setAppointment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  // Determine the "other party" (doctor or patient)
  const isPatient = user?.role === "patient";
  const otherName = appointment
    ? isPatient
      ? `Dr. ${appointment.doctorId?.userId?.name || "Doctor"}`
      : appointment.patientId?.name || "Patient"
    : "Loading...";
  const otherRole = isPatient ? "doctor" : "patient";

  // Compute receiverId
  const receiverId = appointment
    ? isPatient
      ? appointment.doctorId?.userId?._id
      : appointment.patientId?._id
    : null;

  // Load appointment details and message history
  useEffect(() => {
    const load = async () => {
      try {
        const [apptRes, msgRes] = await Promise.all([
          API.get("/appointments"),
          API.get(`/chat/${appointmentId}`),
        ]);
        const allAppts = apptRes.data.data || [];
        const appt = allAppts.find((a) => a._id === appointmentId);
        setAppointment(appt || null);
        setMessages(msgRes.data.data || []);
      } catch {
        toast.error("Could not load chat.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appointmentId]);

  // Join socket room and listen for messages
  useEffect(() => {
    if (!user || !socket) return;

    socket.emit("register", user._id);
    socket.emit("join-chat", appointmentId);

    const handleReceive = (msg) => {
      setMessages((prev) => {
        // Avoid duplicates (server may re-echo to sender)
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("receive-message", handleReceive);
    socket.on("chat-error", (err) => toast.error(err.message));

    return () => {
      socket.emit("leave-chat", appointmentId);
      socket.off("receive-message", handleReceive);
      socket.off("chat-error");
    };
  }, [appointmentId, user, socket]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || !receiverId || !socket) return;

      socket.emit("send-message", {
        appointmentId,
        senderId: user._id,
        senderName: user.name,
        receiverId,
        text: trimmed,
      });

      setText("");
    },
    [text, appointmentId, user, receiverId, socket]
  );

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const dateLabel = formatDate(msg.createdAt);
    if (!acc[dateLabel]) acc[dateLabel] = [];
    acc[dateLabel].push(msg);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center bg-surface">
        <div className="animate-spin w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link
          to="/appointments"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
          {otherName.charAt(0)}
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-800">{otherName}</h2>
          <p className="text-[10px] text-slate-400 font-semibold capitalize">{otherRole}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-500 font-semibold">Secure Chat</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="text-5xl">💬</div>
            <p className="text-sm font-semibold">No messages yet.</p>
            <p className="text-xs text-center max-w-xs">
              Start a conversation with {otherName}. Messages are private and secure.
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 bg-surface px-2">{date}</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              <div className="space-y-2">
                {msgs.map((msg) => {
                  const isMine = String(msg.senderId?._id || msg.senderId) === String(user._id);
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isMine
                            ? "bg-primary-600 text-white rounded-br-sm"
                            : "bg-white text-slate-800 border border-slate-100 rounded-bl-sm"
                        }`}
                      >
                        <p>{msg.text}</p>
                        <p
                          className={`text-[10px] mt-1 text-right ${
                            isMine ? "text-primary-200" : "text-slate-400"
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${otherName}...`}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-300 transition-all"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="w-10 h-10 bg-primary-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-full flex items-center justify-center transition-all hover:bg-primary-700 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
