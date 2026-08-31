import { useState, useEffect, useRef } from "react";
import API from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const messageCache = {}; // Module-level cache for instant WhatsApp-like loading

export default function ChatWindow({ appointment, onClose }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState(messageCache[appointment._id] || []);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!messageCache[appointment._id]);
  const messagesEndRef = useRef(null);

  const isDoctor = user?.role === "doctor";
  const otherPersonName = isDoctor 
    ? (appointment.patientId?.name || "Patient") 
    : (appointment.doctorId?.userId?.name || "Doctor");

  useEffect(() => {
    fetchMessages();
    
    if (socket) {
      socket.emit("join-chat", appointment._id);
      
      const handleNewMessage = (msg) => {
        if (msg.appointmentId === appointment._id) {
          setMessages(prev => {
            if (prev.find(m => m._id === msg._id)) return prev;
            const updated = [...prev, msg];
            messageCache[appointment._id] = updated; // Update cache
            return updated;
          });
        }
      };
      
      socket.on("receive-message", handleNewMessage);
      
      return () => {
        socket.emit("leave-chat", appointment._id);
        socket.off("receive-message", handleNewMessage);
      };
    }
  }, [socket, appointment._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await API.get(`/chat/${appointment._id}`);
      const fetched = res.data.data || [];
      setMessages(fetched);
      messageCache[appointment._id] = fetched; // Update cache
    } catch (err) {
      console.error(err);
      toast.error("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgData = { text: newMessage };
    setNewMessage("");

    // Optimistic UI update
    const tempMsg = {
      _id: Date.now().toString(),
      appointmentId: appointment._id,
      senderId: { _id: user._id },
      text: msgData.text,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => {
      const updated = [...prev, tempMsg];
      messageCache[appointment._id] = updated;
      return updated;
    });

    try {
      await API.post(`/chat/${appointment._id}`, msgData);
    } catch (err) {
      toast.error("Failed to send message");
      // Remove optimistic message if failed
      setMessages(prev => {
        const reverted = prev.filter(m => m._id !== tempMsg._id);
        messageCache[appointment._id] = reverted;
        return reverted;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md h-[80vh] max-h-[700px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary-600 text-white shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {otherPersonName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-sm">{isDoctor ? otherPersonName : `Dr. ${otherPersonName}`}</h3>
              <p className="text-xs text-primary-100 opacity-90">In-App Consultation Chat</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            ✕
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <span className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <div className="text-4xl mb-3">💬</div>
              <p>No messages yet.</p>
              <p className="text-xs mt-1">Start the conversation below!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMine = msg.senderId?._id === user._id || msg.senderId === user._id;
              
              // Hide repetitive timestamps if within same minute
              const prevMsg = i > 0 ? messages[i-1] : null;
              const msgDate = new Date(msg.createdAt);
              const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
              const showTime = !prevDate || Math.abs(msgDate - prevDate) > 60000;

              return (
                <div key={msg._id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    isMine ? "bg-primary-500 text-white rounded-tr-sm" : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm"
                  }`}>
                    {msg.text}
                  </div>
                  {showTime && (
                    <span className="text-[10px] text-slate-400 mt-1 font-medium mx-1">
                      {msgDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={handleSend} className="flex gap-2 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="w-12 h-12 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center shadow-sm transition-all flex-shrink-0"
            >
              <svg className="w-5 h-5 -ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
