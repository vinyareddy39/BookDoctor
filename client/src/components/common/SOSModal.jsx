import React, { useState } from "react";
import toast from "react-hot-toast";

export default function SOSModal({
  isOpen,
  onClose,
  profile,
  location,
  locationError,
  platform,
  smsMessage,
  smsLink,
  phoneCallLink,
  whatsappLink,
  isLocating,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyMessage = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(smsMessage);
      setCopied(true);
      toast.success("SOS message copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error("Clipboard copy not supported on this browser.");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-red-100 flex flex-col gap-5 relative text-slate-800 my-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm transition-all"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl animate-pulse shrink-0">
            🚨
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Emergency SOS Alert
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Alerting: <span className="font-bold text-slate-800">{profile?.emergencyContact || "Emergency Contact"}</span>
            </p>
          </div>
        </div>

        {/* Locating Indicator */}
        {isLocating && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-800">
            <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Acquiring high-accuracy GPS coordinates (up to 8s)...</span>
          </div>
        )}

        {/* Location Status Notice */}
        {!isLocating && location && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📍</span>
              <span className="font-semibold">GPS Location Attached</span>
            </div>
            <a
              href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline text-emerald-700 hover:text-emerald-900"
            >
              View Pin
            </a>
          </div>
        )}

        {/* Location Denied or Failed Hint */}
        {!isLocating && locationError && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span>⚠️</span>
              <span>Location unavailable ({locationError})</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              SOS will send without live GPS.
              {platform === "ios" && (
                <span className="block font-semibold mt-0.5">
                  💡 iPhone hint: Enable Location for Safari in Settings &gt; Privacy &gt; Location Services.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Preview Message */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Pre-filled Message Preview
          </p>
          <p className="text-xs font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 break-words">
            {smsMessage}
          </p>
        </div>

        {/* Action Buttons */}
        {platform === "desktop" ? (
          /* Desktop Fallback */
          <div className="space-y-3">
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 text-center space-y-1">
              <p className="font-bold text-sm">📱 Mobile Device Recommended</p>
              <p>Open this site on your phone to send an SOS SMS directly via your Messages app.</p>
            </div>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <span>📋</span>
              <span>{copied ? "Copied to Clipboard!" : "Copy SOS Message to Clipboard"}</span>
            </button>
          </div>
        ) : (
          /* Mobile Actions (Android Chrome & iPhone Safari) */
          <div className="space-y-3">
            {/* Primary SOS SMS Link Button (Direct User Tap) */}
            <a
              href={smsLink}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 px-5 rounded-2xl text-center text-base flex items-center justify-center gap-2 shadow-xl hover:shadow-red-500/25 transition-all active:scale-95"
            >
              <span>✉️</span>
              <span>Send SOS Message</span>
            </a>

            {/* Platform Instructions */}
            <p className="text-[11px] text-center text-slate-500 font-medium">
              👉 <span className="font-semibold text-slate-700">Your messaging app will open. Press Send.</span>
              {platform === "android" && " (If prompted, choose your default Messages app)."}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Call Emergency Contact */}
              <a
                href={phoneCallLink}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-3 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
              >
                <span>📞</span>
                <span>Call Contact</span>
              </a>

              {/* Share on WhatsApp */}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-3 px-3 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        {/* 108 / 112 Universal Ambulance Backup */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium text-[11px]">National Ambulance:</span>
          <div className="flex gap-2">
            <a
              href="tel:108"
              className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-extrabold hover:bg-red-100 transition-colors"
            >
              🚨 108 Ambulance
            </a>
            <a
              href="tel:112"
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
            >
              112
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
