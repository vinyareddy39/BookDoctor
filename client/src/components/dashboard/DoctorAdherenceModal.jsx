import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";

export default function DoctorAdherenceModal({ prescriptionId, patientName, onClose, onOpenChat }) {
  const [loading, setLoading] = useState(true);
  const [adherence, setAdherence] = useState(null);

  useEffect(() => {
    if (!prescriptionId) return;
    const fetchAdherence = async () => {
      try {
        setLoading(true);
        const res = await API.get(`/prescriptions/${prescriptionId}/adherence`);
        setAdherence(res.data.data || res.data);
      } catch (err) {
        toast.error("Failed to load adherence statistics");
      } finally {
        setLoading(false);
      }
    };
    fetchAdherence();
  }, [prescriptionId]);

  if (!prescriptionId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-lg font-black text-slate-800">Recovery Adherence Tracking</h3>
            <p className="text-xs text-slate-500">Patient: <span className="font-semibold text-slate-700">{patientName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-lg font-bold"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 animate-pulse text-sm">
            Calculating adherence metrics...
          </div>
        ) : !adherence ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No adherence records found yet.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Experimental Disclaimer Banner */}
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center justify-between">
              <span>📊 Adherence Score: <strong className="text-sm">{adherence.adherenceScore}%</strong></span>
              <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded font-medium">
                Experimental – not a clinical risk estimate
              </span>
            </div>

            {/* Consecutive Miss Alert */}
            {adherence.hasConsecutiveMissAlert && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-bold">Consecutive Missed Doses Alert</p>
                  <p className="mt-0.5 text-rose-700">Patient has {adherence.consecutiveMissed} unconfirmed or skipped doses in a row. A follow-up check-in is recommended.</p>
                </div>
              </div>
            )}

            {/* Summary Counters */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-400">Total Due</div>
                <div className="text-lg font-black text-slate-800">{adherence.totalDue}</div>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-xs text-emerald-600">On Time</div>
                <div className="text-lg font-black text-emerald-700">{adherence.takenOnTime}</div>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-xs text-amber-600">Late</div>
                <div className="text-lg font-black text-amber-700">{adherence.takenLate}</div>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                <div className="text-xs text-rose-600">Missed/Unconf</div>
                <div className="text-lg font-black text-rose-700">{adherence.skipped + adherence.notConfirmed}</div>
              </div>
            </div>

            {/* Safety & Self-Reported Disclaimer */}
            <p className="text-[11px] text-slate-400 italic text-center">
              * Dose check-ins are self-reported by the patient or caregiver, not proof of ingestion.
            </p>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenChat("Hello! Checking in on your recovery and medication schedule. Please let me know how you are feeling.");
                  }}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  💬 Send Check-in Message
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
