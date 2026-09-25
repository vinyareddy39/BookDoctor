import React, { useState } from "react";
import API from "../services/api";

interface CallSuccessResponse {
  success: true;
  message?: string;
  sid?: string;
  status?: string;
  to?: string;
  businessNumber?: string;
}

interface CallErrorResponse {
  success: false;
  error: string;
  code?: number | null;
  status?: number;
  moreInfo?: string | null;
  directDialNumber?: string;
  canDirectDial?: boolean;
}

type CallStatusState = "idle" | "loading" | "success" | "error";

export default function ClickToCall(): React.ReactElement {
  const [phoneNumber, setPhoneNumber] = useState<string>("+918639473778");
  const [statusState, setStatusState] = useState<CallStatusState>("idle");
  const [successDetails, setSuccessDetails] = useState<CallSuccessResponse | null>(null);
  const [errorDetails, setErrorDetails] = useState<CallErrorResponse | null>(null);

  const normalizeDialNumber = (raw: string): string => {
    const cleaned = (raw || "+919849512453").replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
    return `+91${cleaned.slice(-10)}`;
  };

  const handleCall = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const target = phoneNumber.trim() || "+918639473778";
    const formatted = normalizeDialNumber(target);

    setStatusState("loading");
    setSuccessDetails(null);
    setErrorDetails(null);

    try {
      const response = await API.post("/call", { phoneNumber: formatted });
      if (response.data?.success) {
        setStatusState("success");
        setSuccessDetails(response.data);
      } else {
        setStatusState("error");
        setErrorDetails({
          success: false,
          error: response.data?.error || response.data?.message || "Failed to initiate call via Twilio.",
          code: response.data?.code,
          moreInfo: response.data?.moreInfo,
          directDialNumber: response.data?.directDialNumber || "+919849512453",
          canDirectDial: true,
        });
      }
    } catch (err: any) {
      console.error("[Click-to-Call] Request failed:", err);
      const serverData = err?.response?.data;
      setStatusState("error");
      setErrorDetails({
        success: false,
        error:
          serverData?.error ||
          serverData?.message ||
          err?.message ||
          "Call could not be placed via Twilio.",
        code: serverData?.code,
        status: err?.response?.status,
        moreInfo: serverData?.moreInfo,
        directDialNumber: serverData?.directDialNumber || "+919849512453",
        canDirectDial: true,
      });
    }
  };

  const currentDialNumber = normalizeDialNumber(phoneNumber);
  const businessNumber = errorDetails?.directDialNumber || "+919849512453";

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-10 transition-all">
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
            Twilio Click-to-Call
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            Enter your mobile number. Twilio will call your phone and connect you to the emergency dispatch hotline.
          </p>
        </div>

        {/* Call Form */}
        <form onSubmit={handleCall} className="space-y-5">
          <div>
            <label
              htmlFor="phone-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
            >
              Your Phone Number (E.164 format)
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
                placeholder="+91 86394 73778"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-base"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Include country code (e.g. <span className="font-semibold text-slate-600">+918639473778</span>).
            </p>
          </div>

          {/* Action Button: Call Now */}
          <button
            type="submit"
            disabled={statusState === "loading"}
            className="w-full py-4 px-6 rounded-2xl font-black text-base shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {statusState === "loading" ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Placing Call via Twilio...</span>
              </>
            ) : statusState === "success" ? (
              <>
                <span>✓ Call Initiated — Call Again</span>
                <span aria-hidden="true">↻</span>
              </>
            ) : (
              <>
                <span>Call Now via Twilio</span>
                <span aria-hidden="true">➔</span>
              </>
            )}
          </button>
        </form>

        {/* Success State Card */}
        {statusState === "success" && successDetails && (
          <div className="mt-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-sm animate-fade-in space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800 text-base">
              <span>✅</span>
              <span>Call Placed Successfully!</span>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Twilio is calling <strong>{successDetails.to}</strong>. When you pick up, you will be bridged to <strong>{successDetails.businessNumber || "+919849512453"}</strong>.
            </p>
            {successDetails.sid && (
              <div className="pt-2 text-[11px] font-mono text-emerald-600 break-all">
                Call SID: {successDetails.sid} &bull; Status: {successDetails.status || "queued"}
              </div>
            )}
          </div>
        )}

        {/* Error State Card (Clear, actionable diagnostics) */}
        {statusState === "error" && errorDetails && (
          <div className="mt-6 p-5 rounded-2xl bg-amber-50 border border-amber-300 text-slate-800 text-sm animate-fade-in space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-base">
                <span>⚠️</span>
                <span>Twilio Voice Notice</span>
              </div>
              {errorDetails.code && (
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-mono font-bold">
                  Code {errorDetails.code}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200">
              {errorDetails.error}
            </p>

            {errorDetails.moreInfo && (
              <p className="text-[11px] text-amber-800">
                Documentation:{" "}
                <a
                  href={errorDetails.moreInfo}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-semibold hover:text-amber-900 break-all"
                >
                  {errorDetails.moreInfo}
                </a>
              </p>
            )}

            {/* Quick action button for Direct Calling */}
            <div className="pt-1">
              <a
                href={`tel:${businessNumber}`}
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
              >
                <span>📱</span>
                <span>Direct Call Emergency Dispatch: {businessNumber}</span>
              </a>
            </div>
          </div>
        )}

        {/* Direct Device Telephony Fallback (Always accessible) */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-center text-xs font-semibold text-slate-500 mb-2.5">
            Or bypass Twilio and call directly from this device:
          </p>
          <a
            href={`tel:${businessNumber}`}
            className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 text-center"
          >
            <span>🚨</span>
            <span>Emergency Dispatch Hotline: {businessNumber}</span>
          </a>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-400">
            Powered by Twilio Voice &bull; Emergency Telephony Bridge
          </p>
        </div>
      </div>
    </div>
  );
}
