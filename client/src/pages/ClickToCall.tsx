import React, { useState } from "react";
import API from "../services/api";

interface CallResponse {
  success: boolean;
  message?: string;
  sid?: string;
  status?: string;
  to?: string;
  businessNumber?: string;
}

type CallState = "idle" | "loading" | "success";

export default function ClickToCall(): React.ReactElement {
  const [phoneNumber, setPhoneNumber] = useState<string>("+919849512453");
  const [statusState, setStatusState] = useState<CallState>("idle");
  const [callDetails, setCallDetails] = useState<CallResponse | null>(null);

  const normalizeDialNumber = (raw: string): string => {
    const cleaned = (raw || "+919849512453").replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
    return `+91${cleaned.slice(-10)}`;
  };

  const handleCall = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const target = phoneNumber.trim() || "+919849512453";
    const formatted = normalizeDialNumber(target);

    setStatusState("loading");

    // 1. Immediately initiate device call via native telephony (tel:)
    window.location.href = `tel:${formatted}`;

    // 2. Set success state immediately
    setStatusState("success");
    setCallDetails({
      success: true,
      to: formatted,
      message: `Direct call initiated to ${formatted}`,
      businessNumber: "+919849512453",
    });

    // 3. Notify backend asynchronously
    try {
      await API.post("/call", { phoneNumber: formatted });
    } catch (_) {
      // Ignored: native device call is already running
    }
  };

  const currentDialNumber = normalizeDialNumber(phoneNumber);

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10 transition-all">
        {/* Header Badge & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 mb-4 shadow-sm">
            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
            Direct Emergency Call
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            One-tap direct calling to the hospital emergency dispatch line.
          </p>
        </div>

        {/* Call Form */}
        <form onSubmit={handleCall} className="space-y-5">
          <div>
            <label
              htmlFor="phone-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
            >
              Emergency Response Number
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-semibold text-sm">
                📞
              </span>
              <input
                id="phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (statusState !== "idle") setStatusState("idle");
                }}
                placeholder="+91 98495 12453"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-base"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Default is emergency dispatch hotline (<span className="font-semibold text-slate-600">+91 98495 12453</span>).
            </p>
          </div>

          {/* Action Button: Tap to Call */}
          <button
            type="submit"
            className="w-full py-4 px-6 rounded-2xl font-black text-base shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {statusState === "loading" ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Opening Dialer...</span>
              </>
            ) : statusState === "success" ? (
              <>
                <span>✓ Calling... Tap to Redial</span>
                <span aria-hidden="true">↻</span>
              </>
            ) : (
              <>
                <span>Call Now</span>
                <span aria-hidden="true">➔</span>
              </>
            )}
          </button>
        </form>

        {/* Instant Native Tel Link (Guaranteed fallback for every device) */}
        <div className="mt-4">
          <a
            href={`tel:${currentDialNumber}`}
            className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 text-center"
          >
            <span>📱</span>
            <span>Tap here to dial directly: {currentDialNumber}</span>
          </a>
        </div>

        {/* Success State Notification */}
        {statusState === "success" && callDetails && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm animate-fade-in">
            <div className="flex items-start gap-2.5">
              <span className="text-xl">📞</span>
              <div>
                <p className="font-bold">Call Triggered</p>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  Your device's phone dialer has been opened for <strong>{callDetails.to}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Direct Emergency Telephony &bull; Free Hospital Connection
          </p>
        </div>
      </div>
    </div>
  );
}
