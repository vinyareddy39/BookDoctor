import { useEffect, useState } from "react";
import API from "../services/api";
import AppointmentCard from "../components/appointment/AppointmentCard.jsx";

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get("/appointments");
        setAppointments(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="min-h-[calc(100vh-73px)] bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Appointments</h1>
            <p className="text-slate-500 mt-1">View and track all your scheduled appointments</p>
          </div>
          {/* Support Banner */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm">
            <p className="text-indigo-800">
              <span className="font-bold">Need help?</span> If you have any queries, please email us at <a href="mailto:findoctor@gmail.com" className="font-bold underline hover:text-indigo-600 transition-colors">findoctor@gmail.com</a> and we will respond.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No appointments yet</h3>
            <p className="text-slate-500 text-sm mb-6">Book your first appointment with one of our specialists.</p>
            <a
              href="/doctors"
              className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg"
            >
              Find a Doctor
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {appointments.map((a) => (
              <AppointmentCard key={a._id} appointment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
