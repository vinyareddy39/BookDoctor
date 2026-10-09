import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

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

export default function RecoveryPlan() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const caregiverFor = searchParams.get("caregiverFor");

  const [activeTab, setActiveTab] = useState("today"); // "today" | "review" | "history" | "caregiver"
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [todayDoses, setTodayDoses] = useState([]);
  const [doseHistory, setDoseHistory] = useState([]);
  const [adherenceData, setAdherenceData] = useState(null);
  const [caregiverLinks, setCaregiverLinks] = useState({ myCaregivers: [], patientsIcareFor: [] });
  
  // Review & Confirm state
  const [editableMeds, setEditableMeds] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Caregiver invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRelation, setInviteRelation] = useState("family");
  const [inviting, setInviting] = useState(false);

  // Filter state for history
  const [historyFilterDrug, setHistoryFilterDrug] = useState("");
  const [historyFilterStatus, setHistoryFilterStatus] = useState("");

  const patientQueryParam = caregiverFor ? `?patientId=${caregiverFor}` : "";

  // 1. Fetch Plan & Today's Doses
  const fetchData = async () => {
    try {
      setLoading(true);
      const [planRes, todayRes, linksRes] = await Promise.all([
        API.get(`/prescriptions/patient/plan${patientQueryParam}`),
        API.get(`/dose-events/today${patientQueryParam}`),
        API.get(`/caregiver/links`),
      ]);

      const plan = planRes.data?.data?.currentPlan || planRes.data?.currentPlan || null;
      setCurrentPlan(plan);
      setTodayDoses(todayRes.data?.data || todayRes.data || []);
      setCaregiverLinks(linksRes.data?.data || linksRes.data || { myCaregivers: [], patientsIcareFor: [] });

      if (plan) {
        if (plan.status === "shared" || plan.status === "draft") {
          setActiveTab("review");
          initializeEditableMeds(plan);
        }

        // Fetch adherence summary
        try {
          const adhRes = await API.get(`/prescriptions/${plan._id}/adherence`);
          setAdherenceData(adhRes.data?.data || adhRes.data);
        } catch (adhErr) {
          console.debug("Adherence summary not yet active:", adhErr?.message);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load recovery plan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caregiverFor]);

  // Initialize editable meds from plan
  const initializeEditableMeds = (plan) => {
    if (Array.isArray(plan.medications) && plan.medications.length > 0) {
      setEditableMeds(
        plan.medications.map((m) => ({
          ...m,
          drug: m.drug || m.name || "",
          strength: m.strength || "",
          dose: m.dose || m.dosage || "1 tablet",
          frequency: m.frequency || "Twice daily",
          times: Array.isArray(m.times) && m.times.length > 0 ? m.times : ["08:00", "20:00"],
          durationDays: m.durationDays || 5,
          timing: m.timing || "after_food",
          instructions: m.instructions || "",
          startDate: m.startDate ? String(m.startDate).split("T")[0] : new Date().toISOString().split("T")[0],
          fieldConfidence: m.fieldConfidence || { drug: 1, strength: 1, dose: 1, frequency: 1, durationDays: 1 },
        }))
      );
    } else {
      setEditableMeds([]);
    }
  };

  // Run Draft Extraction (if meds not yet structured)
  const handleExtractMeds = async () => {
    if (!currentPlan) return;
    setExtracting(true);
    try {
      const res = await API.post(`/prescriptions/${currentPlan._id}/extract`);
      const extracted = res.data?.data?.medications || res.data?.medications || [];
      if (extracted.length > 0) {
        setEditableMeds(extracted);
        toast.success(`Draft medications extracted! Please review every field before starting reminders.`);
      } else {
        toast.error("No medication patterns detected in prescription text. Please add medications manually.");
      }
    } catch (err) {
      toast.error("Failed to extract medications.");
    } finally {
      setExtracting(false);
    }
  };

  // Confirm schedule
  const handleConfirmSchedule = async () => {
    if (editableMeds.length === 0) {
      toast.error("Please add or extract at least one medication.");
      return;
    }

    // Safety validation
    for (let i = 0; i < editableMeds.length; i++) {
      const m = editableMeds[i];
      if (!m.drug || !m.drug.trim()) {
        toast.error(`Medication #${i + 1}: Drug name is required and needs clarification.`);
        return;
      }
      if (!m.strength || !m.strength.trim()) {
        toast.error(`Medication "${m.drug}": Strength (e.g. 500 mg) is required and needs clarification.`);
        return;
      }
      if (!m.dose || !m.dose.trim()) {
        toast.error(`Medication "${m.drug}": Dose (e.g. 1 tablet) is required.`);
        return;
      }
      if (!m.frequency || !m.frequency.trim()) {
        toast.error(`Medication "${m.drug}": Frequency is required.`);
        return;
      }
      if (!m.durationDays || Number(m.durationDays) <= 0) {
        toast.error(`Medication "${m.drug}": Duration must be at least 1 day.`);
        return;
      }
    }

    setConfirming(true);
    try {
      const res = await API.post(`/prescriptions/${currentPlan._id}/confirm`, {
        medications: editableMeds,
      });
      toast.success(res.data?.message || "Recovery schedule activated!");
      await fetchData();
      setActiveTab("today");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm schedule.");
    } finally {
      setConfirming(false);
    }
  };

  // Dose Check-In (Taken / Skipped)
  const handleCheckIn = async (doseId, status) => {
    try {
      await API.post(`/dose-events/${doseId}/checkin`, { status });
      toast.success(`Dose marked as ${status === "taken" ? "Taken ✓" : "Skipped ✗"}`);
      // Refresh today's doses & adherence
      const todayRes = await API.get(`/dose-events/today${patientQueryParam}`);
      setTodayDoses(todayRes.data?.data || todayRes.data || []);
      if (currentPlan) {
        const adhRes = await API.get(`/prescriptions/${currentPlan._id}/adherence`);
        setAdherenceData(adhRes.data?.data || adhRes.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in failed.");
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    try {
      let url = `/dose-events/history?patientId=${caregiverFor || user?._id}`;
      if (historyFilterDrug) url += `&drug=${encodeURIComponent(historyFilterDrug)}`;
      if (historyFilterStatus) url += `&status=${encodeURIComponent(historyFilterStatus)}`;
      const res = await API.get(url);
      setDoseHistory(res.data?.data || res.data || []);
    } catch (err) {
      toast.error("Failed to load dose history.");
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, historyFilterDrug, historyFilterStatus]);

  // Caregiver invite
  const handleInviteCaregiver = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await API.post("/caregiver/invite", {
        email: inviteEmail,
        caregiverName: inviteName,
        relationship: inviteRelation,
      });
      toast.success(`Caregiver invitation granted for ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      const linksRes = await API.get("/caregiver/links");
      setCaregiverLinks(linksRes.data?.data || linksRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to invite caregiver.");
    } finally {
      setInviting(false);
    }
  };

  // Revoke caregiver
  const handleRevokeCaregiver = async (linkId) => {
    if (!window.confirm("Are you sure you want to revoke this caregiver's access?")) return;
    try {
      await API.patch(`/caregiver/links/${linkId}/revoke`);
      toast.success("Caregiver access revoked.");
      const linksRes = await API.get("/caregiver/links");
      setCaregiverLinks(linksRes.data?.data || linksRes.data);
    } catch (err) {
      toast.error("Failed to revoke caregiver access.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-semibold text-sm">Loading your recovery plan...</p>
        </div>
      </div>
    );
  }

  const patientName = currentPlan?.patientId?.name || "Patient";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Caregiver Header Banner */}
        {caregiverFor && (
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <p className="font-extrabold text-sm">Viewing as Caregiver for {patientName}</p>
                <p className="text-xs text-amber-100">You have verified permission to review medication schedules and record check-ins.</p>
              </div>
            </div>
            <Link
              to="/recovery-plan"
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
            >
              Back to My Own Plan
            </Link>
          </div>
        )}

        {/* Mandatory Safety Disclaimer Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-base text-blue-600">🛡️</span>
            <div>
              <p className="font-bold">Medical Safety & Tool Disclaimer</p>
              <p className="text-blue-800/90 mt-0.5">
                This is a reminder tool. Follow your doctor's instructions. Contact your doctor if unsure. Never double or alter a medication dose.
              </p>
            </div>
          </div>
          {adherenceData && (
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="bg-white border border-blue-200 px-3 py-1 rounded-full text-xs font-black text-blue-900">
                Score: {adherenceData.adherenceScore}%
              </span>
              <span className="text-[10px] text-blue-600 font-medium italic">
                Experimental – not a clinical risk estimate
              </span>
            </div>
          )}
        </div>

        {/* Main Dashboard Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Header & Tabs */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-slate-800">RecoverTrack Plan</h1>
                {currentPlan && (
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full capitalize ${
                    currentPlan.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    currentPlan.status === "shared" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                    "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {currentPlan.status} Plan {currentPlan.version > 1 ? `(v${currentPlan.version})` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Post-prescription medication scheduling, timely reminders, and self-reported adherence.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl self-start md:self-auto overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab("today")}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "today" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ⏰ Today's Schedule ({todayDoses.length})
              </button>
              
              {currentPlan && (currentPlan.status === "shared" || currentPlan.status === "draft" || activeTab === "review") && (
                <button
                  type="button"
                  onClick={() => setActiveTab("review")}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                    activeTab === "review" ? "bg-white text-primary-700 shadow-xs" : "text-primary-600 hover:text-primary-700"
                  }`}
                >
                  📝 Review & Confirm
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "history" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📊 Dose History
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("caregiver")}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "caregiver" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🤝 Caregivers
              </button>
            </div>
          </div>

          {/* TAB 1: TODAY'S SCHEDULE */}
          {activeTab === "today" && (
            <div className="p-6 space-y-6">
              {!currentPlan ? (
                <div className="py-16 text-center space-y-3">
                  <div className="text-5xl">📋</div>
                  <h3 className="text-lg font-bold text-slate-700">No Active Recovery Plan</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Once your doctor shares a prescription from your completed appointment, your reviewed medication schedule will appear here.
                  </p>
                  <Link
                    to="/appointments"
                    className="inline-block mt-2 bg-primary-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
                  >
                    View My Appointments
                  </Link>
                </div>
              ) : currentPlan.status === "shared" || currentPlan.status === "draft" ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="text-4xl">⚠️</div>
                  <h3 className="text-base font-bold text-amber-900">New Prescription Awaiting Your Review</h3>
                  <p className="text-xs text-amber-800 max-w-lg mx-auto">
                    A safety review is required before reminders start. Please verify every medication name, strength, dose, and frequency.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("review")}
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
                  >
                    Review & Confirm Schedule Now
                  </button>
                </div>
              ) : todayDoses.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-4xl">✨</div>
                  <h3 className="text-base font-bold text-slate-700">All Done for Today!</h3>
                  <p className="text-xs text-slate-400">No more doses scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                      Today's Dose Timeline
                    </h2>
                    <span className="text-[11px] text-slate-400 italic">
                      * All check-ins are self-reported, not proof of ingestion.
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {todayDoses.map((dose) => (
                      <div
                        key={dose._id}
                        className={`p-4 rounded-2xl border transition-all ${
                          dose.status === "taken" ? "bg-emerald-50/40 border-emerald-200" :
                          dose.status === "skipped" ? "bg-rose-50/40 border-rose-200" :
                          dose.status === "not_confirmed" ? "bg-amber-50/50 border-amber-200" :
                          "bg-white border-slate-200 shadow-xs hover:border-primary-200"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex flex-col items-center justify-center font-bold text-xs shrink-0 border border-primary-100">
                              <span>{dose.scheduledTime}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base text-slate-800">{dose.drug}</h3>
                                {dose.strength && (
                                  <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                    {dose.strength}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Take <span className="font-bold text-slate-700">{dose.dose}</span>
                                {dose.instructions && ` · ${dose.instructions}`}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                {dose.status === "taken" && (
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>Taken ✓</span>
                                    {dose.recordedAt && (
                                      <span className="font-normal text-emerald-600">
                                        ({new Date(dose.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                                      </span>
                                    )}
                                    <span className="text-[9px] text-emerald-800 bg-emerald-200/60 px-1 rounded">
                                      {dose.method === "caregiver_reported" ? "Caregiver" : "Self-Reported"}
                                    </span>
                                  </span>
                                )}
                                {dose.status === "skipped" && (
                                  <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                    Skipped ✗
                                  </span>
                                )}
                                {dose.status === "not_confirmed" && (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    Not confirmed (window passed)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Large Accessible Check-In Buttons (Non-negotiable: Taken / Skipped only) */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {dose.status === "scheduled" || dose.status === "not_confirmed" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(dose._id, "taken")}
                                  className="min-h-[44px] min-w-[90px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <span>Taken ✓</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(dose._id, "skipped")}
                                  className="min-h-[44px] min-w-[90px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs px-4 py-2.5 rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <span>Skipped ✗</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCheckIn(dose._id, dose.status === "taken" ? "skipped" : "taken")}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline"
                              >
                                Undo / Change
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REVIEW & CONFIRM SCHEDULE */}
          {activeTab === "review" && (
            <div className="p-6 space-y-6">
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                <p className="font-extrabold text-sm flex items-center gap-1.5">
                  <span>⚠️</span> Patient Safety Review Required
                </p>
                <p>
                  No reminder is ever activated automatically from raw text. Please confirm that every drug name, strength, dose, and frequency matches your doctor's instructions before starting reminders.
                </p>
              </div>

              {/* Free-text Clinical Notes display */}
              {currentPlan?.notes && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Doctor's Clinical Notes / Prescription:</span>
                    {(!editableMeds || editableMeds.length === 0) && (
                      <button
                        type="button"
                        onClick={handleExtractMeds}
                        disabled={extracting}
                        className="bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 text-xs"
                      >
                        {extracting ? "Extracting..." : "⚡ Auto-Extract Medications from Notes"}
                      </button>
                    )}
                  </div>
                  <p className="text-slate-600 whitespace-pre-wrap font-mono bg-white p-3 rounded-xl border border-slate-100">
                    {currentPlan.notes}
                  </p>
                </div>
              )}

              {/* Medications List Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Medications to Review & Activate
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditableMeds((prev) => [
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
                          fieldConfidence: { drug: 1, strength: 1, dose: 1, frequency: 1, durationDays: 1 },
                        },
                      ]);
                    }}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    + Add Medication
                  </button>
                </div>

                {editableMeds.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl space-y-2">
                    <p className="text-sm font-bold text-slate-600">No medications structured yet.</p>
                    <p className="text-xs text-slate-400">Click "Auto-Extract" above or "+ Add Medication" to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editableMeds.map((med, idx) => {
                      const hasLowConfidence = (
                        (med.fieldConfidence?.drug && med.fieldConfidence.drug < 0.9) ||
                        (med.fieldConfidence?.strength && med.fieldConfidence.strength < 0.8) ||
                        (med.fieldConfidence?.dose && med.fieldConfidence.dose < 0.9) ||
                        (med.fieldConfidence?.durationDays && med.fieldConfidence.durationDays < 0.9)
                      );

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border transition-all ${
                            hasLowConfidence ? "bg-amber-50/30 border-amber-300" : "bg-white border-slate-200 shadow-xs"
                          }`}
                        >
                          {hasLowConfidence && (
                            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                              <span>⚠️ Needs Clarification: Please verify highlighted fields before confirming.</span>
                              <span className="text-[10px] font-medium bg-white/70 px-1.5 py-0.5 rounded">Draft</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                            <div className="sm:col-span-3">
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Drug Name *</label>
                              <input
                                type="text"
                                value={med.drug}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableMeds((prev) => {
                                    const u = [...prev];
                                    u[idx] = { ...u[idx], drug: val, fieldConfidence: { ...u[idx].fieldConfidence, drug: 1.0 } };
                                    return u;
                                  });
                                }}
                                className={`w-full input px-2.5 py-1.5 text-xs rounded-xl ${
                                  !med.drug ? "border-amber-400 bg-amber-50/50" : "border-slate-200"
                                }`}
                                placeholder="e.g. Paracetamol"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Strength *</label>
                              <input
                                type="text"
                                value={med.strength}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableMeds((prev) => {
                                    const u = [...prev];
                                    u[idx] = { ...u[idx], strength: val, fieldConfidence: { ...u[idx].fieldConfidence, strength: 1.0 } };
                                    return u;
                                  });
                                }}
                                className={`w-full input px-2.5 py-1.5 text-xs rounded-xl ${
                                  !med.strength ? "border-amber-400 bg-amber-50/50" : "border-slate-200"
                                }`}
                                placeholder="e.g. 500 mg"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Dose *</label>
                              <input
                                type="text"
                                value={med.dose}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableMeds((prev) => {
                                    const u = [...prev];
                                    u[idx] = { ...u[idx], dose: val };
                                    return u;
                                  });
                                }}
                                className="w-full input px-2.5 py-1.5 text-xs border-slate-200 rounded-xl"
                                placeholder="e.g. 1 tablet"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Frequency</label>
                              <select
                                value={med.frequency}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const opt = FREQUENCY_OPTIONS.find((f) => f.value === val);
                                  setEditableMeds((prev) => {
                                    const u = [...prev];
                                    u[idx] = { ...u[idx], frequency: val, times: opt ? opt.times : u[idx].times };
                                    return u;
                                  });
                                }}
                                className="w-full input px-2.5 py-1.5 text-xs border-slate-200 rounded-xl"
                              >
                                {FREQUENCY_OPTIONS.map((f) => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                              </select>
                            </div>

                            <div className="sm:col-span-2 flex items-center gap-1.5">
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Days *</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={med.durationDays}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableMeds((prev) => {
                                      const u = [...prev];
                                      u[idx] = { ...u[idx], durationDays: val };
                                      return u;
                                    });
                                  }}
                                  className="w-full input px-2.5 py-1.5 text-xs border-slate-200 rounded-xl"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditableMeds((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-xl transition-colors self-end mb-0.5"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-[11px] text-slate-500">
                    By clicking Confirm, you activate scheduled reminders for the selected duration.
                  </p>
                  <button
                    type="button"
                    onClick={handleConfirmSchedule}
                    disabled={confirming || editableMeds.length === 0}
                    className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{confirming ? "Activating..." : "Confirm Schedule & Start Reminders ✓"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOSE HISTORY */}
          {activeTab === "history" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Dose History & Adherence Log
                </h3>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Filter by medication..."
                    value={historyFilterDrug}
                    onChange={(e) => setHistoryFilterDrug(e.target.value)}
                    className="input px-3 py-1.5 text-xs border-slate-200 rounded-xl w-44"
                  />
                  <select
                    value={historyFilterStatus}
                    onChange={(e) => setHistoryFilterStatus(e.target.value)}
                    className="input px-3 py-1.5 text-xs border-slate-200 rounded-xl"
                  >
                    <option value="">All Statuses</option>
                    <option value="taken">Taken</option>
                    <option value="skipped">Skipped</option>
                    <option value="not_confirmed">Not Confirmed</option>
                  </select>
                </div>
              </div>

              {doseHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No historical doses match your filter.
                </div>
              ) : (
                <div className="space-y-2">
                  {doseHistory.map((d) => (
                    <div
                      key={d._id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${
                          d.status === "taken" ? "bg-emerald-500" :
                          d.status === "skipped" ? "bg-rose-500" :
                          "bg-amber-500"
                        }`} />
                        <div>
                          <p className="font-bold text-slate-800">{d.drug} {d.strength && `(${d.strength})`}</p>
                          <p className="text-[11px] text-slate-400">
                            {d.scheduledDate} · {d.scheduledTime} · {d.dose}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-bold capitalize ${
                          d.status === "taken" ? "text-emerald-700" :
                          d.status === "skipped" ? "text-rose-700" :
                          "text-amber-700"
                        }`}>
                          {d.status.replace("_", " ")}
                        </span>
                        {d.method && (
                          <p className="text-[10px] text-slate-400 capitalize">
                            {d.method.replace("_", " ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CAREGIVER MODE */}
          {activeTab === "caregiver" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Caregiver Management & Linked Patients
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorize family members or nurses to view schedules and record check-ins with your explicit consent.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  + Add Caregiver
                </button>
              </div>

              {/* My Caregivers */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase">My Authorized Caregivers</h4>
                {caregiverLinks.myCaregivers?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-dashed text-center">
                    No caregivers added yet. Add a trusted family member or caregiver to help track your recovery.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {caregiverLinks.myCaregivers.map((link) => (
                      <div
                        key={link._id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{link.caregiverName || link.caregiverEmail}</p>
                          <p className="text-[11px] text-slate-400">{link.caregiverEmail} · {link.relationship}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeCaregiver(link._id)}
                          className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold px-3 py-1.5 rounded-lg transition-colors text-xs"
                        >
                          Revoke Access
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patients I Care For */}
              {caregiverLinks.patientsIcareFor?.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Patients I Care For</h4>
                  <div className="grid gap-2">
                    {caregiverLinks.patientsIcareFor.map((link) => (
                      <div
                        key={link._id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{link.patientId?.name || "Patient"}</p>
                          <p className="text-[11px] text-slate-400">{link.patientId?.email}</p>
                        </div>
                        <Link
                          to={`/recovery-plan?caregiverFor=${link.patientId?._id}`}
                          className="bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold px-3 py-1.5 rounded-lg transition-colors text-xs"
                        >
                          View Schedule →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Invite Caregiver Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-800">Add Trusted Caregiver</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteCaregiver} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Caregiver Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full input px-3 py-2 text-xs border-slate-200 rounded-xl"
                  placeholder="caregiver@example.com"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Caregiver Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full input px-3 py-2 text-xs border-slate-200 rounded-xl"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Relationship</label>
                <select
                  value={inviteRelation}
                  onChange={(e) => setInviteRelation(e.target.value)}
                  className="w-full input px-3 py-2 text-xs border-slate-200 rounded-xl"
                >
                  <option value="family">Family Member</option>
                  <option value="spouse">Spouse / Partner</option>
                  <option value="nurse">Nurse / Home Care</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl text-[11px] text-slate-500">
                🔒 Privacy & RBAC: Caregivers can only view and check in on your schedule. You can revoke access at any time.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50 text-xs"
                >
                  {inviting ? "Granting Access..." : "Grant Caregiver Consent"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
