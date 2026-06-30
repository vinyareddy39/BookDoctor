import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import AppointmentCard from "../components/appointment/AppointmentCard.jsx";

const TABS = ["All", "Upcoming", "Completed", "Cancelled"];

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="flex gap-2 mt-2">
        <div className="skeleton h-8 w-24 rounded-lg" />
        <div className="skeleton h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState("All");

  useEffect(() => {
    const fetchAppts = async () => {
      try {
        const res = await API.get("/appointments");
        setAppointments(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppts();
  }, []);

  const filtered = appointments.filter((a) => {
    if (activeTab === "All")       return true;
    if (activeTab === "Upcoming")  return ["pending", "confirmed"].includes(a.status?.toLowerCase());
    if (activeTab === "Completed") return a.status?.toLowerCase() === "completed";
    if (activeTab === "Cancelled") return a.status?.toLowerCase() === "cancelled";
    return true;
  });

  return (
    <div className="min-h-screen bg-surface py-10 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900">My Appointments</h1>
              <p className="text-slate-500 mt-1">Track and manage all your healthcare appointments</p>
            </div>
            <Link to="/doctors" className="btn-primary text-sm px-5 py-2.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Book New
            </Link>
          </div>

          {/* Support Banner */}
          <div className="bg-primary-50 border border-primary-100 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <p className="text-primary-800 text-sm">
              <span className="font-bold">Need help?</span> Email us at{" "}
              <a href="mailto:findoctor@gmail.com" className="font-bold underline hover:text-primary-600 transition-colors">
                findoctor@gmail.com
              </a>{" "}
              and we will respond.
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 bg-white border border-slate-200 p-1.5 rounded-xl w-fit mb-6 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-150 ${
                activeTab === tab
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab}
              {tab !== "All" && !loading && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {appointments.filter((a) => {
                    if (tab === "Upcoming")  return ["pending","confirmed"].includes(a.status?.toLowerCase());
                    if (tab === "Completed") return a.status?.toLowerCase() === "completed";
                    if (tab === "Cancelled") return a.status?.toLowerCase() === "cancelled";
                    return true;
                  }).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-7xl mb-4">📭</div>
            <h3 className="text-xl font-black text-slate-700 mb-2">
              {activeTab === "All" ? "No appointments yet" : `No ${activeTab.toLowerCase()} appointments`}
            </h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              {activeTab === "All"
                ? "Book your first appointment with one of our verified specialists."
                : `You don't have any ${activeTab.toLowerCase()} appointments at the moment.`
              }
            </p>
            <Link to="/doctors" className="btn-primary inline-flex">
              Find a Doctor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((a) => (
              <AppointmentCard key={a._id} appointment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
