import { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { exportPrescriptionToPDF } from "../utils/export";
import toast from "react-hot-toast";

// Common ICD-10 helper presets for fast selection
const ICD_PRESETS = [
  { code: "I10", label: "Essential (primary) hypertension", category: "Cardiovascular" },
  { code: "E11.9", label: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  { code: "J06.9", label: "Acute upper respiratory infection, unspecified", category: "Respiratory" },
  { code: "K21.9", label: "Gastro-esophageal reflux disease without esophagitis", category: "Gastrointestinal" },
  { code: "M54.5", label: "Low back pain", category: "Musculoskeletal" },
  { code: "R51", label: "Headache", category: "Neurological" },
  { code: "J45.909", label: "Unspecified asthma, uncomplicated", category: "Respiratory" },
  { code: "N39.0", label: "Urinary tract infection, site not specified", category: "Urological" },
];

export default function EmrPortal() {
  const { user, isDoctor, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState("notes"); // 'notes' | 'prescriptions' | 'diagnoses' | 'followups'
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Clinical Notes State
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteForm, setNoteForm] = useState({
    chiefComplaint: "",
    historyOfPresentIllness: "",
    examination: "",
    assessment: "",
    plan: "",
    vitals: {
      bloodPressure: "",
      heartRate: "",
      temperature: "",
      respiratoryRate: "",
      spO2: "",
      weight: "",
      height: "",
      bmi: "",
    },
    diagnoses: [],
  });
  const [newDiagCode, setNewDiagCode] = useState("");
  const [newDiagLabel, setNewDiagLabel] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Amendment State
  const [amendingNote, setAmendingNote] = useState(null);
  const [amendmentReason, setAmendmentReason] = useState("");

  // Prescription State
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [showRxModal, setShowRxModal] = useState(false);
  const [medicines, setMedicines] = useState([
    { name: "", dosage: "1 tablet", frequency: "1-0-1", duration: "5 days", timing: "after_food", instructions: "" },
  ]);
  const [rxInstructions, setRxInstructions] = useState("");
  const [savingRx, setSavingRx] = useState(false);

  // Diagnosis State
  const [diagnosesList, setDiagnosesList] = useState([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagForm, setDiagForm] = useState({ code: "", label: "", category: "General", status: "active", notes: "" });

  // Follow-Up State
  const [followUps, setFollowUps] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ dueDate: "", reason: "", plan: "" });

  // AI Intelligence State (Anthropic Backend with Safety Guardrails)
  const [generatingAiSummary, setGeneratingAiSummary] = useState(false);
  const [aiDraftSummary, setAiDraftSummary] = useState("");
  const [aiSummaryNoteId, setAiSummaryNoteId] = useState(null);
  const [showAiSummaryModal, setShowAiSummaryModal] = useState(false);
  const [approvingAiSummary, setApprovingAiSummary] = useState(false);

  const [generatingAiExplanation, setGeneratingAiExplanation] = useState(false);
  const [aiExplanationData, setAiExplanationData] = useState(null);
  const [showAiExplanationModal, setShowAiExplanationModal] = useState(false);

  // Search Patients
  const handleSearchPatient = async (q) => {
    setPatientSearch(q);
    if (!q || q.length < 2) return;
    try {
      const res = await API.get(`/patients?search=${encodeURIComponent(q)}&limit=10`);
      setPatients(res.data?.data?.patients || []);
    } catch (err) {
      console.warn("Search patients failed:", err);
    }
  };

  // Select Patient
  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    setSelectedPatientId(p._id);
    setPatientSearch(`${p.name} (${p.mrn || "No MRN"})`);
    setPatients([]);
  };

  // Fetch Patient EMR Data
  const fetchPatientData = useCallback(async () => {
    if (!selectedPatientId) return;

    if (activeTab === "notes") {
      setLoadingNotes(true);
      try {
        const res = await API.get(`/emr/notes?patientId=${selectedPatientId}`);
        setNotes(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load clinical notes");
      } finally {
        setLoadingNotes(false);
      }
    } else if (activeTab === "prescriptions") {
      setLoadingPrescriptions(true);
      try {
        const res = await API.get(`/emr/prescriptions?patientId=${selectedPatientId}`);
        setPrescriptions(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load prescriptions");
      } finally {
        setLoadingPrescriptions(false);
      }
    } else if (activeTab === "diagnoses") {
      setLoadingDiagnoses(true);
      try {
        const res = await API.get(`/emr/diagnoses?patientId=${selectedPatientId}`);
        setDiagnosesList(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load diagnoses");
      } finally {
        setLoadingDiagnoses(false);
      }
    } else if (activeTab === "followups") {
      setLoadingFollowUps(true);
      try {
        const res = await API.get(`/emr/follow-ups?patientId=${selectedPatientId}`);
        setFollowUps(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load follow-ups");
      } finally {
        setLoadingFollowUps(false);
      }
    }
  }, [selectedPatientId, activeTab]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  // Vitals BMI Calculation
  const handleVitalChange = (field, val) => {
    setNoteForm((prev) => {
      const updatedVitals = { ...prev.vitals, [field]: val };
      if (updatedVitals.weight && updatedVitals.height) {
        const hMeter = parseFloat(updatedVitals.height) / 100;
        const wKg = parseFloat(updatedVitals.weight);
        if (hMeter > 0 && wKg > 0) {
          updatedVitals.bmi = parseFloat((wKg / (hMeter * hMeter)).toFixed(1));
        }
      }
      return { ...prev, vitals: updatedVitals };
    });
  };

  // Add Diagnosis Chip to Note
  const handleAddDiagnosisToNote = () => {
    if (!newDiagCode || !newDiagLabel) return;
    setNoteForm((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, { code: newDiagCode.toUpperCase(), label: newDiagLabel, isPrimary: prev.diagnoses.length === 0 }],
    }));
    setNewDiagCode("");
    setNewDiagLabel("");
  };

  const handleApplyPreset = (preset) => {
    setNoteForm((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, { code: preset.code, label: preset.label, isPrimary: prev.diagnoses.length === 0 }],
    }));
  };

  // Save Clinical Note
  const handleSaveNote = async (isSigning) => {
    if (!selectedPatientId) {
      toast.error("Please pick a patient first");
      return;
    }
    if (!noteForm.chiefComplaint.trim()) {
      toast.error("Chief Complaint is required");
      return;
    }

    setSavingNote(true);
    try {
      if (amendingNote) {
        // Amend existing signed note
        if (!amendmentReason.trim()) {
          toast.error("Please enter an amendment reason");
          setSavingNote(false);
          return;
        }
        await API.post(`/emr/notes/${amendingNote._id}/amend`, {
          amendmentReason,
          ...noteForm,
        });
        toast.success("Amended clinical note signed and locked!");
        setAmendingNote(null);
        setAmendmentReason("");
      } else {
        await API.post("/emr/notes", {
          patientId: selectedPatientId,
          isSigning,
          ...noteForm,
        });
        toast.success(isSigning ? "Clinical note signed and locked!" : "Draft note saved");
      }

      setShowNoteEditor(false);
      setNoteForm({
        chiefComplaint: "",
        historyOfPresentIllness: "",
        examination: "",
        assessment: "",
        plan: "",
        vitals: { bloodPressure: "", heartRate: "", temperature: "", respiratoryRate: "", spO2: "", weight: "", height: "", bmi: "" },
        diagnoses: [],
      });
      fetchPatientData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // Medicine Item Rows
  const handleAddMedicineRow = () => {
    setMedicines([...medicines, { name: "", dosage: "1 tablet", frequency: "1-0-1", duration: "5 days", timing: "after_food", instructions: "" }]);
  };

  const handleRemoveMedicineRow = (index) => {
    setMedicines(medicines.filter((_, idx) => idx !== index));
  };

  const handleMedicineChange = (index, field, val) => {
    const updated = [...medicines];
    updated[index][field] = val;
    setMedicines(updated);
  };

  // Save Prescription
  const handleSavePrescription = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error("Please select a patient");
      return;
    }
    const validMeds = medicines.filter((m) => m.name.trim());
    if (validMeds.length === 0) {
      toast.error("Please add at least one medicine with a name");
      return;
    }

    setSavingRx(true);
    try {
      const res = await API.post("/emr/prescriptions", {
        patientId: selectedPatientId,
        medicines: validMeds,
        generalInstructions: rxInstructions,
      });

      const savedRx = res.data?.data;
      toast.success("Prescription signed and issued!");
      setShowRxModal(false);
      setMedicines([{ name: "", dosage: "1 tablet", frequency: "1-0-1", duration: "5 days", timing: "after_food", instructions: "" }]);
      setRxInstructions("");
      fetchPatientData();

      // Offer immediate PDF download
      exportPrescriptionToPDF(savedRx, user?.name);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create prescription");
    } finally {
      setSavingRx(false);
    }
  };

  // Save Diagnosis
  const handleSaveDiagnosis = async (e) => {
    e.preventDefault();
    try {
      await API.post("/emr/diagnoses", {
        patientId: selectedPatientId,
        ...diagForm,
      });
      toast.success("Diagnosis recorded!");
      setShowDiagModal(false);
      setDiagForm({ code: "", label: "", category: "General", status: "active", notes: "" });
      fetchPatientData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add diagnosis");
    }
  };

  // Toggle Diagnosis Status
  const handleToggleDiagStatus = async (diag) => {
    const nextStatus = diag.status === "active" ? "resolved" : "active";
    try {
      await API.put(`/emr/diagnoses/${diag._id}`, { status: nextStatus });
      toast.success(`Diagnosis marked as ${nextStatus}`);
      fetchPatientData();
    } catch (err) {
      toast.error("Failed to update diagnosis");
    }
  };

  // Save Follow-Up
  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    try {
      await API.post("/emr/follow-ups", {
        patientId: selectedPatientId,
        ...followUpForm,
      });
      toast.success("Follow-up scheduled!");
      setShowFollowUpModal(false);
      setFollowUpForm({ dueDate: "", reason: "", plan: "" });
      fetchPatientData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule follow-up");
    }
  };

  // AI Intelligence Handlers
  const handleGenerateAiSummaryForNote = async (note) => {
    setGeneratingAiSummary(true);
    setAiSummaryNoteId(note._id);
    setShowAiSummaryModal(true);
    try {
      const res = await API.post("/ai/visit-summary", {
        chiefComplaint: note.chiefComplaint,
        historyOfPresentIllness: note.historyOfPresentIllness,
        vitals: note.vitals,
        examination: note.examination,
        assessment: note.assessment,
        plan: note.plan,
        diagnoses: note.diagnoses,
      });
      setAiDraftSummary(res.data?.data?.summary || "");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate AI summary");
      setShowAiSummaryModal(false);
    } finally {
      setGeneratingAiSummary(false);
    }
  };

  const handleApproveAiSummary = async () => {
    if (!aiDraftSummary.trim()) {
      toast.error("Summary cannot be empty");
      return;
    }
    setApprovingAiSummary(true);
    try {
      await API.post("/ai/approve-summary", {
        noteId: aiSummaryNoteId,
        approvedSummary: aiDraftSummary,
      });
      toast.success("AI clinical summary approved and attached to medical chart!");
      setShowAiSummaryModal(false);
      fetchPatientData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve summary");
    } finally {
      setApprovingAiSummary(false);
    }
  };

  const handleExplainPrescription = async (rx) => {
    setGeneratingAiExplanation(true);
    setShowAiExplanationModal(true);
    try {
      const res = await API.post("/ai/explain-instructions", {
        medicines: rx.medicines,
        lifestyleAdvice: rx.generalInstructions,
      });
      setAiExplanationData(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate explanation");
      setShowAiExplanationModal(false);
    } finally {
      setGeneratingAiExplanation(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>🩺</span> Electronic Medical Records (EMR)
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Structured clinical notes, ICD diagnoses, versioned prescriptions, and follow-ups
            </p>
          </div>

          {/* Patient Quick Finder */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => handleSearchPatient(e.target.value)}
              placeholder="Search patient by Name or MRN..."
              className="input py-2 text-xs font-semibold"
            />
            {patients.length > 0 && !selectedPatientId && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-xl bg-white shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {patients.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => handleSelectPatient(p)}
                    className="p-2.5 text-xs hover:bg-primary-50 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-slate-400 text-[11px]">{p.phone}</p>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                      {p.mrn || "No MRN"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Patient Banner */}
        {selectedPatient ? (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 font-black flex items-center justify-center text-lg">
                {selectedPatient.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-base">{selectedPatient.name}</h3>
                  <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-100">
                    {selectedPatient.mrn}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedPatient.gender?.toUpperCase() || "N/A"} • DOB: {selectedPatient.dob ? new Date(selectedPatient.dob).toLocaleDateString() : "N/A"} • Blood: {selectedPatient.bloodGroup || "N/A"} • Phone: {selectedPatient.phone}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedPatient(null);
                setSelectedPatientId("");
                setPatientSearch("");
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Change Patient
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-center text-xs text-amber-900 font-semibold">
            🔍 Please search and select a patient above to view or author clinical notes, prescriptions, and diagnoses.
          </div>
        )}

        {/* EMR Workspace Tabs */}
        {selectedPatientId && (
          <div className="space-y-4">
            <div className="flex rounded-2xl bg-white p-1.5 border border-slate-200/80 shadow-sm gap-1 overflow-x-auto">
              {[
                { id: "notes", label: "Clinical Notes (SOAP)", icon: "📝" },
                { id: "prescriptions", label: "Prescriptions (Rx)", icon: "💊" },
                { id: "diagnoses", label: "Diagnosis Problem List", icon: "🏷️" },
                { id: "followups", label: "Follow-Up Schedule", icon: "🗓️" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: CLINICAL NOTES */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 text-sm">Clinical Note Records ({notes.length})</h2>
                  {(isDoctor || isAdmin) && (
                    <button
                      onClick={() => {
                        setAmendingNote(null);
                        setAmendmentReason("");
                        setShowNoteEditor(true);
                      }}
                      className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>➕</span> New Clinical Note
                    </button>
                  )}
                </div>

                {loadingNotes ? (
                  <div className="h-40 flex items-center justify-center bg-white rounded-2xl border">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : notes.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">📋</span>
                    <p className="font-bold text-sm">No clinical notes recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note._id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-slate-900 text-sm">
                              Version {note.version} {note.version > 1 && "(Amendment)"}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              note.status === "signed" ? "bg-emerald-100 text-emerald-700" :
                              note.status === "amended" ? "bg-purple-100 text-purple-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {note.status}
                            </span>
                          </div>

                          <div className="text-right text-xs text-slate-400">
                            Dr. {note.doctorId?.userId?.name || "Doctor"} • {new Date(note.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        {note.amendmentReason && (
                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900">
                            <span className="font-bold">Amendment Rationale:</span> {note.amendmentReason}
                          </div>
                        )}

                        {/* Vitals Summary Strip */}
                        {note.vitals && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">BP</p><p className="font-bold text-xs">{note.vitals.bloodPressure || "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Heart Rate</p><p className="font-bold text-xs">{note.vitals.heartRate ? `${note.vitals.heartRate} bpm` : "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Temp</p><p className="font-bold text-xs">{note.vitals.temperature ? `${note.vitals.temperature} °F` : "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">SpO2</p><p className="font-bold text-xs">{note.vitals.spO2 ? `${note.vitals.spO2} %` : "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Resp Rate</p><p className="font-bold text-xs">{note.vitals.respiratoryRate ? `${note.vitals.respiratoryRate} /min` : "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Weight</p><p className="font-bold text-xs">{note.vitals.weight ? `${note.vitals.weight} kg` : "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Height</p><p className="font-bold text-xs">{note.vitals.height ? `${note.vitals.height} cm` : "—"}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">BMI</p><p className="font-bold text-xs text-primary-700">{note.vitals.bmi || "—"}</p></div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
                          <div>
                            <span className="font-bold text-slate-900 block mb-1">Chief Complaint & History:</span>
                            <p className="font-semibold text-slate-900">{note.chiefComplaint}</p>
                            <p className="text-slate-600 mt-1 whitespace-pre-wrap">{note.historyOfPresentIllness}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block mb-1">Examination Findings:</span>
                            <p className="text-slate-600 whitespace-pre-wrap">{note.examination || "No abnormal findings noted."}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 border-t pt-3">
                          <div>
                            <span className="font-bold text-slate-900 block mb-1">Assessment & Diagnoses:</span>
                            <p className="text-slate-600 mb-2">{note.assessment || "Clinical assessment completed."}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {note.diagnoses?.map((d, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                                  {d.code}: {d.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block mb-1">Clinical Plan:</span>
                            <p className="text-slate-600 whitespace-pre-wrap">{note.plan || "Follow instructions as advised."}</p>
                          </div>
                        </div>

                        {/* Verified AI Clinical Summary */}
                        {note.aiVisitSummary && (
                          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                <span>✨</span> AI Clinical Visit Summary
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                Clinician Verified & Approved
                              </span>
                            </div>
                            <p className="text-xs text-indigo-900 whitespace-pre-wrap leading-relaxed">
                              {note.aiVisitSummary}
                            </p>
                            {note.aiSummaryApprovedAt && (
                              <p className="text-[10px] text-indigo-500 font-medium">
                                Documented with AI provenance • Verified on {new Date(note.aiSummaryApprovedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Lock / Amend / AI actions */}
                        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t text-[11px] text-slate-400">
                          <span>
                            {note.status === "signed" ? "🔒 Signed & locked (Tamper-proof)" : "✏️ Draft version"}
                          </span>
                          <div className="flex items-center gap-2">
                            {note.status === "signed" && (isDoctor || isAdmin) && !note.aiVisitSummary && (
                              <button
                                onClick={() => handleGenerateAiSummaryForNote(note)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 transition"
                              >
                                <span>✨</span> Generate AI Summary
                              </button>
                            )}
                            {note.status === "signed" && (isDoctor || isAdmin) && (
                              <button
                                onClick={() => {
                                  setAmendingNote(note);
                                  setNoteForm({
                                    chiefComplaint: note.chiefComplaint,
                                    historyOfPresentIllness: note.historyOfPresentIllness,
                                    examination: note.examination,
                                    assessment: note.assessment,
                                    plan: note.plan,
                                    vitals: note.vitals || {},
                                    diagnoses: note.diagnoses || [],
                                  });
                                  setShowNoteEditor(true);
                                }}
                                className="text-xs font-bold text-primary-600 hover:text-primary-700 underline"
                              >
                                Amend Clinical Note (v{note.version + 1})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRESCRIPTIONS */}
            {activeTab === "prescriptions" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 text-sm">Prescription Catalog ({prescriptions.length})</h2>
                  {(isDoctor || isAdmin) && (
                    <button
                      onClick={() => setShowRxModal(true)}
                      className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>➕</span> Write Prescription
                    </button>
                  )}
                </div>

                {loadingPrescriptions ? (
                  <div className="h-40 flex items-center justify-center bg-white rounded-2xl border">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : prescriptions.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">💊</span>
                    <p className="font-bold text-sm">No electronic prescriptions found for this patient.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.map((rx) => (
                      <div key={rx._id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💊</span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">
                                Prescription issued on {new Date(rx.signedAt || rx.createdAt).toLocaleDateString()}
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                By Dr. {rx.doctorId?.userId?.name || "Doctor"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExplainPrescription(rx)}
                              className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                            >
                              <span>✨</span> AI Patient Guide
                            </button>
                            <button
                              onClick={() => exportPrescriptionToPDF(rx)}
                              className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100"
                            >
                              <span>📄</span> Download PDF
                            </button>
                          </div>
                        </div>

                        {/* Medicine List */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                              <tr>
                                <th className="p-2.5">#</th>
                                <th className="p-2.5">Medicine Name</th>
                                <th className="p-2.5">Dosage</th>
                                <th className="p-2.5">Frequency</th>
                                <th className="p-2.5">Duration</th>
                                <th className="p-2.5">Timing & Instructions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rx.medicines?.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                                  <td className="p-2.5 font-bold text-slate-900">{m.name}</td>
                                  <td className="p-2.5 text-slate-600">{m.dosage}</td>
                                  <td className="p-2.5 text-slate-600">{m.frequency}</td>
                                  <td className="p-2.5 text-slate-600">{m.duration}</td>
                                  <td className="p-2.5 text-slate-600">
                                    <span className="capitalize font-semibold text-primary-700">
                                      {m.timing?.replace("_", " ")}
                                    </span>
                                    {m.instructions && ` • ${m.instructions}`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {rx.generalInstructions && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                            <span className="font-bold text-slate-700">General Advice:</span>{" "}
                            <span className="text-slate-600">{rx.generalInstructions}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DIAGNOSES */}
            {activeTab === "diagnoses" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 text-sm">Problem List & ICD Diagnoses ({diagnosesList.length})</h2>
                  {(isDoctor || isAdmin) && (
                    <button
                      onClick={() => setShowDiagModal(true)}
                      className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>➕</span> Add Diagnosis
                    </button>
                  )}
                </div>

                {loadingDiagnoses ? (
                  <div className="h-40 flex items-center justify-center bg-white rounded-2xl border">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : diagnosesList.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">🏷️</span>
                    <p className="font-bold text-sm">No documented diagnoses for this patient.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {diagnosesList.map((d) => (
                      <div key={d._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {d.code}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              d.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {d.status}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-1.5">{d.label}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Category: {d.category} • Diagnosed: {new Date(d.diagnosedDate).toLocaleDateString()}</p>
                          {d.notes && <p className="text-xs text-slate-600 mt-1 italic">{d.notes}</p>}
                        </div>

                        {(isDoctor || isAdmin) && (
                          <button
                            onClick={() => handleToggleDiagStatus(d)}
                            className="text-xs font-bold text-slate-500 hover:text-primary-700 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                          >
                            Mark {d.status === "active" ? "Resolved" : "Active"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: FOLLOW-UPS */}
            {activeTab === "followups" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 text-sm">Follow-Up Consultations ({followUps.length})</h2>
                  {(isDoctor || isAdmin) && (
                    <button
                      onClick={() => setShowFollowUpModal(true)}
                      className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>➕</span> Schedule Follow-Up
                    </button>
                  )}
                </div>

                {loadingFollowUps ? (
                  <div className="h-40 flex items-center justify-center bg-white rounded-2xl border">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : followUps.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">🗓️</span>
                    <p className="font-bold text-sm">No follow-ups scheduled for this patient.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followUps.map((f) => (
                      <div key={f._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                              Due: {new Date(f.dueDate).toLocaleDateString()}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              f.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                              f.status === "requested_by_patient" ? "bg-amber-100 text-amber-700 animate-pulse" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {f.status.replace("_", " ")}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">{f.reason}</h4>
                          {f.plan && <p className="text-xs text-slate-500 mt-0.5">Plan: {f.plan}</p>}
                        </div>

                        {f.status === "requested_by_patient" && (isDoctor || isAdmin) && (
                          <button
                            onClick={async () => {
                              await API.patch(`/emr/follow-ups/${f._id}/approve`, { status: "approved" });
                              toast.success("Follow-up approved");
                              fetchPatientData();
                            }}
                            className="btn-primary py-1.5 px-3 text-xs font-bold"
                          >
                            Approve Request
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CLINICAL NOTE EDITOR MODAL ── */}
        {showNoteEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {amendingNote ? `Amend Clinical Note (v${amendingNote.version + 1})` : "Author Clinical Note"}
                  </h3>
                  <p className="text-xs text-slate-400">Patient: {selectedPatient?.name} ({selectedPatient?.mrn})</p>
                </div>
                <button onClick={() => setShowNoteEditor(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              {amendingNote && (
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <label className="text-xs font-bold text-purple-900 block mb-1">
                    Amendment Rationale (Required for Compliance)
                  </label>
                  <input
                    type="text"
                    required
                    value={amendmentReason}
                    onChange={(e) => setAmendmentReason(e.target.value)}
                    placeholder="e.g. Added lab findings, updated medication plan..."
                    className="input text-xs"
                  />
                </div>
              )}

              {/* Vitals Form Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800">Physical Vitals</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <input placeholder="BP (120/80)" value={noteForm.vitals.bloodPressure} onChange={(e) => handleVitalChange("bloodPressure", e.target.value)} className="input text-xs py-1.5" />
                  <input placeholder="Heart Rate (bpm)" type="number" value={noteForm.vitals.heartRate} onChange={(e) => handleVitalChange("heartRate", e.target.value)} className="input text-xs py-1.5" />
                  <input placeholder="Temp (°F)" type="number" value={noteForm.vitals.temperature} onChange={(e) => handleVitalChange("temperature", e.target.value)} className="input text-xs py-1.5" />
                  <input placeholder="SpO2 (%)" type="number" value={noteForm.vitals.spO2} onChange={(e) => handleVitalChange("spO2", e.target.value)} className="input text-xs py-1.5" />
                  <input placeholder="Resp Rate (/min)" type="number" value={noteForm.vitals.respiratoryRate} onChange={(e) => handleVitalChange("respiratoryRate", e.target.value)} className="input text-xs py-1.5" />
                  <input placeholder="Weight (kg)" type="number" value={noteForm.vitals.weight} onChange={(e) => handleVitalChange("weight", e.target.value)} className="input text-xs py-1.5" />
                  <input placeholder="Height (cm)" type="number" value={noteForm.vitals.height} onChange={(e) => handleVitalChange("height", e.target.value)} className="input text-xs py-1.5" />
                  <div className="input py-1.5 text-xs bg-slate-100 flex items-center justify-between text-slate-600 font-bold">
                    <span>BMI:</span> <span>{noteForm.vitals.bmi || "—"}</span>
                  </div>
                </div>
              </div>

              {/* SOAP Sections */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Chief Complaint *</label>
                  <input
                    required
                    value={noteForm.chiefComplaint}
                    onChange={(e) => setNoteForm({ ...noteForm, chiefComplaint: e.target.value })}
                    placeholder="e.g. Severe throbbing migraine for 2 days"
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">History of Present Illness (HPI)</label>
                  <textarea
                    rows={2}
                    value={noteForm.historyOfPresentIllness}
                    onChange={(e) => setNoteForm({ ...noteForm, historyOfPresentIllness: e.target.value })}
                    placeholder="Onset, character, duration, aggravating/relieving factors..."
                    className="input text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Physical Examination</label>
                    <textarea
                      rows={2}
                      value={noteForm.examination}
                      onChange={(e) => setNoteForm({ ...noteForm, examination: e.target.value })}
                      placeholder="General appearance, chest, CVS, abdomen..."
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Assessment & Evaluation</label>
                    <textarea
                      rows={2}
                      value={noteForm.assessment}
                      onChange={(e) => setNoteForm({ ...noteForm, assessment: e.target.value })}
                      placeholder="Clinical diagnosis impressions..."
                      className="input text-xs"
                    />
                  </div>
                </div>

                {/* ICD Quick Presets & Diagnosis Chips */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Diagnoses (ICD Codes)</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ICD_PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.code}
                        onClick={() => handleApplyPreset(p)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 hover:border-primary-400 bg-slate-50 hover:bg-primary-50 transition"
                      >
                        + {p.code} ({p.label.split(" ")[0]})
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-2">
                    <input
                      placeholder="Code (e.g. I10)"
                      value={newDiagCode}
                      onChange={(e) => setNewDiagCode(e.target.value)}
                      className="input text-xs max-w-[120px]"
                    />
                    <input
                      placeholder="Label (e.g. Hypertension)"
                      value={newDiagLabel}
                      onChange={(e) => setNewDiagLabel(e.target.value)}
                      className="input text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddDiagnosisToNote}
                      className="btn-secondary text-xs px-3 font-bold"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {noteForm.diagnoses.map((d, idx) => (
                      <span key={idx} className="bg-primary-50 border border-primary-200 text-primary-700 px-2 py-0.5 rounded text-xs flex items-center gap-1 font-bold">
                        {d.code}: {d.label}
                        <button
                          type="button"
                          onClick={() => setNoteForm({ ...noteForm, diagnoses: noteForm.diagnoses.filter((_, i) => i !== idx) })}
                          className="hover:text-rose-600"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Treatment Plan & Guidelines</label>
                  <textarea
                    rows={2}
                    value={noteForm.plan}
                    onChange={(e) => setNoteForm({ ...noteForm, plan: e.target.value })}
                    placeholder="Medications advised, dietary lifestyle modifications, follow-up..."
                    className="input text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNoteEditor(false)}
                  className="btn-secondary text-xs py-2.5 px-4 font-bold"
                >
                  Cancel
                </button>
                {!amendingNote && (
                  <button
                    type="button"
                    disabled={savingNote}
                    onClick={() => handleSaveNote(false)}
                    className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                  >
                    Save as Draft
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingNote}
                  onClick={() => handleSaveNote(true)}
                  className="flex-1 btn-primary text-xs py-2.5 font-bold shadow-sm"
                >
                  {savingNote ? "Signing..." : "🔒 Sign & Lock Note"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── WRITE PRESCRIPTION MODAL ── */}
        {showRxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <span>💊</span> Issue Formal Prescription
                </h3>
                <button onClick={() => setShowRxModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleSavePrescription} className="space-y-4">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">Medicines ({medicines.length})</span>
                    <button
                      type="button"
                      onClick={handleAddMedicineRow}
                      className="text-xs font-bold text-primary-600 hover:underline"
                    >
                      + Add Medicine
                    </button>
                  </div>

                  {medicines.map((med, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">#{idx + 1} Medication</span>
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicineRow(idx)}
                            className="text-[11px] text-rose-500 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          required
                          placeholder="Medicine name (e.g. Paracetamol 650mg)"
                          value={med.name}
                          onChange={(e) => handleMedicineChange(idx, "name", e.target.value)}
                          className="input text-xs font-semibold sm:col-span-2"
                        />
                        <input
                          placeholder="Dosage (e.g. 1 tab)"
                          value={med.dosage}
                          onChange={(e) => handleMedicineChange(idx, "dosage", e.target.value)}
                          className="input text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          placeholder="Frequency (e.g. 1-0-1)"
                          value={med.frequency}
                          onChange={(e) => handleMedicineChange(idx, "frequency", e.target.value)}
                          className="input text-xs"
                        />
                        <input
                          placeholder="Duration (e.g. 5 days)"
                          value={med.duration}
                          onChange={(e) => handleMedicineChange(idx, "duration", e.target.value)}
                          className="input text-xs"
                        />
                        <select
                          value={med.timing}
                          onChange={(e) => handleMedicineChange(idx, "timing", e.target.value)}
                          className="input text-xs font-semibold"
                        >
                          <option value="after_food">After Food</option>
                          <option value="before_food">Before Food</option>
                          <option value="with_food">With Food</option>
                          <option value="empty_stomach">Empty Stomach</option>
                          <option value="bedtime">Bedtime</option>
                          <option value="as_needed">As Needed (SOS)</option>
                        </select>
                      </div>

                      <input
                        placeholder="Additional instructions (e.g. take with lukewarm water)"
                        value={med.instructions}
                        onChange={(e) => handleMedicineChange(idx, "instructions", e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">General Advice & Notes</label>
                  <textarea
                    rows={2}
                    value={rxInstructions}
                    onChange={(e) => setRxInstructions(e.target.value)}
                    placeholder="e.g. Drink plenty of fluids, rest adequately, return if symptoms persist..."
                    className="input text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowRxModal(false)}
                    className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRx}
                    className="flex-1 btn-primary text-xs py-2.5 font-bold shadow-sm"
                  >
                    {savingRx ? "Signing..." : "Sign & Issue Prescription"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── ADD DIAGNOSIS MODAL ── */}
        {showDiagModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>🏷️</span> Record Clinical Diagnosis
              </h3>
              <form onSubmit={handleSaveDiagnosis} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700">ICD Code *</label>
                  <input
                    required
                    value={diagForm.code}
                    onChange={(e) => setDiagForm({ ...diagForm, code: e.target.value })}
                    placeholder="e.g. I10"
                    className="input mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Diagnosis Description *</label>
                  <input
                    required
                    value={diagForm.label}
                    onChange={(e) => setDiagForm({ ...diagForm, label: e.target.value })}
                    placeholder="e.g. Essential hypertension"
                    className="input mt-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700">Category</label>
                    <input
                      value={diagForm.category}
                      onChange={(e) => setDiagForm({ ...diagForm, category: e.target.value })}
                      placeholder="e.g. Cardiovascular"
                      className="input mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Status</label>
                    <select
                      value={diagForm.status}
                      onChange={(e) => setDiagForm({ ...diagForm, status: e.target.value })}
                      className="input mt-1 text-xs font-semibold"
                    >
                      <option value="active">Active</option>
                      <option value="chronic">Chronic</option>
                      <option value="resolved">Resolved</option>
                      <option value="in_remission">In Remission</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Clinical Notes</label>
                  <textarea
                    rows={2}
                    value={diagForm.notes}
                    onChange={(e) => setDiagForm({ ...diagForm, notes: e.target.value })}
                    placeholder="Observations, stage, severity..."
                    className="input mt-1 text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowDiagModal(false)} className="flex-1 btn-secondary text-xs py-2.5 font-bold">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary text-xs py-2.5 font-bold">
                    Save Diagnosis
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── SCHEDULE FOLLOW-UP MODAL ── */}
        {showFollowUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>🗓️</span> Schedule Follow-Up Consultation
              </h3>
              <form onSubmit={handleSaveFollowUp} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Due Date *</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={followUpForm.dueDate}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value })}
                    className="input mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Reason for Follow-Up *</label>
                  <input
                    required
                    value={followUpForm.reason}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, reason: e.target.value })}
                    placeholder="e.g. Blood pressure monitoring & dosage titration"
                    className="input mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Target Plan / Tests to Bring</label>
                  <textarea
                    rows={2}
                    value={followUpForm.plan}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, plan: e.target.value })}
                    placeholder="e.g. Bring fasting blood sugar report"
                    className="input mt-1 text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowFollowUpModal(false)} className="flex-1 btn-secondary text-xs py-2.5 font-bold">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary text-xs py-2.5 font-bold">
                    Schedule Follow-Up
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── AI VISIT SUMMARY CLINICIAN REVIEW MODAL ── */}
        {showAiSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      Clinician Review: AI Visit Summary Draft
                    </h3>
                    <p className="text-xs text-slate-400">
                      Safety-critical human-in-the-loop review before chart attachment
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiSummaryModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Safety Banner */}
              <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <span>⚠️</span> CLINICIAN REVIEW REQUIRED
                </div>
                <p className="leading-relaxed text-amber-700">
                  This summary is an AI-generated draft. As the attending clinician, verify all facts, 
                  assessments, and recommendations for accuracy. You may edit the draft text below before signing. 
                  Approval will be logged in the immutable audit trail with AI provenance.
                </p>
              </div>

              {generatingAiSummary ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500 animate-pulse">
                    Synthesizing structured clinical note with AI guardrails...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    Verified Clinical Summary (Editable by Clinician):
                  </label>
                  <textarea
                    rows={8}
                    value={aiDraftSummary}
                    onChange={(e) => setAiDraftSummary(e.target.value)}
                    placeholder="Enter or adjust the clinical summary..."
                    className="input text-xs leading-relaxed font-sans"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Draft generated via Anthropic Messages API (PII Redacted)</span>
                    <span>{aiDraftSummary.length} characters</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAiSummaryModal(false)}
                  className="btn-secondary text-xs py-2.5 px-4 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={generatingAiSummary || approvingAiSummary || !aiDraftSummary.trim()}
                  onClick={handleApproveAiSummary}
                  className="flex-1 btn-primary text-xs py-2.5 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {approvingAiSummary ? (
                    "Approving & Logging..."
                  ) : (
                    <>
                      <span>🔒</span> Approve & Attach to Chart (Audit Logged)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI PATIENT EXPLANATION MODAL (DOCTOR VIEW) ── */}
        {showAiExplanationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      AI Plain-Language Medication Guide
                    </h3>
                    <p className="text-xs text-slate-400">
                      Educational patient instructions synthesized with strict safety guardrails
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiExplanationModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Guardrail Disclaimer Banner */}
              <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl text-blue-900 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-blue-800 mb-1">
                  <span>ℹ️</span> Educational Patient Instructions
                </div>
                <p className="text-blue-700 leading-relaxed">
                  Strictly explains timing and general precautions. Does not modify dosages, alter treatment,
                  or diagnose new symptoms.
                </p>
              </div>

              {generatingAiExplanation ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500 animate-pulse">
                    Translating medical instructions into clear, accessible plain language...
                  </p>
                </div>
              ) : aiExplanationData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                    {aiExplanationData.explanation}
                  </div>

                  {aiExplanationData.disclaimer && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 italic">
                      <span className="font-bold not-italic">Medical Disclaimer: </span>
                      {aiExplanationData.disclaimer}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2 border-t">
                {aiExplanationData && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiExplanationData.explanation);
                      toast.success("Explanation copied to clipboard!");
                    }}
                    className="btn-secondary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5"
                  >
                    <span>📋</span> Copy Guide
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAiExplanationModal(false)}
                  className="btn-primary text-xs py-2 px-4 font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
