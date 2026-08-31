import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import ChatWindow from "../components/chat/ChatWindow";
import toast from "react-hot-toast";

export default function Messages() {
  const { isDoctor } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await API.get("/appointments");
      setAppointments(res.data.data || []);
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
          <p className="text-slate-500 text-sm font-medium">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 min-h-[calc(100vh-140px)]">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center">
          <span className="text-2xl">💬</span>
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800">Chats</h1>
          <p className="text-slate-500 font-medium mt-1">
            {isDoctor ? "Chat with your patients" : "Chat with your doctors"}
          </p>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-slate-100">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-slate-800">No conversations yet</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            Your active chats will appear here once you have an appointment.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appt) => {
            const docName = appt.doctorId?.userId?.name || appt.doctorId?.name || "Doctor";
            const patName = appt.patientId?.name || "Patient";
            
            const otherName = isDoctor ? patName : `Dr. ${docName}`;
            const initials = isDoctor 
              ? patName.charAt(0).toUpperCase() 
              : docName.charAt(0).toUpperCase();
            
            const dateStr = new Date(appt.appointmentDate).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric"
            });

            return (
              <button
                key={appt._id}
                onClick={() => setActiveChat(appt)}
                className="flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100 w-full text-left group hover:border-primary-200"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 flex items-center justify-center font-bold text-primary-700 text-xl flex-shrink-0 group-hover:scale-105 transition-transform">
                  {initials}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary-700 transition-colors">
                    {otherName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    <p className="text-sm text-slate-500 font-medium">
                      Consultation: {dateStr} at {appt.appointmentTime}
                    </p>
                  </div>
                </div>

                <div className="text-primary-500 bg-primary-50 p-3 rounded-xl group-hover:bg-primary-500 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {activeChat && (
        <ChatWindow appointment={activeChat} onClose={() => setActiveChat(null)} />
      )}
    </div>
  );
}
