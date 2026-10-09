import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";
import { exportPrescriptionToPDF } from "../../utils/export";
import MedicalTimeline from "../appointment/MedicalTimeline.jsx";
import ChatWindow from "../chat/ChatWindow.jsx";
import RescheduleModal from "../appointment/RescheduleModal.jsx";
import DoctorAdherenceModal from "./DoctorAdherenceModal.jsx";

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

const FREQUENCY_OPTIONS = [
  { label: "Twice daily (08:00, 20:00)", value: "Twice daily", times: ["08:00", "20:00"] },
  { label: "Morning (08:00)", value: "Morning", times: ["08:00"] },
  { label: "Afternoon (13:00)", value: "Afternoon", times: ["13:00"] },
  { label: "Evening (18:00)", value: "Evening", times: ["18:00"] },
  { label: "Night (21:00)", value: "Night", times: ["21:00"] },
  { label: "Thrice daily (08:00, 14:00, 20:00)", value: "Thrice daily", times: ["08:00", "14:00", "20:00"] },
  { label: "Four times daily", value: "Four times daily", times: ["08:00", "12:00", "16:00", "20:00"] },
  { label: "As needed (SOS)", value: "As needed", times: ["08:00"] },
];

function PrescriptionEditor({ appointment, doctorName, onOpenChat }) {
  const [notes, setNotes] = useState(appointment.prescription || "");
  const [medications, setMedications] = useState([]);
  const [prescriptionDoc, setPrescriptionDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [showAdherenceModal, setShowAdherenceModal] = useState(false);
  const [adherenceStats, setAdherenceStats] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadPrescription = async () => {
      try {
        const res = await API.get(`/prescriptions/by-appointment/${appointment._id}`);
        const p = res.data?.data || res.data;
        if (p && isMounted) {
          setPrescriptionDoc(p);
          if (p.notes) setNotes(p.notes);
          if (Array.isArray(p.medications) && p.medications.length > 0) {
            setMedications(p.medications);
          }
          if (p.status === "active") {
            try {
              const adhRes = await API.get(`/prescriptions/${p._id}/adherence`);
              if (isMounted) setAdherenceStats(adhRes.data?.data || adhRes.data);
            } catch (adhErr) {
              console.debug("Adherence not available yet:", adhErr?.message);
            }
          }
        }
      } catch (_) {
        // Fallback to appointment prescription notes
      } finally {
        if (isMounted) setLoadingDoc(false);
      }
    };
    loadPrescription();
    return () => { isMounted = false; };
  }, [appointment._id]);

  const addMedicationRow = () => {
    setMedications((prev) => [
      ...prev,
      {
        drug: "",
        strength: "",
        dose: "1 tablet",
        frequency: "Twice daily",
        times: ["08:00", "20:00"],
        durationDays: 5,
        timing: "after_food",
        instructions: "after food",
        startDate: new Date().toISOString().split("T")[0],
      },
    ]);
  };

  const removeMedicationRow = (idx) => {
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMedication = (idx, field, value) => {
    setMedications((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === "frequency") {
        const match = FREQUENCY_OPTIONS.find((f) => f.value === value);
        if (match) updated[idx].times = match.times;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    // Inline validation
    for (let i = 0; i < medications.length; i++) {
      const m = medications[i];
      if (!m.drug || !m.drug.trim()) {
        toast.error(`Medication #${i + 1}: Drug name is required.`);
        return;
      }
      if (!m.durationDays || Number(m.durationDays) <= 0) {
        toast.error(`Medication "${m.drug}": Duration must be at least 1 day.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        appointmentId: appointment._id,
        patientId: appointment.patientId?._id || appointment.patientId,
        medications,
        notes,
      };

      const res = await API.post("/prescriptions", payload);
      const savedDoc = res.data?.data || res.data;
      setPrescriptionDoc(savedDoc);
      toast.success(
        savedDoc.version > 1
          ? `Updated recovery plan (v${savedDoc.version}) shared with patient!`
          : "Prescription & Recovery Plan shared with patient!"
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    exportPrescriptionToPDF(
      {
        ...appointment,
        prescription: notes,
        medications,
      },
      doctorName
    );
  };

  return (
    <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
      {/* Header with Badges & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-bold text-slate-800 block">📝 Prescription & Clinical Notes</label>
          
          {prescriptionDoc?.sharedAt && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span>Shared ✓</span>
              {prescriptionDoc.version > 1 && <span>(v{prescriptionDoc.version})</span>}
              <span className="font-normal text-slate-500">
                · {new Date(prescriptionDoc.sharedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
          )}

          {adherenceStats && (
            <button
              type="button"
              onClick={() => setShowAdherenceModal(true)}
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors flex items-center gap-1.5"
            >
              <span>📊 Plan Active · {adherenceStats.adherenceScore}% Adherence</span>
              {adherenceStats.hasConsecutiveMissAlert && (
                <span className="text-rose-600 animate-pulse font-black" title="Consecutive Missed Doses Alert">⚠️</span>
              )}
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded shadow-sm text-xs font-bold transition-colors disabled:opacity-50"
          >
            {saving ? "Sharing..." : "Save & Share with Patient"}
          </button>
          <button 
            type="button"
            onClick={handleExport}
            className="bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 px-3 py-1.5 rounded shadow-sm text-xs font-bold transition-colors"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Free-text clinical notes */}
      <textarea
        placeholder="Enter clinical notes, diagnoses, general guidance..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full text-sm input p-3 border-slate-200 rounded-lg min-h-[70px] bg-white"
      />

      {/* Structured Medications Editor */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">💊 Structured Medications (RecoverTrack)</span>
            <span className="text-[10px] text-slate-400">Optional but recommended for automated adherence scheduling</span>
          </div>
          <button
            type="button"
            onClick={addMedicationRow}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded transition-colors"
          >
            + Add Medication
          </button>
        </div>

        {medications.length === 0 ? (
          <p className="text-xs text-slate-400 italic bg-white p-3 rounded-lg border border-dashed border-slate-200 text-center">
            No structured medications added yet. Click "+ Add Medication" above to add structured rows for the patient's recovery schedule.
          </p>
        ) : (
          <div className="space-y-2">
            {medications.map((m, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  {/* Drug Name */}
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Drug Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol"
                      value={m.drug || m.name || ""}
                      onChange={(e) => updateMedication(idx, "drug", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    />
                  </div>

                  {/* Strength */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Strength</label>
                    <input
                      type="text"
                      placeholder="e.g. 500 mg"
                      value={m.strength || ""}
                      onChange={(e) => updateMedication(idx, "strength", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    />
                  </div>

                  {/* Dose */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Dose</label>
                    <input
                      type="text"
                      placeholder="e.g. 1 tablet"
                      value={m.dose || m.dosage || "1 tablet"}
                      onChange={(e) => updateMedication(idx, "dose", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    />
                  </div>

                  {/* Frequency */}
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Frequency</label>
                    <select
                      value={m.frequency || "Twice daily"}
                      onChange={(e) => updateMedication(idx, "frequency", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Duration Days */}
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Duration (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={m.durationDays || 5}
                        onChange={(e) => updateMedication(idx, "durationDays", e.target.value)}
                        className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedicationRow(idx)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded self-end mb-0.5 transition-colors font-bold text-xs"
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs pt-1">
                  {/* Timing */}
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Timing</label>
                    <select
                      value={m.timing || "after_food"}
                      onChange={(e) => updateMedication(idx, "timing", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    >
                      <option value="after_food">After Food</option>
                      <option value="before_food">Before Food</option>
                      <option value="with_food">With Food</option>
                      <option value="bedtime">At Bedtime</option>
                      <option value="as_needed">As Needed (SOS)</option>
                    </select>
                  </div>

                  {/* Instructions */}
                  <div className="sm:col-span-6">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Instructions</label>
                    <input
                      type="text"
                      placeholder="e.g. Drink plenty of water"
                      value={m.instructions || ""}
                      onChange={(e) => updateMedication(idx, "instructions", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    />
                  </div>

                  {/* Start Date */}
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Start Date</label>
                    <input
                      type="date"
                      value={m.startDate ? String(m.startDate).split("T")[0] : new Date().toISOString().split("T")[0]}
                      onChange={(e) => updateMedication(idx, "startDate", e.target.value)}
                      className="w-full input px-2 py-1 text-xs border-slate-200 rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doctor Adherence Modal */}
      {showAdherenceModal && prescriptionDoc && (
        <DoctorAdherenceModal
          prescriptionId={prescriptionDoc._id}
          patientName={appointment.patientId?.name || "Patient"}
          onClose={() => setShowAdherenceModal(false)}
          onOpenChat={onOpenChat}
        />
      )}
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
  const [selectedChatAppt, setSelectedChatAppt] = useState(null);
  const [selectedRescheduleAppt, setSelectedRescheduleAppt] = useState(null);

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
                    className="text-xs font-bold px-3 py-2 min-h-[44px] rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-1.5"
                    title="Click to mark as Unpaid"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Paid ✓
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPaymentUpdate(a._id, "pending")}
                    className="text-xs font-bold px-3 py-2 min-h-[44px] rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                    title="Click to mark as Paid"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Unpaid ✗
                  </button>
                )}

                {/* Appointment action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {a.status === "pending" && (
                    <>
                      <button
                        onClick={() => onStatusUpdate(a._id, "confirmed")}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 min-h-[44px] rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center justify-center"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onStatusUpdate(a._id, "cancelled")}
                        className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2.5 min-h-[44px] rounded-xl font-bold transition-all border border-rose-200/50 flex items-center justify-center"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {a.status === "confirmed" && (
                    <button
                      onClick={() => onStatusUpdate(a._id, "completed")}
                      className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 min-h-[44px] rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center justify-center"
                    >
                      Complete Appointment
                    </button>
                  )}
                  {(a.status === "pending" || a.status === "confirmed") && (
                    <>
                      <button
                        onClick={() => setSelectedRescheduleAppt(a)}
                        className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-3.5 py-2.5 min-h-[44px] rounded-xl font-bold transition-all border border-slate-200 flex items-center justify-center"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => setSelectedChatAppt(a)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2.5 min-h-[44px] rounded-xl font-bold transition-all border border-blue-200 flex items-center justify-center gap-1.5"
                      >
                        💬 Chat
                      </button>
                    </>
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
              <PrescriptionEditor 
                appointment={a} 
                doctorName={a.doctorId?.userId?.name || "Doctor"} 
                onOpenChat={() => setSelectedChatAppt(a)}
              />
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
                aria-label="Close history modal"
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
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

      {/* Chat Modal */}
      {selectedChatAppt && (
        <ChatWindow 
          appointment={selectedChatAppt} 
          onClose={() => setSelectedChatAppt(null)} 
        />
      )}

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={!!selectedRescheduleAppt}
        onClose={() => setSelectedRescheduleAppt(null)}
        appointment={selectedRescheduleAppt}
        onSuccess={() => {
          setSelectedRescheduleAppt(null);
          // Usually we let the socket trigger a dashboard refresh, or we can force it here
        }}
      />
    </div>
  );
}
