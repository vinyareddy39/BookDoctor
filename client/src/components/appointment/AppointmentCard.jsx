import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../../services/api";

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

  const doc            = appointment?.doctorId;
  const doctorName     = doc?.userId?.name || doc?.name || "Doctor";
  const specialization = doc?.specialization || "General Physician";
  const fee            = doc?.consultationFee;
  const city           = doc?.city || "";
  const clinicName     = doc?.clinicName || "";
  const initials       = doctorName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const rawDate = appointment?.appointmentDate;
  const date    = rawDate
    ? new Date(rawDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";
  const time    = appointment?.appointmentTime || "TBD";
  const status  = (appointment?.status || "pending").toLowerCase();
  const payment = appointment?.paymentStatus || "pending";

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await API.put(`/appointments/${appointment._id}`, { rating, review });
      setSubmittedFeedback({ rating, review });
      setShowFeedbackForm(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 px-5 py-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-lg font-extrabold text-primary-600 shadow-sm flex-shrink-0">
            {initials}
          </div>
          <Link to={`/book-appointment/${doc._id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <h4 className="font-extrabold text-slate-800 truncate hover:text-primary-600 transition-colors">Dr. {doctorName}</h4>
            <p className="text-sm text-secondary-600 font-medium">{specialization}</p>
          </Link>
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
              payment === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}>
              {payment === "paid" ? "✓ Paid" : "Unpaid"}
            </span>

            {/* Give feedback button if completed and no feedback yet */}
            {status === "completed" && !submittedFeedback && !showFeedbackForm && (
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors"
              >
                Rate Appointment
              </button>
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
    </div>
  );
}
