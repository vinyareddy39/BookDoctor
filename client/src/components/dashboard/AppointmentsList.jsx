import React, { useState } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";
import { exportPrescriptionToPDF } from "../../utils/export";
import MedicalTimeline from "../appointment/MedicalTimeline.jsx";

/**
 * AppointmentsList — Renders the list of doctor appointments with action buttons
 * for accept/decline/complete and payment toggle.
 */

const STATUS_COLORS = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  completed: "bg-sky-50 text-sky-700 border-sky-200",
};

function PrescriptionEditor({ appointment, doctorName }) {
  const [text, setText] = useState(appointment.prescription || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.patch(`/appointments/${appointment._id}/prescription`, { prescription: text });
      toast.success("Prescription saved successfully!");
    } catch (err) {
      toast.error("Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    // Export with the CURRENT text in state
    exportPrescriptionToPDF({ ...appointment, prescription: text }, doctorName);
  };

  return (
    <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 block">📝 Prescription / Clinical Notes</label>
        <div className="flex gap-2">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded shadow-sm text-[10px] font-bold transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Notes"}
          </button>
          <button 
            onClick={handleExport}
            className="bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 px-3 py-1 rounded shadow-sm text-[10px] font-bold transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>
      <textarea
        placeholder="Enter medical prescription, dosage, guidelines..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full text-sm input p-3 border-slate-200 rounded-lg min-h-[80px]"
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-6 animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-3 w-3/4 rounded" />
    </div>
  );
}

export default function AppointmentsList({ appts, loading, onStatusUpdate, onPaymentUpdate }) {
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!appts || appts.length === 0) {
    return (
      <div className="card p-16 text-center">
        <div className="text-7xl mb-4">📭</div>
        <h3 className="text-xl font-black text-slate-700 mb-2">No Appointments Yet</h3>
        <p className="text-slate-500 text-sm">Your confirmed bookings will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {appts.map((a) => {
        const patient = a.patientId;
        const date = new Date(a.appointmentDate).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric",
        });

        return (
          <div key={a._id} className="card p-6 flex flex-col gap-5 hover:shadow-card-lg transition-shadow duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Patient Info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-xl font-bold border border-primary-100 flex-shrink-0">
                  {patient?.name?.charAt(0) || "P"}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-slate-800 text-base">{patient?.name || "Patient"}</p>
                    <button 
                      onClick={() => setSelectedPatientHistory(patient?._id)}
                      className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded hover:bg-primary-100 transition-colors"
                    >
                      View History
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{patient?.email} · {patient?.phone || "No phone"}</p>

                  {/* Patient health tags */}
                  {(patient?.dob || patient?.gender || patient?.bloodGroup || patient?.emergencyContact) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {patient?.dob &&
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded">DOB: {new Date(patient.dob).toLocaleDateString()}</span>
                      }
                      {patient?.gender &&
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded capitalize">{patient.gender}</span>
                      }
                      {patient?.bloodGroup &&
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 text-red-600 rounded">Blood: {patient.bloodGroup}</span>
                      }
                      {patient?.emergencyContact &&
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">Emergency: {patient.emergencyContact}</span>
                      }
                    </div>
                  )}

                  {/* Date & Time tags */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="badge-blue">📅 {date}</span>
                    <span className="badge-blue">⏰ {a.appointmentTime}</span>
                  </div>
                </div>
              </div>

              {/* Right: Status + Controls */}
              <div className="flex items-center gap-3 flex-wrap md:justify-end">
                <span className="text-sm font-black text-slate-700">₹{a.amount}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[a.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {a.status}
                </span>

                {/* Payment toggle */}
                {a.paymentStatus === "paid" ? (
                  <button
                    type="button"
                    onClick={() => onPaymentUpdate(a._id, "paid")}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-1.5"
                    title="Click to mark as Unpaid"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Paid ✓
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPaymentUpdate(a._id, "pending")}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                    title="Click to mark as Paid"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unpaid ✗
                  </button>
                )}

                {/* Appointment action buttons */}
                <div className="flex items-center gap-2">
                  {a.status === "pending" && (
                    <>
                      <button
                        onClick={() => onStatusUpdate(a._id, "confirmed")}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold shadow-sm hover:shadow transition-all"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onStatusUpdate(a._id, "cancelled")}
                        className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 rounded-xl font-bold transition-all border border-rose-200/50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {a.status === "confirmed" && (
                    <button
                      onClick={() => onStatusUpdate(a._id, "completed")}
                      className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-bold shadow-sm hover:shadow transition-all"
                    >
                      Complete Appointment
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Patient feedback (if completed & rated) */}
            {a.status === "completed" && a.rating && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl px-5 py-4">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Patient Feedback</p>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className={`w-4 h-4 ${i < a.rating ? "text-amber-400 fill-current" : "text-slate-200 stroke-current"}`} viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                  ))}
                  <span className="text-xs text-amber-800 font-bold ml-1">{a.rating}/5 Stars</span>
                </div>
                {a.review && <p className="text-sm text-slate-600 italic">"{a.review}"</p>}
              </div>
            )}

            {/* Prescription Form for Doctors */}
            {a.status === "completed" && (
              <PrescriptionEditor appointment={a} doctorName={a.doctorId?.userId?.name || "Doctor"} />
            )}
          </div>
        );
      })}

      {/* Patient History Modal */}
      {selectedPatientHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-800">Patient Medical History</h3>
              <button 
                onClick={() => setSelectedPatientHistory(null)}
                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
              <MedicalTimeline appointments={appts.filter(a => a.patientId?._id === selectedPatientHistory)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
