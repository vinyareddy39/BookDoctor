import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { exportPrescriptionToPDF, exportLabReportToPDF } from "../utils/export";
import toast from "react-hot-toast";

export default function PatientFollowUps() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("prescriptions"); // 'prescriptions' | 'followups' | 'diagnoses' | 'lab-orders'
  const [prescriptions, setPrescriptions] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Request Follow-up modal
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  const [preferredDate, setPreferredDate] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // AI Plain-Language Explanations (Safety Guardrails)
  const [loadingAiExplanation, setLoadingAiExplanation] = useState(false);
  const [aiExplanationData, setAiExplanationData] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [rxRes, fuRes, diagRes, labRes] = await Promise.all([
        API.get("/emr/prescriptions"),
        API.get("/emr/follow-ups"),
        API.get("/emr/diagnoses"),
        API.get("/lab/orders").catch(() => ({ data: { data: [] } })),
      ]);
      setPrescriptions(rxRes.data?.data || []);
      setFollowUps(fuRes.data?.data || []);
      setDiagnoses(diagRes.data?.data || []);
      setLabOrders(labRes.data?.data || []);
    } catch (err) {
      console.warn("Failed to load patient records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFollowUp) return;
    setSubmittingRequest(true);
    try {
      await API.patch(`/emr/follow-ups/${selectedFollowUp._id}/request`, {
        requestedDate: preferredDate,
        patientNotes,
      });
      toast.success("Follow-up request sent to your doctor!");
      setSelectedFollowUp(null);
      setPreferredDate("");
      setPatientNotes("");
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleExplainPrescription = async (rx) => {
    setLoadingAiExplanation(true);
    setShowAiModal(true);
    try {
      const res = await API.post("/ai/explain-instructions", {
        medicines: rx.medicines || [],
        lifestyleAdvice: rx.generalInstructions || "",
      });
      setAiExplanationData(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate plain-language explanation");
      setShowAiModal(false);
    } finally {
      setLoadingAiExplanation(false);
    }
  };

  const handleExplainFollowUp = async (f) => {
    setLoadingAiExplanation(true);
    setShowAiModal(true);
    try {
      const res = await API.post("/ai/explain-instructions", {
        medicines: [],
        followUpPlan: `Follow-up Reason: ${f.reason}. Doctor's Plan: ${f.plan || "Review recovery"}`,
      });
      setAiExplanationData(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate plain-language explanation");
      setShowAiModal(false);
    } finally {
      setLoadingAiExplanation(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>📋</span> My Medical Care & Prescriptions
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Access your electronic prescriptions, diagnoses, and follow-up consultation requests
            </p>
          </div>

          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white font-semibold text-xs border border-rose-200 hover:border-rose-500 transition-all shadow-xs self-start sm:self-auto"
            title="Logout from Patient Portal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap rounded-2xl bg-white p-1.5 border border-slate-200/80 shadow-sm gap-1">
          {[
            { id: "prescriptions", label: `Prescriptions (${prescriptions.length})`, icon: "💊" },
            { id: "followups", label: `Follow-Ups (${followUps.length})`, icon: "🗓️" },
            { id: "diagnoses", label: `Diagnoses & Health (${diagnoses.length})`, icon: "🏷️" },
            { id: "lab-orders", label: `Lab Reports (${labOrders.length})`, icon: "🧪" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
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

        {/* Loading Spinner */}
        {loading ? (
          <div className="h-48 flex items-center justify-center bg-white rounded-2xl border">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* PRESCRIPTIONS */}
            {activeTab === "prescriptions" && (
              <div className="space-y-4">
                {prescriptions.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">💊</span>
                    <p className="font-bold text-sm">No electronic prescriptions found.</p>
                  </div>
                ) : (
                  prescriptions.map((rx) => (
                    <div key={rx._id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <h3 className="font-black text-slate-900 text-sm">
                            Prescribed by Dr. {rx.doctorId?.userId?.name || "Doctor"}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {new Date(rx.signedAt || rx.createdAt).toLocaleDateString()} • Valid for 30 days
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExplainPrescription(rx)}
                            className="btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 shadow-xs"
                          >
                            <span>✨</span> Explain in Plain English
                          </button>
                          <button
                            onClick={() => exportPrescriptionToPDF(rx)}
                            className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                          >
                            <span>📄</span> Download PDF
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                            <tr>
                              <th className="p-2.5">Medicine</th>
                              <th className="p-2.5">Dosage</th>
                              <th className="p-2.5">Frequency</th>
                              <th className="p-2.5">Duration</th>
                              <th className="p-2.5">When to take</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rx.medicines?.map((m, idx) => (
                              <tr key={idx}>
                                <td className="p-2.5 font-bold text-slate-900">{m.name}</td>
                                <td className="p-2.5 text-slate-600">{m.dosage}</td>
                                <td className="p-2.5 text-slate-600">{m.frequency}</td>
                                <td className="p-2.5 text-slate-600">{m.duration}</td>
                                <td className="p-2.5 font-semibold text-primary-700 capitalize">
                                  {m.timing?.replace("_", " ")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {rx.generalInstructions && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                          <span className="font-bold text-slate-700">Doctor's Advice:</span> {rx.generalInstructions}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* FOLLOW-UPS */}
            {activeTab === "followups" && (
              <div className="space-y-4">
                {followUps.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">🗓️</span>
                    <p className="font-bold text-sm">No follow-ups recommended at this time.</p>
                  </div>
                ) : (
                  followUps.map((f) => (
                    <div key={f._id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                            Due on {new Date(f.dueDate).toLocaleDateString()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            f.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                            f.status === "requested_by_patient" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {f.status.replace("_", " ")}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm mt-1">{f.reason}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Dr. {f.doctorId?.userId?.name || "Doctor"} {f.plan && `• Plan: ${f.plan}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExplainFollowUp(f)}
                          className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                        >
                          <span>✨</span> Plain Guide
                        </button>
                        {f.status === "pending" && (
                          <button
                            onClick={() => {
                              setSelectedFollowUp(f);
                              setPreferredDate(new Date(f.dueDate).toISOString().split("T")[0]);
                            }}
                            className="btn-primary py-1.5 px-3.5 text-xs font-bold whitespace-nowrap"
                          >
                            Request Schedule
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* DIAGNOSES */}
            {activeTab === "diagnoses" && (
              <div className="space-y-4">
                {diagnoses.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">🏷️</span>
                    <p className="font-bold text-sm">No health conditions or diagnoses documented.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {diagnoses.map((d) => (
                      <div key={d._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
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
                        <p className="text-xs text-slate-400 mt-0.5">Diagnosed on {new Date(d.diagnosedDate).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LAB ORDERS & RESULTS */}
            {activeTab === "lab-orders" && (
              <div className="space-y-4">
                {labOrders.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border text-center text-slate-400">
                    <span className="text-4xl block mb-2">🧪</span>
                    <p className="font-bold text-sm">No diagnostic lab requisitions found.</p>
                  </div>
                ) : (
                  labOrders.map((order) => {
                    const isReleased = order.status === "released";
                    const docName = order.doctorId?.userId?.name || order.doctorId?.name || "Doctor";
                    const params = order.labResultId?.parameters || [];

                    return (
                      <div key={order._id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                {order.orderNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  isReleased
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-100 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {isReleased ? "Report Ready" : order.status.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Requisitioned by Dr. {docName} • {new Date(order.orderedAt).toLocaleDateString()}
                            </p>
                          </div>

                          {isReleased && (
                            <button
                              onClick={() => exportLabReportToPDF(order)}
                              className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
                            >
                              <span>📄</span> Download Lab Report (PDF)
                            </button>
                          )}
                        </div>

                        {/* Tests requested */}
                        <div className="flex flex-wrap gap-1.5">
                          {order.tests?.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>

                        {/* Findings preview if released */}
                        {isReleased && params.length > 0 ? (
                          <div className="overflow-x-auto border border-slate-100 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                <tr>
                                  <th className="py-2 px-3">Test Parameter</th>
                                  <th className="py-2 px-3">Result Value</th>
                                  <th className="py-2 px-3">Reference Range</th>
                                  <th className="py-2 px-3">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {params.map((p, pIdx) => (
                                  <tr key={pIdx}>
                                    <td className="py-2 px-3 font-semibold text-slate-800">{p.name}</td>
                                    <td className="py-2 px-3 font-bold text-slate-900">{p.value} {p.unit}</td>
                                    <td className="py-2 px-3 text-slate-400">{p.referenceRange || "-"}</td>
                                    <td className="py-2 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          p.flag === "normal"
                                            ? "text-emerald-700 bg-emerald-50"
                                            : "text-rose-700 bg-rose-50"
                                        }`}
                                      >
                                        {p.flag}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : !isReleased ? (
                          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/70 text-xs text-amber-800 flex items-center gap-2">
                            <span className="text-base">⏳</span>
                            <span>
                              Specimen is currently being analyzed by the laboratory. Detailed values will be accessible here immediately upon official pathologist release.
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* Request Schedule Modal */}
        {selectedFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-fade-in">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>🗓️</span> Request Follow-Up Appointment
              </h3>
              <p className="text-xs text-slate-500">
                Choose your preferred date for follow-up with Dr. {selectedFollowUp.doctorId?.userId?.name}. The clinic will confirm your consultation slot.
              </p>

              <form onSubmit={handleRequestSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Preferred Date *</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="input mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Notes / Current Symptoms</label>
                  <textarea
                    rows={2}
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    placeholder="e.g. Feeling better, finished medication course..."
                    className="input mt-1 text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setSelectedFollowUp(null)} className="flex-1 btn-secondary text-xs py-2.5 font-bold">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingRequest} className="flex-1 btn-primary text-xs py-2.5 font-bold">
                    {submittingRequest ? "Sending..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── AI PLAIN LANGUAGE EXPLANATION MODAL (PATIENT-FACING) ── */}
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      Easy-to-Understand Care Instructions
                    </h3>
                    <p className="text-xs text-slate-400">
                      Plain-language summary of your doctor's prescriptions and advice
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Safety & Educational Disclaimer */}
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <span>ℹ️</span> Educational Medical Summary
                </div>
                <p className="leading-relaxed text-amber-800">
                  This explanation is prepared for your personal understanding. It does not replace 
                  your doctor's direct advice, diagnose new illnesses, or alter prescribed dosages. 
                  Always take medicines exactly as your prescription directs.
                </p>
              </div>

              {loadingAiExplanation ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500 animate-pulse">
                    Translating medical instructions into plain English...
                  </p>
                </div>
              ) : aiExplanationData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                    {aiExplanationData.explanation}
                  </div>

                  {aiExplanationData.disclaimer && (
                    <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-500 italic">
                      <span className="font-bold not-italic">Safety Notice: </span>
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
                      toast.success("Instructions copied to clipboard!");
                    }}
                    className="btn-secondary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5"
                  >
                    <span>📋</span> Copy to Clipboard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="btn-primary text-xs py-2 px-4 font-bold"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
