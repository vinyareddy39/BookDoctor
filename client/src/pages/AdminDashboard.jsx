import { useState, useEffect } from "react";
import API from "../services/api";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await API.get("/admin/dashboard");
        setData(res.data.data || res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load admin dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="card p-8 text-center border-red-200 bg-red-50 text-red-700">
          <span className="text-4xl">⚠️</span>
          <p className="mt-2 font-bold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-black text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Platform overview and statistics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", val: data?.stats?.users, color: "bg-blue-50 text-blue-700" },
            { label: "Total Doctors", val: data?.stats?.doctors, color: "bg-indigo-50 text-indigo-700" },
            { label: "Appointments", val: data?.stats?.appointments, color: "bg-green-50 text-green-700" },
            { label: "Pending", val: data?.stats?.pending, color: "bg-amber-50 text-amber-700" },
          ].map((s) => (
            <div key={s.label} className={`card p-5 ${s.color}`}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70">{s.label}</p>
              <p className="text-3xl font-black mt-2">{s.val}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Appointments */}
          <div className="card overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800">Recent Appointments</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data?.recentAppointments?.length > 0 ? (
                data.recentAppointments.map((a) => (
                  <div key={a._id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{a.patientId?.name || "Unknown Patient"}</p>
                      <p className="text-xs text-slate-500">with Dr. {a.doctorId?.userId?.name || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                        a.status === "completed" ? "bg-blue-100 text-blue-700" :
                        a.status === "cancelled" ? "bg-red-100 text-red-700" :
                        a.status === "confirmed" ? "bg-green-100 text-green-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {a.status}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{new Date(a.appointmentDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">No recent appointments.</div>
              )}
            </div>
          </div>

          {/* Doctors List */}
          <div className="card overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800">Registered Doctors</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {data?.doctors?.length > 0 ? (
                data.doctors.map((d) => (
                  <div key={d._id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                        {d.userId?.name?.[0] || "D"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Dr. {d.userId?.name}</p>
                        <p className="text-xs text-slate-500">{d.specialization}</p>
                      </div>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${d.isAvailable ? "bg-green-500" : "bg-slate-300"}`} title={d.isAvailable ? "Available" : "Unavailable"} />
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">No doctors registered.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
