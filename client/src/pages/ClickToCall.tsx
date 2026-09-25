import React, { useState } from "react";
import API from "../services/api";

interface CallResponse {
  success: boolean;
  message?: string;
  sid?: string;
  status?: string;
  to?: string;
  businessNumber?: string;
  error?: string;
}

type CallState = "idle" | "loading" | "success" | "error";

export default function ClickToCall(): React.ReactElement {
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [statusState, setStatusState] = useState<CallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [callDetails, setCallDetails] = useState<CallResponse | null>(null);

  const handleCall = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setStatusState("error");
      setErrorMessage("Please enter your phone number.");
      return;
    }

    try {
      setStatusState("loading");
      setErrorMessage("");
      setCallDetails(null);

      const response = await API.post<CallResponse>("/call", {
        phoneNumber: trimmed
      });

      if (response.data?.success) {
        setStatusState("success");
        setCallDetails(response.data);
      } else {
        setStatusState("error");
        setErrorMessage(response.data?.error || "Could not initiate call.");
      }
    } catch (err: any) {
      setStatusState("error");
      const errorText =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred while placing the call.";
      setErrorMessage(errorText);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 sm:p-10 transition-all">
        
        {/* Header Badge & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 mb-4 shadow-sm">
            <svg
              className="w-8 h-8 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Click-to-Call
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Enter your mobile number below. Twilio will call your phone and instantly bridge you to our direct line.
          </p>
        </div>

        {/* Call Form */}
        <form onSubmit={handleCall} className="space-y-5">
          <div>
            <label
              htmlFor="phone-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
            >
              Your Phone Number
            </label>
            <div className="relative rounded-xl shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-semibold text-sm">
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
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-base"
                disabled={statusState === "loading"}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Include country code (e.g. <span className="font-semibold">+91</span> for India).
            </p>
          </div>

          {/* Action Button with Dynamic States */}
          <button
            type="submit"
            disabled={statusState === "loading"}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-base shadow-md transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] ${
              statusState === "loading"
                ? "bg-emerald-600/80 text-white cursor-wait"
                : statusState === "success"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : statusState === "error"
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {statusState === "loading" && (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Calling...</span>
              </>
            )}

            {statusState === "idle" && (
              <>
                <span>Call Now</span>
                <span aria-hidden="true">→</span>
              </>
            )}

            {statusState === "success" && (
              <>
                <span>✓ Call Initiated</span>
              </>
            )}

            {statusState === "error" && (
              <>
                <span>Retry Call</span>
                <span aria-hidden="true">↻</span>
              </>
            )}
          </button>
        </form>

        {/* Success State Card */}
        {statusState === "success" && callDetails && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="text-xl">🎉</span>
              <div>
                <p className="font-bold">Call placed successfully!</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Your phone ({callDetails.to}) is ringing now. Answer the call to connect with direct line (
                  {callDetails.businessNumber || "+919849512453"}).
                </p>
                {callDetails.sid && (
                  <p className="text-[11px] text-emerald-600/80 font-mono mt-2">
                    Call SID: {callDetails.sid}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error State Card */}
        {statusState === "error" && errorMessage && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm relative animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setStatusState("idle");
                setErrorMessage("");
              }}
              className="absolute top-3 right-3 w-6 h-6 rounded-full bg-rose-200/80 hover:bg-rose-300 text-rose-800 flex items-center justify-center font-bold text-xs transition"
              title="Clear Error"
            >
              ✕
            </button>

            <div className="flex items-start gap-2.5 pr-6">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-bold">Call could not be placed via Twilio</p>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">{errorMessage}</p>
              </div>
            </div>

            {/* Direct Device Call Fallback */}
            <div className="mt-3 pt-3 border-t border-rose-200/80">
              <p className="text-[11px] font-semibold text-rose-800 mb-2">
                You can call directly from your device right now:
              </p>
              <a
                href="tel:+919849512453"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <span>📞</span>
                <span>Tap to Call Directly (+91 98495 12453)</span>
              </a>
            </div>
          </div>
        )}

        {/* Help / Bridge Info */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Powered by <strong className="text-slate-600 font-semibold">Twilio Voice</strong> &bull; Free direct hospital connection
          </p>
        </div>
      </div>
    </div>
  );
}
