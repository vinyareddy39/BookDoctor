import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../../services/api";
import { exportPrescriptionToPDF } from "../../utils/export";

const STATUS_CONFIG = {
  pending:   { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-400",  label: "Pending" },
  confirmed: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-500",  label: "Confirmed" },
  cancelled: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500",    label: "Cancelled" },
  completed: { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500",   label: "Completed" },
};

export default function AppointmentCard({ appointment }) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [rating, setRating] = useState(appointment?.rating || 5);
  const [review, setReview] = useState(appointment?.review || "");
  const [submittedFeedback, setSubmittedFeedback] = useState(
    appointment?.rating ? { rating: appointment.rating, review: appointment.review } : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  
  // Local state for status updates (to avoid full refetch)
  const [currentStatus, setCurrentStatus] = useState((appointment?.status || "pending").toLowerCase());
  const [currentDate, setCurrentDate] = useState(appointment?.appointmentDate);
  const [currentTime, setCurrentTime] = useState(appointment?.appointmentTime);

  const isDoctorView = window.location.pathname.includes("/dashboard");
  const dependent = appointment.dependentId
    ? appointment.patientId?.dependents?.find(d => d._id === appointment.dependentId)
    : null;
  const forName = dependent ? dependent.name : appointment.patientId?.name;

  const doc            = appointment?.doctorId;
  const doctorName     = doc?.userId?.name || doc?.name || "Doctor";
  const specialization = doc?.specialization || "General Physician";
  const fee            = doc?.consultationFee;
  const city           = doc?.city || "";
  const clinicName     = doc?.clinicName || "";
  const initials       = doctorName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const rawDate = currentDate;
  const date    = rawDate
    ? new Date(rawDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";
  const time    = currentTime || "TBD";
  const status  = currentStatus;
  const payment = appointment?.paymentStatus || "pending";
  const [localPaymentStatus, setLocalPaymentStatus] = useState(payment);

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  // Load Razorpay Script
  useEffect(() => {
    if (localPaymentStatus !== "paid" && !isDoctorView) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [localPaymentStatus, isDoctorView]);

  const handlePayment = async () => {
    try {
      if (!window.Razorpay) {
        toast.error("Razorpay SDK failed to load. Are you online?");
        return;
      }

      // 1. Create order on backend
      const res = await API.post("/payments/create-order", {
        amount: fee,
        currency: "INR",
        appointmentId: appointment._id,
      });

      const { order_id, amount, currency, key_id, demoMode } = res.data.data || res.data;

      if (demoMode) {
        toast.success("Demo Mode: Payment successful!");
        setLocalPaymentStatus("paid");
        return;
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: "BookDoctor",
        description: `Payment for appointment with Dr. ${doctorName}`,
        order_id: order_id,
        handler: async function (response) {
          // 3. Verify payment on backend
          try {
            await API.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful!");
            setLocalPaymentStatus("paid");
          } catch (err) {
            toast.error("Payment verification failed.");
          }
        },
        prefill: {
          name: forName,
          email: appointment.patientId?.email || "",
          contact: appointment.patientId?.phone || "",
        },
        theme: {
          color: "#3b82f6",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        toast.error(response.error.description || "Payment failed");
      });
      rzp.open();
    } catch (error) {
      toast.error("Could not initiate payment. Please try again.");
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await API.patch(`/appointments/${appointment._id}/feedback`, { rating, review });
      setSubmittedFeedback({ rating, review });
      setShowFeedbackForm(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await API.patch(`/appointments/${appointment._id}/cancel`);
      setCurrentStatus("cancelled");
      setShowCancelModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDate || !newTime) return;
    setRescheduling(true);
    try {
      await API.patch(`/appointments/${appointment._id}/reschedule`, {
        appointmentDate: newDate,
        appointmentTime: newTime,
      });
      setCurrentDate(newDate);
      setCurrentTime(newTime);
      setShowRescheduleModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 px-5 py-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-lg font-extrabold text-primary-600 shadow-sm flex-shrink-0">
            {isDoctorView ? (appointment.patientId?.name?.charAt(0) || "P") : initials}
          </div>
          {isDoctorView ? (
            <div className="flex-1 min-w-0">
              <h4 className="font-extrabold text-slate-800 truncate">{appointment.patientId?.name || "Unknown Patient"}</h4>
              <p className="text-sm text-secondary-600 font-medium">Booking for: {forName}</p>
            </div>
          ) : (
            <Link to={`/book-appointment/${doc._id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <h4 className="font-extrabold text-slate-800 truncate hover:text-primary-600 transition-colors">Dr. {doctorName}</h4>
              <p className="text-sm text-secondary-600 font-medium">{specialization}</p>
            </Link>
          )}
          {/* Status Badge */}
          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border} flex-shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></span>
            {sc.label}
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold text-slate-700">{date}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">{time}</span>
          </div>

          {/* City / Clinic */}
          {(clinicName || city) && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-500 truncate">{clinicName ? `${clinicName}, ` : ""}{city}</span>
            </div>
          )}

          {/* Privacy Notice for Patient */}
          {!isDoctorView && status !== "completed" && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-100">
              <span>🔒</span>
              <span>Your phone number is hidden from the doctor until the appointment is completed.</span>
            </div>
          )}

          {/* Feedback Display */}
          {submittedFeedback && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-slate-500">Your Rating:</span>
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-3.5 h-3.5 ${i < submittedFeedback.rating ? "fill-current" : "text-slate-200 stroke-current"}`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
              </div>
              {submittedFeedback.review && (
                <p className="text-xs text-slate-600 italic">"{submittedFeedback.review}"</p>
              )}
            </div>
          )}

          {/* Prescription Display */}
          {appointment?.prescription && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2 relative group">
              <div className="flex items-center justify-between gap-1.5 text-blue-800 font-bold text-xs">
                <span>📝 Prescription / Medical Notes:</span>
                <button 
                  onClick={() => exportPrescriptionToPDF(appointment, doctorName)}
                  className="bg-white hover:bg-blue-100 text-blue-600 px-2 py-1 rounded shadow-sm text-[10px] transition-colors"
                >
                  Download PDF
                </button>
              </div>
              <p className="text-xs text-blue-700 whitespace-pre-wrap leading-relaxed">{appointment.prescription}</p>
            </div>
          )}

          {/* Patient View Info (Booking For) */}
          {!isDoctorView && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Booking For:</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{forName}</span>
            </div>
          )}

          {/* Join Call Button */}
          {status === "confirmed" && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link 
                to={`/room/${appointment._id}`}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/30 transition-all"
              >
                <span>🎥</span> Join Video Consultation
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer & Feedback Actions */}
      <div className="flex flex-col border-t border-slate-100 bg-slate-50">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs">Fee</span>
            <span className="text-primary-700 font-extrabold text-sm">₹{fee ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              localPaymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}>
              {localPaymentStatus === "paid" ? "✓ Paid" : "Unpaid"}
            </span>

            {/* Pay Now Button (Patient Only) */}
            {localPaymentStatus !== "paid" && !isDoctorView && (
              <button
                onClick={handlePayment}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors"
              >
                Pay Now
              </button>
            )}

            {/* Give feedback button if completed and no feedback yet */}
            {status === "completed" && !submittedFeedback && !showFeedbackForm && (
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors"
              >
                Rate Appointment
              </button>
            )}

            {/* Cancel & Reschedule buttons if pending or confirmed */}
            {(status === "pending" || status === "confirmed") && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRescheduleModal(true)}
                  className="bg-primary-100 hover:bg-primary-200 text-primary-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="btn-danger text-xs px-3 py-1.5 shadow-none hover:-translate-y-0"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Feedback Form */}
        {showFeedbackForm && (
          <form onSubmit={handleSubmitFeedback} className="px-5 pb-4 space-y-3 border-t border-slate-100 pt-3 bg-white">
            <h5 className="text-xs font-bold text-slate-700">Submit Your Feedback</h5>
            {error && <p className="text-xs text-red-600">{error}</p>}
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rating:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-amber-400 focus:outline-none"
                  >
                    <svg
                      className={`w-6 h-6 ${star <= rating ? "fill-current" : "text-slate-200 stroke-current"}`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Write your review here..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="px-2.5 py-1.5 text-xs text-slate-500 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-fade-in-up">
            <h3 className="text-lg font-black text-slate-800 mb-2">Cancel Appointment?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Are you sure you want to cancel your appointment with Dr. {doctorName} on {date} at {time}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="btn-danger flex-1 py-2 text-sm"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleReschedule} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-fade-in-up space-y-4">
            <h3 className="text-lg font-black text-slate-800">Reschedule Appointment</h3>
            <p className="text-slate-500 text-sm">
              Select a new date and time slot for your appointment with Dr. {doctorName}.
            </p>
            <div>
              <label className="input-label">Select Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Select Time Slot</label>
              <select
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                required
                className="input"
              >
                <option value="">Choose a slot...</option>
                {["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rescheduling}
                className="btn-primary flex-1 py-2 text-sm"
              >
                {rescheduling ? "Saving..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
