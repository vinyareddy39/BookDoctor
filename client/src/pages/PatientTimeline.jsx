import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  exportPrescriptionToPDF,
  exportLabReportToPDF,
  exportInvoiceToPDF,
} from "../utils/export";
import toast from "react-hot-toast";

export default function PatientTimeline() {
  const { patientId } = useParams();
  const { user, isDoctor, isAdmin, isClinicAdmin, isReceptionist } = useAuth();
  const canUploadDocs = true; // Any authenticated user or staff

  const [patient, setPatient] = useState(null);
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Upload Document Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = patientId ? `/patients/${patientId}/timeline` : `/patients/me/timeline`;
      const res = await API.get(endpoint);
      setPatient(res.data?.data?.patient || null);
      setEvents(res.data?.data?.events || []);
      setCounts(res.data?.data?.counts || {});
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load patient timeline");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Upload Document
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", selectedFile);
      formData.append("title", uploadTitle);
      formData.append("notes", uploadNotes);
      if (patientId) formData.append("patientId", patientId);

      await API.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Document uploaded securely");
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadNotes("");
      setSelectedFile(null);
      fetchTimeline();
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Filter & Search Events
  const filteredEvents = events.filter((e) => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const title = e.title?.toLowerCase() || "";
      const subtitle = e.subtitle?.toLowerCase() || "";
      if (!title.includes(term) && !subtitle.includes(term)) return false;
    }
    return true;
  });

  const getEventBadge = (type) => {
    switch (type) {
      case "appointment":
        return { label: "Appointment", bg: "bg-blue-50 text-blue-700 border-blue-200", icon: "🗓️" };
      case "clinical_note":
        return { label: "EMR Note", bg: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "🩺" };
      case "prescription":
        return { label: "Prescription", bg: "bg-teal-50 text-teal-700 border-teal-200", icon: "💊" };
      case "lab_order":
        return { label: "Lab Diagnostic", bg: "bg-purple-50 text-purple-700 border-purple-200", icon: "🧪" };
      case "invoice":
        return { label: "Billing & Invoice", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🧾" };
      case "document":
        return { label: "Document", bg: "bg-sky-50 text-sky-700 border-sky-200", icon: "📎" };
      default:
        return { label: "Record", bg: "bg-slate-100 text-slate-700 border-slate-200", icon: "📋" };
    }
  };

  return (
    <div className="section py-8 max-w-6xl mx-auto space-y-6">
      {/* Patient Header Card */}
      {patient && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-primary-500/20">
              {patient.name?.charAt(0) || "P"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">{patient.name}</h1>
                {patient.mrn && (
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                    MRN: {patient.mrn}
                  </span>
                )}
                {patient.bloodGroup && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                    {patient.bloodGroup}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                <span>Phone: <b className="text-slate-700">{patient.phone || "N/A"}</b></span>
                {patient.gender && (
                  <span>Gender: <b className="text-slate-700 capitalize">{patient.gender}</b></span>
                )}
                {patient.dob && (
                  <span>Age: <b className="text-slate-700">{new Date().getFullYear() - new Date(patient.dob).getFullYear()}y</b></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-2"
            >
              <span>📎</span>
              <span>Upload Document</span>
            </button>

            {isDoctor && (
              <Link
                to="/emr"
                className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
              >
                <span>🩺</span>
                <span>Open in EMR</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Consultations", count: counts.appointments || 0, icon: "🗓️", type: "appointment" },
          { label: "EMR Notes", count: counts.clinicalNotes || 0, icon: "🩺", type: "clinical_note" },
          { label: "Prescriptions", count: counts.prescriptions || 0, icon: "💊", type: "prescription" },
          { label: "Lab Orders", count: counts.labOrders || 0, icon: "🧪", type: "lab_order" },
          { label: "Invoices", count: counts.invoices || 0, icon: "🧾", type: "invoice" },
          { label: "Documents", count: counts.documents || 0, icon: "📎", type: "document" },
        ].map((item) => (
          <div
            key={item.label}
            onClick={() => setFilterType(filterType === item.type ? "all" : item.type)}
            className={`p-3.5 rounded-2xl border cursor-pointer transition ${
              filterType === item.type
                ? "bg-primary-50 border-primary-500 shadow-md ring-2 ring-primary-500/20"
                : "bg-white border-slate-200/80 hover:border-slate-300 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-base">{item.icon}</span>
              <span className="font-mono font-bold text-slate-400">{item.count}</span>
            </div>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline Controls (Filter Pills & Search) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All History" },
            { id: "appointment", label: "Appointments" },
            { id: "clinical_note", label: "EMR Notes" },
            { id: "prescription", label: "Prescriptions" },
            { id: "lab_order", label: "Lab Tests" },
            { id: "invoice", label: "Invoices" },
            { id: "document", label: "Documents" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filterType === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search timeline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-8 py-1.5 text-xs rounded-xl bg-slate-50 border-slate-200 w-full"
          />
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Chronological Vertical Timeline */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-bold text-slate-500">Constructing chronological health timeline…</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <span className="text-3xl block mb-2">📜</span>
          <h3 className="text-base font-bold text-slate-800">No medical timeline events found</h3>
          <p className="text-xs text-slate-400 mt-1">Try resetting the event type filter or search term</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-4 sm:ml-6 space-y-6 pb-8">
          {filteredEvents.map((event, idx) => {
            const badge = getEventBadge(event.type);
            const dateStr = new Date(event.timestamp).toLocaleDateString([], {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            const timeStr = new Date(event.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={idx} className="relative pl-6 sm:pl-8 group">
                {/* Timeline Node Point */}
                <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-white border-2 border-slate-300 group-hover:border-primary-500 flex items-center justify-center text-sm shadow-xs transition">
                  {badge.icon}
                </div>

                {/* Event Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 p-5 shadow-xs hover:shadow-md transition space-y-3">
                  {/* Event Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      {event.status && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                          {event.status}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {dateStr} • {timeStr}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{event.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{event.subtitle}</p>
                  </div>

                  {/* Specific Body Content by Type */}
                  {event.type === "clinical_note" && event.data && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1.5 text-slate-700">
                      {event.data.assessment && (
                        <p><b className="text-slate-900">Assessment:</b> {event.data.assessment}</p>
                      )}
                      {event.data.plan && (
                        <p><b className="text-slate-900">Plan:</b> {event.data.plan}</p>
                      )}
                      {event.data.vitals?.bloodPressure && (
                        <p className="text-[11px] text-slate-500 font-mono">
                          Vitals: BP {event.data.vitals.bloodPressure} | HR {event.data.vitals.heartRate || "-"} | SpO2 {event.data.vitals.spO2 || "-"}%
                        </p>
                      )}
                    </div>
                  )}

                  {event.type === "prescription" && event.data && (
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1">
                        {event.data.medicines?.map((m, mIdx) => (
                          <span key={mIdx} className="text-xs px-2 py-0.5 bg-teal-50 text-teal-800 rounded font-medium">
                            {m.name} ({m.dosage})
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => exportPrescriptionToPDF(event.data)}
                        className="btn-primary py-1.5 px-3 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                      >
                        <span>📄</span> PDF
                      </button>
                    </div>
                  )}

                  {event.type === "lab_order" && event.data && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500">
                        Status: <b className="text-slate-800 capitalize">{event.data.status}</b>
                      </span>
                      {event.data.status === "released" && (
                        <button
                          onClick={() => exportLabReportToPDF(event.data)}
                          className="btn-primary py-1.5 px-3 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                        >
                          <span>📄</span> Lab Report PDF
                        </button>
                      )}
                    </div>
                  )}

                  {event.type === "invoice" && event.data && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-slate-600">
                        Paid: <b className="text-emerald-700">₹{event.data.paidAmount}</b> / ₹{event.data.totalAmount}
                      </span>
                      <button
                        onClick={() => exportInvoiceToPDF(event.data)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <span>📄</span> Invoice PDF
                      </button>
                    </div>
                  )}

                  {event.type === "document" && event.data && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500 font-mono">
                        Format: {event.data.fileType?.toUpperCase()}
                      </span>
                      <a
                        href={`${API.defaults.baseURL || "/api"}/documents/${event.data._id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <span>⬇️</span> View / Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Upload Medical Document ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>📎</span> Secure Medical Upload
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chest X-Ray Report, Previous Discharge Summary"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select File (PDF, JPG, PNG - Max 10MB) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,image/jpeg,image/png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="input w-full py-1.5"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Clinical Annotations (Optional)</label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. Performed at external radiology facility on 12-Mar."
                  className="input w-full"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 btn-primary text-xs py-2.5 font-bold"
                >
                  {uploading ? "Uploading Securely…" : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
