import React, { useState, useEffect } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";

const STATUS_CONFIG = {
  not_submitted: {
    label: "Not Submitted",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
    desc: "Online payouts are not configured. Submit your bank account and PAN to receive consultation fees directly.",
  },
  pending: {
    label: "Verification Pending",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
    desc: "Your linked account is under review by Razorpay Route. Settlements will be automatically enabled once approved.",
  },
  activated: {
    label: "Activated & Linked",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    desc: "Your bank account is fully verified! Consultation fees paid by patients will be automatically routed to your bank.",
  },
  rejected: {
    label: "Verification Rejected",
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
    desc: "Bank or KYC verification was not approved. Please review your details and re-submit.",
  },
};

export default function DoctorPayoutSetup({ profile }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState({
    payoutStatus: "not_submitted",
    payoutRejectionReason: "",
    razorpayAccountId: null,
    bankDetailsMasked: null,
  });

  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    accountHolderName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifsc: "",
    pan: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
    email: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPayoutStatus();
  }, []);

  const fetchPayoutStatus = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payments/doctor/payout-status");
      const data = res.data?.data || res.data;
      setPayoutInfo(data);
      if (data.payoutStatus === "not_submitted" || data.payoutStatus === "rejected") {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }

      // Pre-fill default contact info from doctor profile if empty
      setForm((prev) => ({
        ...prev,
        accountHolderName: prev.accountHolderName || profile?.userId?.name || "",
        phone: prev.phone || profile?.userId?.phone || "",
        email: prev.email || profile?.userId?.email || "",
        address: prev.address || profile?.address || "",
        city: prev.city || profile?.city || "Hyderabad",
        state: prev.state || "Telangana",
      }));
    } catch (err) {
      console.error("Failed to fetch doctor payout status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFillSample = () => {
    const docName = profile?.userId?.name ? `Dr. ${profile.userId.name}` : "Dr. John Doe";
    setForm({
      accountHolderName: docName,
      accountNumber: "98765432109876",
      confirmAccountNumber: "98765432109876",
      ifsc: "HDFC0001234",
      pan: "ABCDE1234F",
      address: profile?.address || "123 Medical Center Rd, Jubilee Hills",
      city: profile?.city || "Hyderabad",
      state: "Telangana",
      postalCode: "500033",
      phone: profile?.userId?.phone || "9876543210",
      email: profile?.userId?.email || "doctor.test@example.com",
    });
    setErrors({});
    toast.success("Sample test bank details loaded! Click 'Save & Submit' to activate.", { icon: "🧪" });
  };

  const validate = () => {
    const errs = {};
    if (!form.accountHolderName.trim()) errs.accountHolderName = "Account holder name is required";
    if (!form.accountNumber.trim()) errs.accountNumber = "Account number is required";
    else if (form.accountNumber.trim().length < 8) errs.accountNumber = "Account number must be at least 8 digits";

    if (form.accountNumber !== form.confirmAccountNumber) {
      errs.confirmAccountNumber = "Account numbers do not match";
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!form.ifsc.trim()) {
      errs.ifsc = "IFSC code is required";
    } else if (!ifscRegex.test(form.ifsc.trim().toUpperCase())) {
      errs.ifsc = "Invalid IFSC format. Must match AAAA0XXXXXX (e.g. HDFC0001234)";
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!form.pan.trim()) {
      errs.pan = "PAN number is required";
    } else if (!panRegex.test(form.pan.trim().toUpperCase())) {
      errs.pan = "Invalid PAN format. Must match AAAAA9999A (e.g. ABCDE1234F)";
    }

    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!form.postalCode.trim()) {
      errs.postalCode = "PIN code is required";
    } else if (!pinRegex.test(form.postalCode.trim())) {
      errs.postalCode = "Invalid 6-digit Indian PIN code";
    }

    if (!form.address.trim()) errs.address = "Address is required";
    if (!form.city.trim()) errs.city = "City is required";
    if (!form.state.trim()) errs.state = "State is required";

    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      errs.phone = "Valid 10-digit mobile number is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim() || !emailRegex.test(form.email.trim())) {
      errs.email = "Valid email address is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the errors in the payout form.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        ifsc: form.ifsc.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
      };

      const res = await API.post("/payments/doctor/payout-setup", payload);
      const data = res.data?.data || res.data;
      setPayoutInfo(data);
      setIsEditing(false);
      // Clear raw sensitive inputs from local component memory
      setForm((prev) => ({
        ...prev,
        accountNumber: "",
        confirmAccountNumber: "",
      }));
      toast.success("Payout details submitted successfully! Verification pending.");
    } catch (err) {
      console.error("Payout setup error:", err);
      toast.error(err.response?.data?.message || "Failed to submit payout details.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for dev simulation
  const handleSimulateStatus = async (simulatedStatus, reason = "") => {
    try {
      const res = await API.post("/payments/doctor/simulate-status", {
        status: simulatedStatus,
        reason,
      });
      setPayoutInfo(res.data?.data || res.data);
      toast.success(`Simulated payout status changed to: ${simulatedStatus}`);
    } catch (err) {
      toast.error("Failed to simulate status");
    }
  };

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-xs font-semibold">Loading payout information...</p>
        </div>
      </div>
    );
  }

  const currentStatus = payoutInfo.payoutStatus || "not_submitted";
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.not_submitted;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Status Banner ── */}
      <div className={`card p-6 border ${statusCfg.border} ${statusCfg.bg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${statusCfg.dot} animate-pulse`} />
              <span className={`text-xs font-black uppercase tracking-wider ${statusCfg.text}`}>
                Payout Status:
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${statusCfg.border} ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {statusCfg.desc}
            </p>
            {currentStatus === "rejected" && payoutInfo.payoutRejectionReason && (
              <div className="mt-2 p-2.5 bg-rose-100/70 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
                <strong>Reason:</strong> {payoutInfo.payoutRejectionReason}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentStatus !== "not_submitted" && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn-secondary text-xs px-3.5 py-2 font-bold bg-white hover:bg-slate-50"
              >
                ✏️ Update Details
              </button>
            )}
          </div>
        </div>

        {/* Masked Summary if submitted & not editing */}
        {payoutInfo.bankDetailsMasked && !isEditing && (
          <div className="mt-5 pt-4 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Account Holder</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {payoutInfo.bankDetailsMasked.accountHolderName || "—"}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Bank Account</span>
              <span className="font-extrabold text-slate-800 text-sm tracking-wider font-mono">
                •••• •••• {payoutInfo.bankDetailsMasked.accountNumberLast4 || "••••"}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">IFSC Code</span>
              <span className="font-extrabold text-slate-800 text-sm font-mono">
                {payoutInfo.bankDetailsMasked.ifsc || "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Testing / Simulation Controls ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="text-base">🧪</span>
          <span className="font-bold">Test Payout Status Simulation:</span>
          <span className="text-slate-400 text-[11px]">(Simulate Route activation or rejection during testing)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleSimulateStatus("activated")}
            className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold transition-colors"
          >
            ✓ Set Activated
          </button>
          <button
            type="button"
            onClick={() => handleSimulateStatus("pending")}
            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold transition-colors"
          >
            ⏳ Set Pending
          </button>
          <button
            type="button"
            onClick={() => handleSimulateStatus("rejected", "PAN name mismatch with bank record")}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-bold transition-colors"
          >
            ✕ Set Rejected
          </button>
        </div>
      </div>

      {/* ── Form Section ── */}
      {isEditing && (
        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span>💳</span> Bank Payout Details
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Razorpay Route requires these details to verify your identity and deposit consultation fees directly into your Indian bank account.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillSample}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-colors flex items-center gap-1.5 self-start sm:self-center shrink-0"
              title="Auto-fill verified Indian test bank details"
            >
              <span>🧪</span> Fill Sample Test Details
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Account Holder Name */}
            <div className="sm:col-span-2">
              <label className="input-label">Account Holder Name (as in Bank Records) *</label>
              <input
                type="text"
                value={form.accountHolderName}
                onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                placeholder="Dr. John Doe"
                className={`input ${errors.accountHolderName ? "border-rose-400" : ""}`}
              />
              {errors.accountHolderName && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.accountHolderName}</p>}
            </div>

            {/* Bank Account Number */}
            <div>
              <label className="input-label">Bank Account Number *</label>
              <input
                type="password"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="Enter bank account number"
                className={`input font-mono ${errors.accountNumber ? "border-rose-400" : ""}`}
              />
              {errors.accountNumber && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.accountNumber}</p>}
            </div>

            {/* Confirm Bank Account Number */}
            <div>
              <label className="input-label">Confirm Bank Account Number *</label>
              <input
                type="text"
                value={form.confirmAccountNumber}
                onChange={(e) => setForm({ ...form, confirmAccountNumber: e.target.value })}
                placeholder="Re-enter bank account number"
                className={`input font-mono ${errors.confirmAccountNumber ? "border-rose-400" : ""}`}
              />
              {errors.confirmAccountNumber && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.confirmAccountNumber}</p>}
            </div>

            {/* IFSC Code */}
            <div>
              <label className="input-label">Bank IFSC Code *</label>
              <input
                type="text"
                maxLength={11}
                value={form.ifsc}
                onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
                className={`input uppercase font-mono ${errors.ifsc ? "border-rose-400" : ""}`}
              />
              <p className="text-[10px] text-slate-400 mt-1">Format: 4 letters, 0, 6 alphanumeric (e.g., SBIN0001234)</p>
              {errors.ifsc && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.ifsc}</p>}
            </div>

            {/* PAN Card */}
            <div>
              <label className="input-label">PAN Number *</label>
              <input
                type="text"
                maxLength={10}
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                className={`input uppercase font-mono ${errors.pan ? "border-rose-400" : ""}`}
              />
              <p className="text-[10px] text-slate-400 mt-1">Format: 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F)</p>
              {errors.pan && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.pan}</p>}
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="input-label">Registered Clinic / Residential Address *</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Flat / Street / Area"
                className={`input ${errors.address ? "border-rose-400" : ""}`}
              />
              {errors.address && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.address}</p>}
            </div>

            {/* City */}
            <div>
              <label className="input-label">City *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Hyderabad"
                className={`input ${errors.city ? "border-rose-400" : ""}`}
              />
              {errors.city && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.city}</p>}
            </div>

            {/* State */}
            <div>
              <label className="input-label">State *</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="Telangana"
                className={`input ${errors.state ? "border-rose-400" : ""}`}
              />
              {errors.state && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.state}</p>}
            </div>

            {/* PIN Code */}
            <div>
              <label className="input-label">Postal PIN Code (6 digits) *</label>
              <input
                type="text"
                maxLength={6}
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })}
                placeholder="500001"
                className={`input font-mono ${errors.postalCode ? "border-rose-400" : ""}`}
              />
              {errors.postalCode && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.postalCode}</p>}
            </div>

            {/* Mobile */}
            <div>
              <label className="input-label">Contact Mobile *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="9876543210"
                className={`input ${errors.phone ? "border-rose-400" : ""}`}
              />
              {errors.phone && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="sm:col-span-2">
              <label className="input-label">Settlement Notification Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="doctor@example.com"
                className={`input ${errors.email ? "border-rose-400" : ""}`}
              />
              {errors.email && <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2">
            <span className="text-base flex-shrink-0">🔒</span>
            <p className="leading-relaxed">
              <strong>Bank Security & Privacy:</strong> Full account numbers and PANs are encrypted and securely submitted directly to Razorpay Route for linked account creation. BookDoctor never stores full account numbers or PANs on our database servers.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            {payoutInfo.payoutStatus !== "not_submitted" && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary text-xs px-4 py-2 font-bold"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-xs px-6 py-2.5 font-bold"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting to Razorpay...
                </span>
              ) : (
                "Save & Submit Payout Details"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
