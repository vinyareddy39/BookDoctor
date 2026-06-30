import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import toast from "react-hot-toast";

// Sub-components (split for maintainability)
import DashboardStats     from "../components/dashboard/DashboardStats.jsx";
import AppointmentsList   from "../components/dashboard/AppointmentsList.jsx";
import ClinicSettingsForm from "../components/dashboard/ClinicSettingsForm.jsx";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("appointments");
  const [profile, setProfile] = useState(null);
  const [appts, setAppts] = useState([]);

  const [form, setForm] = useState({
    name: "", phone: "", specialization: "", qualification: "",
    experience: "", consultationFee: "", bio: "", city: "",
    clinicName: "", address: "", mapUrl: "", availableDays: "",
  });

  const [startTime, setStartTime] = useState("09:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingAppts,   setLoadingAppts]   = useState(true);
  const [toggling, setToggling] = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchAppointments();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await API.get("/doctors/profile/me");
      const doc = res.data.data;
      setProfile(doc);

      let parsedStart = "09:00 AM";
      let parsedEnd = "05:00 PM";
      if (doc.availableTime?.includes("-")) {
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
      toast.error("Failed to load doctor profile.");
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
      toast.error("Failed to fetch appointments.");
    } finally {
      setLoadingAppts(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await API.patch("/doctors/profile/me/toggle");
      setProfile((prev) => ({ ...prev, isAvailable: res.data.data.isAvailable }));
      toast.success(res.data.data.isAvailable ? "You are now Available! 🟢" : "You are now Unavailable!");
    } catch (err) {
      toast.error("Failed to update availability.");
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
        availableTime:   `${startTime} - ${endTime}`,
        experience:      Number(form.experience),
        consultationFee: Number(form.consultationFee),
        availableDays:   form.availableDays.split(",").map((d) => d.trim()).filter(Boolean),
      };
      const res = await API.put("/doctors/profile/me", payload);
      setProfile(res.data.data);
      toast.success("Clinic profile updated successfully! 🎉");
    } catch (err) {
      toast.error("Failed to save clinic settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await API.put(`/appointments/${id}`, { status });
      setAppts((prev) =>
        prev.map((a) =>
          a._id === id
            ? { ...a, status, paymentStatus: status === "completed" ? "paid" : a.paymentStatus }
            : a
        )
      );
      toast.success(`Appointment ${status}.`);
    } catch (err) {
      toast.error("Failed to update appointment status.");
    }
  };

  const handlePaymentUpdate = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === "paid" ? "pending" : "paid";
      await API.put(`/appointments/${id}`, { paymentStatus: nextStatus });
      setAppts((prev) =>
        prev.map((a) => a._id === id ? { ...a, paymentStatus: nextStatus } : a)
      );
      toast.success(`Payment marked as ${nextStatus === "paid" ? "Paid ✓" : "Unpaid"}.`);
    } catch (err) {
      toast.error("Failed to update payment status.");
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-slate-500 font-medium text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-16">

      {/* ── Sticky Dashboard Header ── */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10 backdrop-blur-md bg-white/90">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Doctor info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-primary-600 shadow-sm">
              {profile?.userId?.name?.charAt(0) || "D"}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Dr. {profile?.userId?.name || user?.name}
              </h1>
              <p className="text-slate-500 text-sm font-semibold mt-0.5">
                {profile?.specialization} · {profile?.city}
              </p>
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-inner">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accepting Appointments:</span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex items-center focus:outline-none w-[50px] h-[26px] rounded-full transition-colors duration-200 ${profile?.isAvailable ? "bg-green-500" : "bg-slate-300"}`}
            >
              <span className={`inline-block bg-white rounded-full shadow-sm transform transition-transform duration-200 w-[22px] h-[22px] ${profile?.isAvailable ? "translate-x-[26px]" : "translate-x-[2px]"}`} />
            </button>
            <span className={`text-xs font-bold ${profile?.isAvailable ? "text-emerald-600" : "text-slate-400"}`}>
              {toggling ? "Saving…" : profile?.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-6 pt-8">

        {/* Stats cards */}
        <DashboardStats appts={appts} />

        {/* Tab Bar */}
        <div className="flex gap-2 bg-white rounded-xl p-1.5 w-fit border border-slate-200 mb-8 shadow-sm">
          {["appointments", "profile"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === t
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t === "appointments" ? "📋 Appointments" : "⚙️ Clinic & Schedule"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "appointments" && (
          <AppointmentsList
            appts={appts}
            loading={loadingAppts}
            onStatusUpdate={handleStatusUpdate}
            onPaymentUpdate={handlePaymentUpdate}
          />
        )}

        {activeTab === "profile" && (
          <ClinicSettingsForm
            form={form}
            setForm={setForm}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
            profile={profile}
            onToggle={handleToggle}
            toggling={toggling}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
