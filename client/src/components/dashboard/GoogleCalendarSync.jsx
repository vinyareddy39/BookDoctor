import { useState, useEffect } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";

/**
 * GoogleCalendarSync
 * Renders inside the Clinic Settings tab.
 * Allows a doctor to connect their Google Calendar and sync availability automatically.
 *
 * Props:
 *  - profile: the current doctor profile object
 *  - onSynced: callback with { availableDays, availableTime } to update parent form state
 */
export default function GoogleCalendarSync({ profile, onSynced }) {
  const [loading,  setLoading]  = useState(false);
  const [syncing,  setSyncing]  = useState(false);
  const isSynced = !!profile?.googleCalendarSynced;

  // Check if the user just returned from Google OAuth (URL has ?cal=synced or ?cal=error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calStatus = params.get("cal");
    if (calStatus === "synced") {
      toast.success("🗓️ Google Calendar connected! Your availability has been synced.");
      // Clean the URL
      window.history.replaceState({}, "", "/doctor/dashboard");
    } else if (calStatus === "error") {
      toast.error("Failed to connect Google Calendar. Please try again.");
      window.history.replaceState({}, "", "/doctor/dashboard");
    }
  }, []);

  // STEP 1: Redirect the doctor to the Google OAuth consent screen
  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await API.get("/google/auth-url");
      const authUrl = res.data?.data?.url;
      if (!authUrl) throw new Error("No URL returned");
      // Redirect the browser to Google's OAuth consent screen
      window.location.href = authUrl;
    } catch (err) {
      toast.error("Could not reach Google. Please check your connection.");
      setLoading(false);
    }
  };

  // STEP 3: Re-sync on demand (uses stored refresh token on backend)
  const handleReSync = async () => {
    setSyncing(true);
    try {
      const res = await API.post("/google/sync");
      const { availableDays, availableTime } = res.data?.data || {};
      if (onSynced) onSynced({ availableDays, availableTime });
      toast.success("✅ Availability synced from Google Calendar!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Sync failed. Please reconnect.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="sm:col-span-2 border border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Google Calendar icon */}
        <div className="w-12 h-12 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
          <svg viewBox="0 0 48 48" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
            <rect width="22" height="22" x="13" y="13" fill="#fff" rx="1"/>
            <path fill="#1a73e8" d="M25.68 20.92l.96.96-2.06 2.06-.96-.96zM17 26h4v1h-4zm6.5 0h1v4h-1zm.5-8h1v4h-1zm3.5 4h1v4h-1zM17 21h4v1h-4z"/>
            <path fill="#1a73e8" d="M34 14H14a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V16a2 2 0 0 0-2-2zm0 22H14V20h20v16z"/>
            <path fill="#ea4335" d="M17 17h2v2h-2zm10 0h2v2h-2z"/>
          </svg>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800">Google Calendar Sync</h3>
            {isSynced ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                ✓ Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {isSynced
              ? "Your availability is synced from your Google Calendar. Click \"Sync Now\" to refresh it with your latest calendar data."
              : "Connect your Google Calendar to automatically set your available days and working hours — no manual entry needed."}
          </p>
        </div>
      </div>

      {/* What it does */}
      {!isSynced && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "📅", title: "Auto Available Days", desc: "Detects your free days from your calendar events." },
            { icon: "🕒", title: "Working Hours", desc: "Sets your available hours based on your schedule." },
            { icon: "🔄", title: "Re-sync Anytime", desc: "Refresh availability with one click, any time." },
          ].map((item) => (
            <div key={item.title} className="bg-white/70 rounded-xl p-3 border border-blue-100">
              <span className="text-lg">{item.icon}</span>
              <p className="text-xs font-bold text-slate-700 mt-1">{item.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5 flex flex-wrap gap-3">
        {isSynced ? (
          <>
            <button
              type="button"
              onClick={handleReSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow transition-all disabled:opacity-60"
            >
              {syncing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all"
            >
              Reconnect Account
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Redirecting to Google...
              </>
            ) : (
              <>
                <svg viewBox="0 0 48 48" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#fff" d="M34 14H14a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V16a2 2 0 0 0-2-2z"/>
                  <path fill="currentColor" d="M34 14H14a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V16a2 2 0 0 0-2-2zm0 22H14V20h20v16z"/>
                </svg>
                Connect Google Calendar
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        BookDoctor only reads your calendar's free/busy status. It cannot see event titles, participants, or details. Your data is never stored or shared.
      </p>
    </div>
  );
}
