import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function ReceptionDashboard() {
  const { user } = useAuth();

  const [queueState, setQueueState] = useState({ queue: [], currentToken: null, counts: {} });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [queueRes, aptRes] = await Promise.all([
        API.get("/queue/status").catch(() => ({ data: { data: {} } })),
        API.get(`/appointments?date=${today}`).catch(() => ({ data: { data: [] } })),
      ]);

      setQueueState(queueRes.data?.data || {});
      setTodayAppointments(aptRes.data?.data?.appointments || aptRes.data?.data || []);
    } catch (err) {
      console.warn("Failed to load reception dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCallNext = async () => {
    try {
      const res = await API.post("/queue/call-next");
      toast.success(res.data?.message || "Next patient called");
      fetchDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.message || "No waiting patients in queue");
    }
  };

  return (
    <div className="section py-8 max-w-7xl mx-auto space-y-6">
      {/* Reception Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-slate-950/20">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🛎️</span>
            <span className="text-xs font-bold tracking-widest uppercase bg-sky-500/30 text-sky-200 px-2.5 py-1 rounded-full border border-sky-400/30">
              Front Desk Operations Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Receptionist Console</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Streamlined patient intake, real-time consultation queue management, walk-in token generation, and front-desk billing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/reception/walk-in"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition flex items-center gap-2"
          >
            <span>📝</span>
            <span>Walk-In Registration</span>
          </Link>
        </div>
      </div>

      {/* Front-Desk Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Link
          to="/queue"
          className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 hover:shadow-md transition group"
        >
          <span className="text-2xl block mb-2 group-hover:scale-110 transition">⚡</span>
          <p className="text-sm font-bold text-slate-800 group-hover:text-purple-700">Live Queue & Display</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Token Calling & TV Lobby</p>
        </Link>

        <Link
          to="/calendar"
          className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-sky-300 hover:shadow-md transition group"
        >
          <span className="text-2xl block mb-2 group-hover:scale-110 transition">📅</span>
          <p className="text-sm font-bold text-slate-800 group-hover:text-sky-700">Appointment Calendar</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Day & Week Scheduling</p>
        </Link>

        <Link
          to="/billing"
          className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-teal-300 hover:shadow-md transition group"
        >
          <span className="text-2xl block mb-2 group-hover:scale-110 transition">💳</span>
          <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700">Billing & Receipts</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Cash / UPI Counter Payments</p>
        </Link>

        <Link
          to="/patients"
          className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition group"
        >
          <span className="text-2xl block mb-2 group-hover:scale-110 transition">👥</span>
          <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700">Patient Directory</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Search MRNs & Profiles</p>
        </Link>
      </div>

      {/* Main Grid: Queue Calling + Today's Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Queue Action Box */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>⚡</span> Walk-In Queue Status
            </h3>
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-full">
              Live
            </span>
          </div>

          {/* Current Calling Token Display */}
          <div className="bg-gradient-to-br from-slate-900 to-purple-950 rounded-2xl p-5 text-white text-center shadow-md">
            <p className="text-[11px] uppercase font-bold tracking-widest text-purple-300">Now Serving</p>
            <p className="text-4xl font-black mt-1 text-white">
              {queueState.currentToken ? `#${queueState.currentToken.tokenNumber}` : "None"}
            </p>
            <p className="text-xs text-slate-300 mt-1">
              {queueState.currentToken ? queueState.currentToken.patientId?.name : "Desk Idle"}
            </p>
          </div>

          {/* Queue KPI breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-[10px] uppercase font-bold text-amber-600">Waiting</p>
              <p className="text-xl font-black text-amber-800 mt-0.5">{queueState.counts?.waiting || 0}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-[10px] uppercase font-bold text-purple-600">Called</p>
              <p className="text-xl font-black text-purple-800 mt-0.5">{queueState.counts?.called || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-[10px] uppercase font-bold text-emerald-600">In Consult</p>
              <p className="text-xl font-black text-emerald-800 mt-0.5">{queueState.counts?.in_consultation || 0}</p>
            </div>
          </div>

          <button
            onClick={handleCallNext}
            className="w-full btn-primary py-3 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
          >
            <span>📢</span> Call Next Patient
          </button>
        </div>

        {/* Right Columns: Today's Appointments Roster */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>📅</span> Today's Appointment Schedule
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Check-ins, consultations, and doctor visits</p>
            </div>
            <Link to="/calendar" className="text-xs font-bold text-primary-600 hover:text-primary-700">
              Full Calendar →
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading appointments…</div>
          ) : todayAppointments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <span className="text-2xl block mb-1">🗓️</span>
              <p className="font-semibold">No appointments scheduled for today</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Token / Slot</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Doctor</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAppointments.slice(0, 8).map((apt) => (
                    <tr key={apt._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        #{apt.tokenNumber || "N/A"} <span className="text-slate-400 text-[10px]">({apt.timeSlot || "Standard"})</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {apt.patientId?.name || "Patient"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        Dr. {apt.doctorId?.userId?.name || apt.doctorId?.name || "Doctor"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          apt.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : apt.status === "waiting"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                        }`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/timeline/${apt.patientId?._id || ""}`}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
                        >
                          Timeline
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
