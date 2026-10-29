import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../services/api";
import { Link } from "react-router-dom";

const EVENT_LABELS = [
  { key: "appointment_booked", label: "Appointment Booked", group: "Appointments" },
  { key: "appointment_rescheduled", label: "Appointment Rescheduled", group: "Appointments" },
  { key: "appointment_cancelled", label: "Appointment Cancelled", group: "Appointments" },
  { key: "appointment_reminder", label: "Upcoming Appointment Reminder (24h & 1h)", group: "Appointments" },
  { key: "chat_message_received", label: "New Doctor-Patient Chat Message", group: "Communication" },
  { key: "prescription_shared", label: "New Prescription Shared by Doctor", group: "Recovery & Prescriptions" },
  { key: "dose_reminder", label: "Medication Dose Reminder", group: "Recovery & Prescriptions" },
  { key: "dose_not_confirmed", label: "Unconfirmed Dose Alert (Caregiver)", group: "Recovery & Prescriptions" },
  { key: "refill_due", label: "Prescription Refill Due (2 Days Prior)", group: "Recovery & Prescriptions" },
  { key: "payment_received", label: "Online Payment Confirmation", group: "Billing & Payments" },
  { key: "payment_marked_offline", label: "Clinic Offline Payment Recorded", group: "Billing & Payments" },
  { key: "payment_refunded", label: "Payment Refund Processed", group: "Billing & Payments" },
  { key: "symptom_red_flag", label: "⚠️ Urgent Red-Flag Symptom Alert", group: "Safety & Emergency" },
  { key: "sos_triggered", label: "🚨 SOS Emergency Alert", group: "Safety & Emergency" },
];

export default function NotificationPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState("en");
  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: "22:00",
    end: "07:00",
    timezone: "Asia/Kolkata",
  });
  const [channels, setChannels] = useState({});
  const [pushSupported, setPushSupported] = useState(false);
  const [pushRegistered, setPushRegistered] = useState(false);

  useEffect(() => {
    fetchPreferences();
    if ("Notification" in window && "serviceWorker" in navigator) {
      setPushSupported(true);
    }
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await API.get("/notifications/preferences");
      const prefs = res.data?.data || res.data;
      if (prefs) {
        setLanguage(prefs.language || "en");
        if (prefs.quietHours) setQuietHours(prefs.quietHours);
        if (prefs.channels) setChannels(prefs.channels);
      }
    } catch (err) {
      toast.error("Failed to load notification preferences.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChannel = (eventKey, channelName) => {
    setChannels((prev) => {
      const currentEvent = prev[eventKey] || { in_app: true, email: true, push: true, sms_whatsapp: false };
      return {
        ...prev,
        [eventKey]: {
          ...currentEvent,
          [channelName]: !currentEvent[channelName],
        },
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.put("/notifications/preferences", {
        language,
        quietHours,
        channels,
      });
      toast.success("Notification preferences saved successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported) {
      toast.error("Push notifications are not supported by this browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Register token with backend
        await API.post("/notifications/device-token", {
          platform: "web",
          endpoint: `https://fcm.googleapis.com/fcm/send/demo-${Date.now()}`,
          token: `token-web-${Date.now()}`,
        });
        setPushRegistered(true);
        toast.success("Web push notifications enabled on this browser!");
      } else {
        toast.error("Push notification permission denied in browser.");
      }
    } catch (err) {
      toast.error("Failed to register browser for push.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold">Loading notification preferences...</p>
        </div>
      </div>
    );
  }

  // Group events by category
  const groups = [...new Set(EVENT_LABELS.map((e) => e.group))];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-[11px] text-slate-400">Settings &gt; Notifications</span>
        </div>

        {/* Page Header */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Notification Preferences</h1>
            <p className="text-xs text-slate-500 mt-1">
              Choose your preferred delivery channels, quiet hours, and notification language.
            </p>
          </div>
          {pushSupported && (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={pushRegistered}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                pushRegistered
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100"
              }`}
            >
              <span>{pushRegistered ? "✓" : "📲"}</span>
              <span>{pushRegistered ? "Web Push Enabled" : "Enable Web Push"}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: Language & Quiet Hours */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              1. General & Quiet Hours
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Preferred Notification Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full input px-3 py-2 text-xs rounded-xl border-slate-200"
                >
                  <option value="en">English</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Templates will automatically format alerts in your chosen language.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Timezone</label>
                <input
                  type="text"
                  disabled
                  value={quietHours.timezone}
                  className="w-full input px-3 py-2 text-xs rounded-xl border-slate-200 bg-slate-50 text-slate-500"
                />
              </div>
            </div>

            {/* Quiet Hours Settings */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">Quiet Hours (Do Not Disturb)</h4>
                  <p className="text-[11px] text-slate-500">
                    Suppress external push, emails, and SMS during your sleep or rest hours.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={quietHours.enabled}
                  onChange={(e) => setQuietHours({ ...quietHours, enabled: e.target.checked })}
                  className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </div>

              {quietHours.enabled && (
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-200">
                  <div>
                    <label className="font-bold text-slate-600 block mb-0.5">Start Time</label>
                    <input
                      type="time"
                      value={quietHours.start}
                      onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                      className="input px-2.5 py-1.5 text-xs rounded-xl border-slate-200 w-full"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-0.5">End Time</label>
                    <input
                      type="time"
                      value={quietHours.end}
                      onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                      className="input px-2.5 py-1.5 text-xs rounded-xl border-slate-200 w-full"
                    />
                  </div>
                </div>
              )}

              <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start gap-2">
                <span>⚠️</span>
                <span>
                  <strong>Safety Override:</strong> Critical safety events (SOS Emergencies, Red-Flag Symptoms, and Medication Doses) will override quiet hours to protect your health.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Channel Toggles by Event Category */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              2. Channel Delivery Rules
            </h3>

            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group} className="space-y-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider border-b pb-1">
                    {group}
                  </h4>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                    {EVENT_LABELS.filter((e) => e.group === group).map((evt) => {
                      const cfg = channels[evt.key] || {
                        in_app: true,
                        email: true,
                        push: true,
                        sms_whatsapp: false,
                      };

                      return (
                        <div
                          key={evt.key}
                          className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-bold text-slate-800">{evt.label}</span>

                          <div className="flex items-center gap-4 shrink-0">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={cfg.in_app !== false}
                                onChange={() => handleToggleChannel(evt.key, "in_app")}
                                className="rounded text-primary-600 focus:ring-primary-500"
                              />
                              <span>In-App</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.push)}
                                onChange={() => handleToggleChannel(evt.key, "push")}
                                className="rounded text-primary-600 focus:ring-primary-500"
                              />
                              <span>Push</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.email)}
                                onChange={() => handleToggleChannel(evt.key, "email")}
                                className="rounded text-primary-600 focus:ring-primary-500"
                              />
                              <span>Email</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.sms_whatsapp)}
                                onChange={() => handleToggleChannel(evt.key, "sms_whatsapp")}
                                className="rounded text-primary-600 focus:ring-primary-500"
                              />
                              <span>SMS/WA</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy Note & Save Button */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500">
              🔒 <strong>Privacy Guarantee:</strong> External channels (Push, SMS, WhatsApp) use neutral wording and never disclose sensitive diagnosis or prescription data.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all disabled:opacity-50 shrink-0"
            >
              {saving ? "Saving..." : "Save Preferences ✓"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
