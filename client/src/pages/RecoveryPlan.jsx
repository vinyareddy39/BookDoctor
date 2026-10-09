import React, { useState, useEffect, useRef } from "react";
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
  const [allPlans, setAllPlans] = useState([]);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState("all");
  const [todayDoses, setTodayDoses] = useState([]);
  const [doseHistory, setDoseHistory] = useState([]);
  const [adherenceData, setAdherenceData] = useState(null);
  const [caregiverLinks, setCaregiverLinks] = useState({ myCaregivers: [], patientsIcareFor: [] });

  // Review & Confirm state
  const [editableMeds, setEditableMeds] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Handwritten Prescription Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [uploadDoctorName, setUploadDoctorName] = useState("");
  const [uploadClinicName, setUploadClinicName] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  // Side-by-Side Image Viewer controls
  const [imageZoom, setImageZoom] = useState(1.0);
  const [imageRotation, setImageRotation] = useState(0);

  // Caregiver invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRelation, setInviteRelation] = useState("family");
  const [inviting, setInviting] = useState(false);

  // Filter state for history
  const [historyFilterDrug, setHistoryFilterDrug] = useState("");
  const [historyFilterStatus, setHistoryFilterStatus] = useState("");

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const patientQueryParam = caregiverFor ? `?patientId=${caregiverFor}` : "";

  // Helper to build fully qualified URL for prescription attachments
  const getFullAttachmentUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
    const backendBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
    return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // 1. Fetch Plan & Today's Doses
  const fetchData = async (targetPlanId = null) => {
    try {
      setLoading(true);
      const planUrl = `/prescriptions/patient/plan${patientQueryParam}${
        targetPlanId ? (patientQueryParam ? `&planId=${targetPlanId}` : `?planId=${targetPlanId}`) : ""
      }`;

      const [planRes, todayRes, linksRes] = await Promise.all([
        API.get(planUrl),
        API.get(`/dose-events/today${patientQueryParam}`),
        API.get(`/caregiver/links`),
      ]);

      const plan = planRes.data?.data?.currentPlan || planRes.data?.currentPlan || null;
      const plansList = planRes.data?.data?.allPlans || planRes.data?.allPlans || (plan ? [plan] : []);

      setCurrentPlan(plan);
      setAllPlans(plansList);
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

  // Switch selected plan
  const handleSelectPlan = (plan) => {
    setCurrentPlan(plan);
    initializeEditableMeds(plan);
    setImageZoom(1.0);
    setImageRotation(0);
    if (plan.status === "shared" || plan.status === "draft") {
      setActiveTab("review");
    }
  };

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
          needsReview: m.needsReview || false,
        }))
      );
    } else {
      setEditableMeds([]);
    }
  };

  // Run Draft Extraction (if meds not yet structured in an online notes prescription)
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

  // Upload Handwritten Prescription (Photo / Camera / PDF)
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 15 MB.");
      return;
    }

    setUploadFile(file);
    if (file.type.startsWith("image/")) {
      const preview = URL.createObjectURL(file);
      setUploadPreviewUrl(preview);
    } else {
      setUploadPreviewUrl(null);
    }
  };

  const handleUploadPrescription = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a prescription photo or PDF file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    if (uploadDoctorName.trim()) formData.append("doctorName", uploadDoctorName.trim());
    if (uploadClinicName.trim()) formData.append("clinicName", uploadClinicName.trim());
    if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());
    if (caregiverFor) formData.append("patientId", caregiverFor);

    try {
      const res = await API.post("/prescriptions/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res.data?.data || res.data;
      toast.success(
        res.data?.message || "Prescription uploaded & scanned! Review candidate medications in the split view."
      );

      // Close modal and reset form
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadPreviewUrl(null);
      setUploadDoctorName("");
      setUploadClinicName("");
      setUploadNotes("");

      // Switch to new plan and open Review tab
      const newPlan = data.prescription;
      setCurrentPlan(newPlan);
      setAllPlans((prev) => [newPlan, ...prev.filter((p) => p._id !== newPlan._id)]);
      initializeEditableMeds(newPlan);
      setActiveTab("review");
      setImageZoom(1.0);
      setImageRotation(0);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload and scan prescription.");
    } finally {
      setUploading(false);
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
      await fetchData(currentPlan._id);
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

  // Filter Today's doses by selected plan if filtered
  const filteredTodayDoses =
    selectedPlanFilter === "all"
      ? todayDoses
      : todayDoses.filter((d) => String(d.prescriptionId?._id || d.prescriptionId) === String(selectedPlanFilter));

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
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Caregiver Header Banner */}
        {caregiverFor && (
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <p className="font-extrabold text-sm">Viewing as Caregiver for {patientName}</p>
                <p className="text-xs text-amber-100">
                  You have verified permission to review medication schedules and record check-ins.
                </p>
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
          <div className="p-6 border-b border-slate-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-slate-800">RecoverTrack Plan</h1>
                  {currentPlan && (
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full capitalize ${
                        currentPlan.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : currentPlan.status === "shared"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {currentPlan.status} Plan {currentPlan.version > 1 ? `(v${currentPlan.version})` : ""}
                    </span>
                  )}
                  {currentPlan?.source === "patient_upload" && (
                    <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                      📷 Handwritten OCR
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Post-prescription medication scheduling, timely reminders, and self-reported adherence.
                </p>
              </div>

              {/* Action Buttons: Upload Handwritten Rx */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 shrink-0"
                >
                  <span>📷 Upload Handwritten Rx</span>
                </button>
              </div>
            </div>

            {/* Multiple Plans Switcher (Online vs Uploaded) */}
            {allPlans.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Your Plans:
                </span>
                {allPlans.map((p) => {
                  const isCurrent = currentPlan?._id === p._id;
                  const title =
                    p.source === "patient_upload"
                      ? p.doctorName || p.clinicName || "Uploaded Prescription"
                      : p.doctorId?.userId?.name
                      ? `Dr. ${p.doctorId.userId.name}`
                      : "Doctor Shared";

                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => handleSelectPlan(p)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shrink-0 ${
                        isCurrent
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>{p.source === "patient_upload" ? "📄" : "🩺"}</span>
                      <span className="truncate max-w-[140px]">{title}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-extrabold uppercase ${
                          p.status === "active"
                            ? isCurrent
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-100 text-emerald-800"
                            : isCurrent
                            ? "bg-amber-400 text-slate-900"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab("today")}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "today" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ⏰ Today's Schedule ({filteredTodayDoses.length})
              </button>

              {currentPlan &&
                (currentPlan.status === "shared" || currentPlan.status === "draft" || activeTab === "review") && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("review")}
                    className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                      activeTab === "review"
                        ? "bg-white text-primary-700 shadow-xs"
                        : "text-primary-600 hover:text-primary-700"
                    }`}
                  >
                    📝 Review & Confirm {currentPlan.status === "draft" ? "⚠️" : ""}
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
              {/* Optional Plan Filter Chips when multiple plans exist */}
              {allPlans.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-slate-500">Filter Doses:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlanFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                      selectedPlanFilter === "all"
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All Active Plans ({todayDoses.length})
                  </button>
                  {allPlans
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => setSelectedPlanFilter(p._id)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                          selectedPlanFilter === p._id
                            ? "bg-primary-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {p.doctorName || (p.doctorId?.userId?.name ? `Dr. ${p.doctorId.userId.name}` : "Plan")}
                      </button>
                    ))}
                </div>
              )}

              {!currentPlan && allPlans.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="text-5xl">📋</div>
                  <h3 className="text-lg font-bold text-slate-700">No Active Recovery Plan</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    You can upload a photo of your paper prescription from your clinic visit, or wait for your doctor to share one online.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(true)}
                      className="bg-primary-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
                    >
                      📷 Upload Handwritten Rx
                    </button>
                    <Link
                      to="/appointments"
                      className="bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      View Appointments
                    </Link>
                  </div>
                </div>
              ) : currentPlan && (currentPlan.status === "shared" || currentPlan.status === "draft") ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="text-4xl">⚠️</div>
                  <h3 className="text-base font-bold text-amber-900">
                    {currentPlan.source === "patient_upload"
                      ? "Handwritten Prescription Scanned – Awaiting Confirmation"
                      : "New Prescription Awaiting Your Review"}
                  </h3>
                  <p className="text-xs text-amber-800 max-w-lg mx-auto">
                    A safety review is required before reminders start. Please verify every medication name, strength, dose, and frequency against the prescription.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("review")}
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
                  >
                    Review & Confirm Schedule Now →
                  </button>
                </div>
              ) : filteredTodayDoses.length === 0 ? (
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
                    {filteredTodayDoses.map((dose) => (
                      <div
                        key={dose._id}
                        className={`p-4 rounded-2xl border transition-all ${
                          dose.status === "taken"
                            ? "bg-emerald-50/40 border-emerald-200"
                            : dose.status === "skipped"
                            ? "bg-rose-50/40 border-rose-200"
                            : dose.status === "not_confirmed"
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-white border-slate-200 shadow-xs hover:border-primary-200"
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
                                {(dose.prescriptionId?.doctorName || dose.prescriptionId?.clinicName) && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                    {dose.prescriptionId.doctorName || dose.prescriptionId.clinicName}
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

          {/* TAB 2: REVIEW & CONFIRM SCHEDULE (SPLIT VIEW WHEN PHOTO IS ATTACHED) */}
          {activeTab === "review" && (
            <div className="p-6 space-y-6">
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                <p className="font-extrabold text-sm flex items-center gap-1.5">
                  <span>⚠️</span> Patient Safety Review Required
                </p>
                <p>
                  No reminder is ever activated automatically from raw text or OCR. Please confirm that every drug name, strength, dose, and frequency matches your doctor's instructions before starting reminders.
                </p>
              </div>

              {/* Main Content Layout: Side-by-Side if Attachment Exists */}
              <div className={`grid grid-cols-1 ${currentPlan?.attachmentUrl ? "lg:grid-cols-12" : ""} gap-6 items-start`}>
                
                {/* LEFT COLUMN: ORIGINAL PRESCRIPTION PHOTO / PDF (SIDE-BY-SIDE SPLIT VIEW) */}
                {currentPlan?.attachmentUrl && (
                  <div className="lg:col-span-6 bg-slate-900/5 rounded-3xl border border-slate-200 p-4 space-y-3 sticky top-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📄</span>
                        <h4 className="font-extrabold text-sm text-slate-800">
                          Original Doctor's Prescription
                        </h4>
                      </div>
                      
                      {/* Zoom & Rotate Controls */}
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setImageZoom((prev) => Math.max(0.6, prev - 0.2))}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-xs font-bold"
                          title="Zoom out"
                        >
                          🔍-
                        </button>
                        <span className="text-[10px] font-bold px-1.5 text-slate-600">
                          {Math.round(imageZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setImageZoom((prev) => Math.min(2.5, prev + 0.2))}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-xs font-bold"
                          title="Zoom in"
                        >
                          🔍+
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-xs font-bold"
                          title="Rotate 90 degrees"
                        >
                          🔄
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImageZoom(1.0);
                            setImageRotation(0);
                          }}
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 px-1.5"
                          title="Reset view"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Prescription Metadata Card */}
                    {(currentPlan.doctorName || currentPlan.clinicName || currentPlan.attachmentName) && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">
                            {currentPlan.doctorName || "Prescribing Doctor"}
                          </p>
                          {currentPlan.clinicName && (
                            <p className="text-[11px] text-slate-500">{currentPlan.clinicName}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-black bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                          OCR Scanned ({Math.round((currentPlan.ocrConfidence || 0.85) * 100)}% confidence)
                        </span>
                      </div>
                    )}

                    {/* Image / PDF Viewer Container */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-auto max-h-[520px] min-h-[300px] flex items-center justify-center p-2 relative shadow-inner">
                      {currentPlan.attachmentType === "pdf" ? (
                        <iframe
                          src={getFullAttachmentUrl(currentPlan.attachmentUrl)}
                          title="Prescription PDF"
                          className="w-full h-[480px] rounded-xl border-0"
                        />
                      ) : (
                        <img
                          src={getFullAttachmentUrl(currentPlan.attachmentUrl)}
                          alt="Handwritten Prescription"
                          style={{
                            transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                            transformOrigin: "center center",
                            transition: "transform 0.15s ease-out",
                          }}
                          className="max-w-full max-h-[480px] object-contain rounded-lg select-none cursor-grab active:cursor-grabbing"
                        />
                      )}
                    </div>

                    {/* Raw OCR Text Disclosure */}
                    {currentPlan.rawOcrText && (
                      <details className="text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                        <summary className="font-bold cursor-pointer text-slate-700 flex items-center justify-between">
                          <span>View Raw Extracted OCR Text</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {currentPlan.ocrConfidence
                              ? `Confidence: ${Math.round(currentPlan.ocrConfidence * 100)}%`
                              : ""}
                          </span>
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] bg-slate-50 p-2 rounded border border-slate-100">
                          {currentPlan.rawOcrText}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* RIGHT COLUMN: EDITABLE MEDICATIONS FORM */}
                <div className={`${currentPlan?.attachmentUrl ? "lg:col-span-6" : ""} space-y-4`}>
                  
                  {/* Free-text Clinical Notes display (if not an attachment) */}
                  {!currentPlan?.attachmentUrl && currentPlan?.notes && (
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

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        Medications to Review & Activate
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {currentPlan?.attachmentUrl
                          ? "Compare each line directly with the original image on the left."
                          : "Verify each field against your doctor's instructions."}
                      </p>
                    </div>
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
                            needsReview: false,
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
                      <p className="text-xs text-slate-400">Click "+ Add Medication" to begin.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editableMeds.map((med, idx) => {
                        const hasLowConfidence =
                          med.needsReview ||
                          (med.fieldConfidence?.drug && med.fieldConfidence.drug < 0.9) ||
                          (med.fieldConfidence?.strength && med.fieldConfidence.strength < 0.8) ||
                          (med.fieldConfidence?.dose && med.fieldConfidence.dose < 0.9) ||
                          (med.fieldConfidence?.durationDays && med.fieldConfidence.durationDays < 0.9);

                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border transition-all ${
                              hasLowConfidence
                                ? "bg-amber-50/40 border-amber-300 ring-1 ring-amber-300"
                                : "bg-white border-slate-200 shadow-xs"
                            }`}
                          >
                            {hasLowConfidence && (
                              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                                <span>⚠️ Needs Review: Verify drug name, strength, and frequency.</span>
                                <span className="text-[10px] font-medium bg-white/70 px-1.5 py-0.5 rounded">
                                  Draft Field
                                </span>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                              <div className="sm:col-span-4">
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Drug Name *</label>
                                <input
                                  type="text"
                                  value={med.drug}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableMeds((prev) => {
                                      const u = [...prev];
                                      u[idx] = {
                                        ...u[idx],
                                        drug: val,
                                        needsReview: false,
                                        fieldConfidence: { ...u[idx].fieldConfidence, drug: 1.0 },
                                      };
                                      return u;
                                    });
                                  }}
                                  className={`w-full input px-2.5 py-1.5 text-xs rounded-xl ${
                                    !med.drug ? "border-amber-400 bg-amber-50/50" : "border-slate-200"
                                  }`}
                                  placeholder="e.g. Amoxicillin"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Strength *</label>
                                <input
                                  type="text"
                                  value={med.strength}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableMeds((prev) => {
                                      const u = [...prev];
                                      u[idx] = {
                                        ...u[idx],
                                        strength: val,
                                        fieldConfidence: { ...u[idx].fieldConfidence, strength: 1.0 },
                                      };
                                      return u;
                                    });
                                  }}
                                  className={`w-full input px-2.5 py-1.5 text-xs rounded-xl ${
                                    !med.strength ? "border-amber-400 bg-amber-50/50" : "border-slate-200"
                                  }`}
                                  placeholder="e.g. 500 mg"
                                />
                              </div>

                              <div className="sm:col-span-3">
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

                              <div className="sm:col-span-2">
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

                              <div className="sm:col-span-6">
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Frequency</label>
                                <select
                                  value={med.frequency}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const opt = FREQUENCY_OPTIONS.find((f) => f.value === val);
                                    setEditableMeds((prev) => {
                                      const u = [...prev];
                                      u[idx] = {
                                        ...u[idx],
                                        frequency: val,
                                        times: opt ? opt.times : u[idx].times,
                                        fieldConfidence: { ...u[idx].fieldConfidence, frequency: 1.0 },
                                      };
                                      return u;
                                    });
                                  }}
                                  className="w-full input px-2.5 py-1.5 text-xs border-slate-200 rounded-xl"
                                >
                                  {FREQUENCY_OPTIONS.map((f) => (
                                    <option key={f.value} value={f.value}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-5">
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Instructions</label>
                                <input
                                  type="text"
                                  value={med.instructions}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableMeds((prev) => {
                                      const u = [...prev];
                                      u[idx] = { ...u[idx], instructions: val };
                                      return u;
                                    });
                                  }}
                                  className="w-full input px-2.5 py-1.5 text-xs border-slate-200 rounded-xl"
                                  placeholder="e.g. after food"
                                />
                              </div>

                              <div className="sm:col-span-1 flex items-end justify-center">
                                <button
                                  type="button"
                                  onClick={() => setEditableMeds((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-xl transition-colors mb-0.5"
                                  title="Remove medication"
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
            </div>
          )}

          {/* TAB 3: DOSE HISTORY */}
          {activeTab === "history" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Dose History Log
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chronological audit of self-reported and caregiver-reported check-ins.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={historyFilterDrug}
                    onChange={(e) => setHistoryFilterDrug(e.target.value)}
                    placeholder="Filter by drug..."
                    className="input px-2.5 py-1.5 text-xs rounded-xl border-slate-200"
                  />
                  <select
                    value={historyFilterStatus}
                    onChange={(e) => setHistoryFilterStatus(e.target.value)}
                    className="input px-2.5 py-1.5 text-xs rounded-xl border-slate-200"
                  >
                    <option value="">All Statuses</option>
                    <option value="taken">Taken</option>
                    <option value="skipped">Skipped</option>
                    <option value="not_confirmed">Not Confirmed</option>
                  </select>
                </div>
              </div>

              {doseHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed">
                  <p className="text-sm font-bold text-slate-600">No dose events recorded yet.</p>
                  <p className="text-xs text-slate-400">Recorded check-ins will appear here.</p>
                </div>
              ) : (
                <div className="divide-y border rounded-2xl overflow-hidden bg-white">
                  {doseHistory.map((d) => (
                    <div key={d._id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                          {d.scheduledTime}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-800">
                            {d.drug} <span className="font-normal text-slate-500">{d.strength}</span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Scheduled: {d.scheduledDate} {d.scheduledTime}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-bold capitalize ${
                            d.status === "taken"
                              ? "text-emerald-700"
                              : d.status === "skipped"
                              ? "text-rose-700"
                              : "text-amber-700"
                          }`}
                        >
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
                          <p className="text-[11px] text-slate-400">
                            {link.caregiverEmail} · {link.relationship}
                          </p>
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

      {/* MODAL 1: UPLOAD HANDWRITTEN PRESCRIPTION (PHOTO / CAMERA / PDF) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
                <h3 className="text-base font-black text-slate-800">
                  Upload Handwritten Prescription
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadPreviewUrl(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadPrescription} className="space-y-4 text-xs">
              {/* File Selector & Camera Capture buttons */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Select Photo or PDF Document *
                </label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                />

                {/* Mobile Camera Input */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                {!uploadFile ? (
                  <div className="border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-2xl p-6 text-center space-y-3 transition-colors bg-slate-50/50">
                    <div className="text-3xl">📄</div>
                    <div>
                      <p className="font-bold text-slate-700 text-xs">
                        Drag and drop your prescription photo or PDF here
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Supports JPG, PNG, WebP, and PDF up to 15 MB
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-3 py-1.5 rounded-xl shadow-xs text-xs"
                      >
                        📁 Choose File
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold px-3 py-1.5 rounded-xl text-xs"
                      >
                        📷 Take Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {uploadPreviewUrl ? (
                        <img
                          src={uploadPreviewUrl}
                          alt="Preview"
                          className="w-12 h-12 object-cover rounded-xl border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs border border-red-200">
                          PDF
                        </div>
                      )}
                      <div className="text-left">
                        <p className="font-bold text-slate-800 text-xs truncate max-w-[200px]">
                          {uploadFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null);
                        setUploadPreviewUrl(null);
                      }}
                      className="text-rose-500 hover:text-rose-700 font-bold text-xs p-1"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Prescribing Doctor & Clinic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                    Doctor's Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadDoctorName}
                    onChange={(e) => setUploadDoctorName(e.target.value)}
                    className="w-full input px-3 py-2 text-xs border-slate-200 rounded-xl"
                    placeholder="e.g. Dr. Ramesh Sharma"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                    Clinic / Hospital (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadClinicName}
                    onChange={(e) => setUploadClinicName(e.target.value)}
                    className="w-full input px-3 py-2 text-xs border-slate-200 rounded-xl"
                    placeholder="e.g. City Care Hospital"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full input px-3 py-2 text-xs border-slate-200 rounded-xl resize-none"
                  placeholder="e.g. Post-discharge medication advice from clinic visit"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span>🛡️</span> Safety Rule: OCR Output is DRAFT Only
                </p>
                <p className="text-amber-800">
                  The OCR scanner detects candidate fields. You will be able to review and correct every dose against the original prescription photo side-by-side before reminders are activated.
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-extrabold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Scanning & Extracting with OCR...</span>
                    </>
                  ) : (
                    <span>Scan with OCR & Open Split Review →</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INVITE CAREGIVER */}
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
