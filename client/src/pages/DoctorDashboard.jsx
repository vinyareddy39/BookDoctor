import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";

const SPECIALIZATIONS = [
  "General Physician",
  "Pediatrician",
  "Dermatologist",
  "Cardiologist",
  "Orthopedic",
  "Gynecologist",
  "Neurologist",
  "Dentist",
  "Ophthalmologist",
  "Psychiatrist"
];

const CITIES = ["Hyderabad", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Pune"];

const STATUS_COLORS = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  completed: "bg-sky-50 text-sky-700 border-sky-200",
};

const TIME_OPTIONS = [
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
  "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("appointments");
  const [profile, setProfile] = useState(null);
  const [appts, setAppts] = useState([]);
  
  // Profile edit forms
  const [form, setForm] = useState({
    name: "", phone: "", specialization: "", qualification: "",
    experience: "", consultationFee: "", bio: "", city: "",
    clinicName: "", address: "", mapUrl: "", availableDays: "",
  });
  
  // Available time dropdown selectors
  const [startTime, setStartTime] = useState("09:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");

  // Loading/UI states
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchAppointments();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await API.get("/doctors/profile/me");
      const doc = res.data.data;
      setProfile(doc);
      
      // Parse availableTime e.g. "09:00 AM - 05:00 PM"
      let parsedStart = "09:00 AM";
      let parsedEnd = "05:00 PM";
      if (doc.availableTime && doc.availableTime.includes("-")) {
        const parts = doc.availableTime.split("-").map((s) => s.trim());
        if (parts[0]) parsedStart = parts[0];
        if (parts[1]) parsedEnd = parts[1];
      }
      setStartTime(parsedStart);
      setEndTime(parsedEnd);

      setForm({
        name:            doc.userId?.name || "",
        phone:           doc.userId?.phone || "",
        specialization:  doc.specialization || "General Physician",
        qualification:   doc.qualification || "",
        experience:      doc.experience || "0",
        consultationFee: doc.consultationFee || "500",
        bio:             doc.bio || "",
        city:            doc.city || "Hyderabad",
        clinicName:      doc.clinicName || "",
        address:         doc.address || "",
        mapUrl:          doc.mapUrl || "",
        availableDays:   (doc.availableDays || []).join(", "),
      });
    } catch (err) {
      console.error("Failed to load doctor profile", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await API.get("/appointments");
      setAppts(res.data.data || []);
    } catch (err) {
      console.error("Failed to load appointments", err);
    } finally {
      setLoadingAppts(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await API.patch("/doctors/profile/me/toggle");
      setProfile((prev) => ({ ...prev, isAvailable: res.data.data.isAvailable }));
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        availableTime: `${startTime} - ${endTime}`,
        experience:      Number(form.experience),
        consultationFee: Number(form.consultationFee),
        availableDays:   form.availableDays.split(",").map((d) => d.trim()).filter(Boolean),
      };
      const res = await API.put("/doctors/profile/me", payload);
      setProfile(res.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await API.put(`/appointments/${id}`, { status });
      setAppts((prev) =>
        prev.map((a) =>
          a._id === id
            ? { ...a, status, paymentStatus: status === "completed" ? "paid" : a.paymentStatus }
            : a
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const updatePaymentStatus = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === "paid" ? "pending" : "paid";
      await API.put(`/appointments/${id}`, { paymentStatus: nextStatus });
      setAppts((prev) =>
        prev.map((a) =>
          a._id === id ? { ...a, paymentStatus: nextStatus } : a
        )
      );
    } catch (err) {
      console.error("Failed to update payment status", err);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent"></div>
          <p className="text-slate-500 font-medium text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total:     appts.length,
    pending:   appts.filter((a) => a.status === "pending").length,
    confirmed: appts.filter((a) => a.status === "confirmed").length,
    completed: appts.filter((a) => a.status === "completed").length,
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10 backdrop-blur-md bg-white/90">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-indigo-600 shadow-sm">
              {profile?.userId?.name?.charAt(0) || "D"}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Dr. {profile?.userId?.name || user?.name}
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-0.5">{profile?.specialization} · {profile?.city}</p>
            </div>
          </div>
          
          {/* Availability Toggle Switch */}
          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-inner">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accepting Appointments:</span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-7 w-13 items-center rounded-full transition-all focus:outline-none ${
                profile?.isAvailable ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                profile?.isAvailable ? "translate-x-7" : "translate-x-1"
              }`}></span>
            </button>
            <span className={`text-xs font-bold ${profile?.isAvailable ? "text-emerald-600 animate-pulse" : "text-slate-400"}`}>
              {toggling ? "Saving…" : profile?.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-5">
        {[
          { label: "Total Bookings", value: stats.total, color: "from-slate-700 to-slate-800 border-slate-200" },
          { label: "Pending Approval", value: stats.pending, color: "from-amber-600 to-amber-700 border-amber-200" },
          { label: "Confirmed Slots", value: stats.confirmed, color: "from-emerald-600 to-emerald-700 border-emerald-200" },
          { label: "Completed", value: stats.completed, color: "from-indigo-600 to-indigo-700 border-indigo-200" },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-3xl p-5 text-white shadow-md hover:shadow-lg transition-shadow border`}>
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs opacity-90 font-medium tracking-wide uppercase mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab Selectors */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-2 bg-slate-100/80 rounded-2xl p-1.5 w-fit border border-slate-200/50 mb-8">
          {["appointments", "profile"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${
                activeTab === t
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200/20"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
              }`}
            >
              {t === "appointments" ? "📋 Appointments" : "⚙️ Clinic & Schedule Settings"}
            </button>
          ))}
        </div>

        {/* Appointments Tab Content */}
        {activeTab === "appointments" && (
          <div className="space-y-5">
            {loadingAppts ? (
              <div className="text-center py-12 text-slate-400">Loading appointments…</div>
            ) : appts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-slate-500 font-semibold text-sm">No appointments scheduled yet.</p>
              </div>
            ) : (
              appts.map((a) => {
                const patient = a.patientId;
                const date = new Date(a.appointmentDate).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <div key={a._id} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold border border-indigo-100/50 flex-shrink-0">
                          {patient?.name?.charAt(0) || "P"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-base">{patient?.name || "Patient"}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{patient?.email} · {patient?.phone || "No phone"}</p>
                          
                          {(patient?.dob || patient?.gender || patient?.bloodGroup || patient?.emergencyContact) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {patient?.dob && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">DOB: {new Date(patient.dob).toLocaleDateString()}</span>}
                              {patient?.gender && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded capitalize">{patient.gender}</span>}
                              {patient?.bloodGroup && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 text-red-600 rounded">Blood: {patient.bloodGroup}</span>}
                              {patient?.emergencyContact && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">Emergency: {patient.emergencyContact}</span>}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              📅 {date}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              ⏰ {a.appointmentTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Hand Control Badges and Actions */}
                      <div className="flex items-center gap-4 flex-wrap md:justify-end">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-700">₹{a.amount}</span>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[a.status]}`}>
                            {a.status}
                          </span>
                        </div>

                        {/* Interactive Payment Status Switch */}
                        <div className="flex items-center">
                          {a.paymentStatus === "paid" ? (
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(a._id, "paid")}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-1.5"
                              title="Click to toggle payment to Unpaid"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Paid ✓
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(a._id, "pending")}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                              title="Click to toggle payment to Paid"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Unpaid ✗
                            </button>
                          )}
                        </div>

                        {/* Booking Status Controls */}
                        <div className="flex items-center gap-2">
                          {a.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateStatus(a._id, "confirmed")}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold shadow-sm hover:shadow transition-all"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => updateStatus(a._id, "cancelled")}
                                className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 rounded-xl font-bold transition-all border border-rose-200/50"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {a.status === "confirmed" && (
                            <button
                              onClick={() => updateStatus(a._id, "completed")}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold shadow-sm hover:shadow transition-all"
                            >
                              Complete Appointment
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Patient Feedback Section (Display if present) */}
                    {a.status === "completed" && a.rating && (
                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl px-5 py-4 mt-2">
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Patient Feedback</p>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {[...Array(5)].map((_, i) => (
                            <svg key={i} className={`w-4 h-4 ${i < a.rating ? "text-amber-400 fill-current" : "text-slate-200 stroke-current"}`} viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                          ))}
                          <span className="text-xs text-amber-800 font-bold ml-1">{a.rating}/5 Stars</span>
                        </div>
                        {a.review && <p className="text-sm text-slate-600 italic">"{a.review}"</p>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Profile/Clinic Settings Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 pb-12 mb-12 space-y-8">
            
            {saved && (
              <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold">
                ✓ Clinic profile settings updated successfully!
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Edit Profile & Clinic Info</h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage your digital clinic settings, available hours, and medical rates.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              
              {/* Doctor Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Doctor Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Qualification */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Qualification</label>
                <input
                  type="text"
                  value={form.qualification}
                  onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
                  placeholder="E.g. MBBS, MD, DM"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Experience */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Experience (Years)</label>
                <input
                  type="number"
                  value={form.experience}
                  onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Fee */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Consultation Fee (₹)</label>
                <input
                  type="number"
                  value={form.consultationFee}
                  onChange={(e) => setForm((f) => ({ ...f, consultationFee: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Available Days */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Available Days</label>
                <input
                  type="text"
                  value={form.availableDays}
                  onChange={(e) => setForm((f) => ({ ...f, availableDays: e.target.value }))}
                  placeholder="Mon, Tue, Wed, Thu, Fri"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Available Timing range picker dropdowns */}
              <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Available From</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Available To</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Availability Toggle inside Settings */}
              <div className="sm:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Currently Accepting Appointments</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Turn this off if you are on leave or fully booked.</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all focus:outline-none ${
                    profile?.isAvailable ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                    profile?.isAvailable ? "translate-x-7" : "translate-x-1"
                  }`}></span>
                </button>
              </div>

              {/* Clinic Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Clinic Name</label>
                <input
                  type="text"
                  value={form.clinicName}
                  onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))}
                  placeholder="E.g. City Health Clinic"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>

              {/* Specialization */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Specialization</label>
                <select
                  value={form.specialization}
                  onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                >
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                <select
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                >
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Clinic Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Clinic Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  placeholder="Full clinic street address"
                />
              </div>

              {/* Map Embed URL */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Google Maps Embed URL</label>
                <input
                  type="url"
                  value={form.mapUrl}
                  onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  placeholder="https://www.google.com/maps/embed?pb=..."
                />
              </div>

              {/* Bio */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bio / About Me</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  placeholder="Describe your medical practice details..."
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving settings...
                  </>
                ) : (
                  "Save Settings Profile"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
