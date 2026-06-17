import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};

const CITIES = ["Hyderabad", "Bangalore", "Chennai", "Mumbai", "Delhi", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow"];
const SPECIALIZATIONS = ["General Physician", "Cardiologist", "Dermatologist", "Neurologist", "Orthopedist", "Pediatrician", "Gynecologist", "Ophthalmologist", "ENT Specialist", "Dentist", "Psychiatrist", "Urologist"];

export default function DoctorDashboard() {
  const { user, isDoctor } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile]     = useState(null);
  const [appts, setAppts]         = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingAppts, setLoadingAppts]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [activeTab, setActiveTab] = useState("appointments");
  const [saved, setSaved]         = useState(false);

  // form state
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!isDoctor) { navigate("/login"); return; }
    fetchProfile();
    fetchAppointments();
  }, [isDoctor]);

  const fetchProfile = async () => {
    try {
      const res = await API.get("/doctors/profile/me");
      const doc = res.data.data;
      setProfile(doc);
      setForm({
        name:            doc.userId?.name || "",
        phone:           doc.userId?.phone || "",
        specialization:  doc.specialization || "",
        qualification:   doc.qualification || "",
        experience:      doc.experience || "",
        consultationFee: doc.consultationFee || "",
        bio:             doc.bio || "",
        city:            doc.city || "Hyderabad",
        clinicName:      doc.clinicName || "",
        address:         doc.address || "",
        mapUrl:          doc.mapUrl || "",
        availableTime:   doc.availableTime || "",
        availableDays:   (doc.availableDays || []).join(", "),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await API.get("/appointments");
      setAppts(res.data.data || []);
    } catch (err) {
      console.error(err);
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
        prev.map((a) => (a._id === id ? { ...a, status } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-10 h-10 rounded-full border-4 border-secondary-500 border-t-transparent"></div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-secondary-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-secondary-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-secondary-600">
              {profile?.userId?.name?.charAt(0) || "D"}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Dr. {profile?.userId?.name || user?.name}
              </h1>
              <p className="text-slate-500 text-sm">{profile?.specialization} · {profile?.city}</p>
            </div>
          </div>
          {/* Availability Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Status:</span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none shadow-inner ${
                profile?.isAvailable ? "bg-green-500" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                profile?.isAvailable ? "translate-x-9" : "translate-x-1"
              }`}></span>
            </button>
            <span className={`text-sm font-bold ${profile?.isAvailable ? "text-green-600" : "text-slate-400"}`}>
              {toggling ? "Updating…" : profile?.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: stats.total,     color: "from-slate-500 to-slate-600" },
          { label: "Pending",   value: stats.pending,   color: "from-amber-500 to-orange-500" },
          { label: "Confirmed", value: stats.confirmed, color: "from-green-500 to-emerald-600" },
          { label: "Completed", value: stats.completed, color: "from-blue-500 to-indigo-600" },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 text-white shadow-lg`}>
            <p className="text-3xl font-extrabold">{s.value}</p>
            <p className="text-sm opacity-80 mt-1">{s.label} Appointments</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-fit mb-6">
          {["appointments", "profile"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                activeTab === t
                  ? "bg-white text-secondary-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "appointments" ? "📋 Appointments" : "⚙️ My Profile"}
            </button>
          ))}
        </div>

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
          <div className="space-y-4 pb-12">
            {loadingAppts ? (
              <div className="text-center py-12 text-slate-400">Loading appointments…</div>
            ) : appts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-slate-500 font-medium">No appointments yet.</p>
              </div>
            ) : (
              appts.map((a) => {
                const patient = a.patientId;
                const date = new Date(a.appointmentDate).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <div key={a._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
                        {patient?.name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{patient?.name || "Patient"}</p>
                        <p className="text-sm text-slate-500">{patient?.email}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{date} · {a.appointmentTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-slate-700">₹{a.amount}</span>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_COLORS[a.status]}`}>
                        {a.status}
                      </span>
                      {a.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateStatus(a._id, "confirmed")}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
                          >
                            ✓ Accept
                          </button>
                          <button
                            onClick={() => updateStatus(a._id, "cancelled")}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-semibold transition-all"
                          >
                            ✗ Cancel
                          </button>
                        </>
                      )}
                      {a.status === "confirmed" && (
                        <button
                          onClick={() => updateStatus(a._id, "completed")}
                          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
                        >
                          ✓ Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 pb-12 mb-12">
            {saved && (
              <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold">
                ✅ Profile saved successfully!
              </div>
            )}
            <h2 className="text-xl font-extrabold text-slate-800 mb-6">Edit Profile & Clinic Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { label: "Full Name",         key: "name",            type: "text" },
                { label: "Phone Number",      key: "phone",           type: "tel" },
                { label: "Qualification",     key: "qualification",   type: "text" },
                { label: "Experience (yrs)",  key: "experience",      type: "number" },
                { label: "Consultation Fee (₹)", key: "consultationFee", type: "number" },
                { label: "Available Time",    key: "availableTime",   type: "text", placeholder: "10:00 AM - 5:00 PM" },
                { label: "Available Days",    key: "availableDays",   type: "text", placeholder: "Mon, Tue, Wed" },
                { label: "Clinic Name",       key: "clinicName",      type: "text" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key] || ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder || ""}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm"
                  />
                </div>
              ))}

              {/* Specialization dropdown */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Specialization</label>
                <select
                  value={form.specialization || ""}
                  onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-400 bg-slate-50 focus:bg-white transition-all text-sm"
                >
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* City dropdown */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">City</label>
                <select
                  value={form.city || ""}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-400 bg-slate-50 focus:bg-white transition-all text-sm"
                >
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Address - full width */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">Clinic Address</label>
                <textarea
                  value={form.address || ""}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-400 bg-slate-50 focus:bg-white transition-all text-sm"
                  placeholder="Full clinic address for map display"
                />
              </div>

              {/* Map URL */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Google Maps Embed URL{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    (from Google Maps → Share → Embed → copy src URL)
                  </span>
                </label>
                <input
                  type="url"
                  value={form.mapUrl || ""}
                  onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-400 bg-slate-50 focus:bg-white transition-all text-sm"
                  placeholder="https://www.google.com/maps/embed?pb=..."
                />
              </div>

              {/* Bio */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">Bio / About</label>
                <textarea
                  value={form.bio || ""}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-400 bg-slate-50 focus:bg-white transition-all text-sm"
                  placeholder="Brief description about yourself and your expertise"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-8 bg-secondary-600 hover:bg-secondary-700 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Saving…
                </>
              ) : "💾 Save Profile"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
