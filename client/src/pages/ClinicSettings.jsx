import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";

export default function ClinicSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clinic, setClinic] = useState({
    name: "",
    tagline: "",
    address: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    phone: "",
    email: "",
    emergencyHotline: "",
    taxId: "",
    currency: "INR",
    currencySymbol: "₹",
    workingHours: {
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      openTime: "08:00",
      closeTime: "20:00",
    },
    billingSettings: {
      defaultConsultationFee: 500,
      taxPercentage: 5,
      invoicePrefix: "INV-MED-",
      acceptedPaymentMethods: ["Cash", "UPI", "Razorpay", "Card"],
    },
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await API.get("/clinic");
      if (res.data?.data?.clinic) {
        setClinic(res.data.data.clinic);
      }
    } catch (err) {
      toast.error("Failed to load clinic settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    setClinic({ ...clinic, [e.target.name]: e.target.value });
  };

  const handleWorkingHoursChange = (e) => {
    setClinic({
      ...clinic,
      workingHours: { ...clinic.workingHours, [e.target.name]: e.target.value },
    });
  };

  const handleBillingChange = (e) => {
    setClinic({
      ...clinic,
      billingSettings: { ...clinic.billingSettings, [e.target.name]: e.target.value },
    });
  };

  const handleDayToggle = (day) => {
    const current = clinic.workingHours.days || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setClinic({
      ...clinic,
      workingHours: { ...clinic.workingHours, days: updated },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await API.put("/clinic", clinic);
      toast.success("Clinic settings updated and logged to audit trail!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update clinic settings.");
    } finally {
      setSaving(false);
    }
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Link to="/admin" className="hover:text-primary-600 transition">
                Admin Control
              </Link>
              <span>/</span>
              <span>Operations Configuration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>⚙️</span> Clinic Settings & Billing Config
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Establish clinical practice identity, operating hours, emergency lines, and tax rules.
            </p>
          </div>
          <Link
            to="/admin"
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
          >
            ← Admin Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading clinical configurations...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            {/* General Information */}
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>🏥</span> Practice Details
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Official clinic name and legal tax representation</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clinic Name</label>
                  <input
                    type="text"
                    name="name"
                    value={clinic.name}
                    onChange={handleChange}
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tagline / Subtitle</label>
                  <input
                    type="text"
                    name="tagline"
                    value={clinic.tagline}
                    onChange={handleChange}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tax ID / GSTIN</label>
                  <input
                    type="text"
                    name="taxId"
                    value={clinic.taxId}
                    onChange={handleChange}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Physical Street Address</label>
                  <input
                    type="text"
                    name="address"
                    value={clinic.address}
                    onChange={handleChange}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Desk Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={clinic.phone}
                    onChange={handleChange}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Emergency 24x7 Hotline</label>
                  <input
                    type="text"
                    name="emergencyHotline"
                    value={clinic.emergencyHotline}
                    onChange={handleChange}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-red-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>⏰</span> Clinic Operating Hours
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Active consultation schedule for slot generation</p>

              <div className="mt-3 space-y-3">
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1.5">Open Days</span>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => {
                      const active = clinic.workingHours.days?.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                            active
                              ? "bg-primary-600 text-white border-primary-600"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Opening Time</label>
                    <input
                      type="time"
                      name="openTime"
                      value={clinic.workingHours.openTime}
                      onChange={handleWorkingHoursChange}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Closing Time</label>
                    <input
                      type="time"
                      name="closeTime"
                      value={clinic.workingHours.closeTime}
                      onChange={handleWorkingHoursChange}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Settings */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>💳</span> Billing & Invoice Parameters
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Automated tax arithmetic and invoice sequence prefix</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Consultation Fee (₹)</label>
                  <input
                    type="number"
                    name="defaultConsultationFee"
                    value={clinic.billingSettings.defaultConsultationFee}
                    onChange={handleBillingChange}
                    min="0"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Applicable GST / Tax Rate (%)</label>
                  <input
                    type="number"
                    name="taxPercentage"
                    value={clinic.billingSettings.taxPercentage}
                    onChange={handleBillingChange}
                    min="0"
                    max="100"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number Prefix</label>
                  <input
                    type="text"
                    name="invoicePrefix"
                    value={clinic.billingSettings.invoicePrefix}
                    onChange={handleBillingChange}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                <span>{saving ? "⏳" : "💾"}</span>
                <span>{saving ? "Saving Configuration..." : "Save Clinic Settings"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
