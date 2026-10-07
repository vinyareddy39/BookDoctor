import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await API.get(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data?.data || null);
      } catch (err) {
        console.warn("Global search error:", err);
        setResults({ doctors: [], patients: [], appointments: [], invoices: [], labOrders: [] });
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url) => {
    setIsOpen(false);
    navigate(url);
  };

  const handleQuickSearch = (term) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold transition shrink-0 border border-slate-200/60 shadow-sm cursor-pointer select-none"
        title="Search Portal (Ctrl+K)"
        aria-label="Search Portal"
      >
        <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden xl:inline whitespace-nowrap">Search...</span>
        <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Search Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-4 pt-12 sm:pt-20 animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 bg-white">
              <svg className="w-5 h-5 text-primary-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search doctors, specializations, appointments, records, or clinics..."
                className="w-full text-sm font-semibold text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold rounded-md hover:bg-slate-100 shrink-0"
                  title="Clear search"
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 text-xs font-bold rounded-md hover:bg-slate-100 shrink-0"
                  title="Close modal"
                >
                  ESC
                </button>
              )}
            </div>

            {/* Results Body */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {!results && !loading && (
                <div className="py-6 space-y-4">
                  <div className="text-center text-slate-500 text-xs">
                    <p className="font-semibold text-slate-700 text-sm mb-1">Instant Search</p>
                    <p>Find doctors, appointments, invoices, or medical records</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                      Quick Suggestions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["Cardiologist", "Dermatologist", "Pediatrician", "Dentist", "Neurologist", "Orthopedic"].map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => handleQuickSearch(term)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-primary-50 text-slate-600 hover:text-primary-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition"
                        >
                          🔍 {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {results && (
                <>
                  {/* DOCTORS */}
                  {results.doctors?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600 mb-2 px-1 flex items-center gap-1">
                        <span>👨‍⚕️</span> Verified Doctors ({results.doctors.length})
                      </p>
                      <div className="space-y-1.5">
                        {results.doctors.map((d) => (
                          <div
                            key={d._id}
                            onClick={() => handleSelect(`/book/${d._id}`)}
                            className="p-3 rounded-2xl hover:bg-primary-50/60 border border-slate-100 hover:border-primary-200 transition cursor-pointer flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                                {d.userId?.name?.charAt(0) || "D"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 group-hover:text-primary-700 truncate">
                                  Dr. {d.userId?.name}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  <span className="font-semibold text-primary-600">{d.specialization}</span>
                                  {d.clinicName ? ` · ${d.clinicName}` : ""}
                                  {d.city ? ` (${d.city})` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {d.consultationFee && (
                                <span className="text-xs font-extrabold text-slate-800">
                                  ₹{d.consultationFee}
                                </span>
                              )}
                              <span className="text-[11px] font-bold px-2.5 py-1 bg-primary-600 text-white rounded-lg shadow-sm group-hover:bg-primary-700 transition">
                                Book Now →
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PATIENTS */}
                  {results.patients?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                        Patients ({results.patients.length})
                      </p>
                      <div className="space-y-1">
                        {results.patients.map((p) => (
                          <div
                            key={p._id}
                            onClick={() => handleSelect(`/timeline/${p._id}`)}
                            className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">👤</span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">{p.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  MRN: <span className="font-mono text-primary-600 font-semibold">{p.mrn}</span> • Phone: {p.phone || "N/A"}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                              View Timeline →
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* APPOINTMENTS */}
                  {results.appointments?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                        Appointments ({results.appointments.length})
                      </p>
                      <div className="space-y-1">
                        {results.appointments.map((a) => (
                          <div
                            key={a._id}
                            onClick={() => handleSelect("/appointments")}
                            className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">🗓️</span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {a.patientId?.name || "Patient"} {a.tokenNumber ? `• Token #${a.tokenNumber}` : ""}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {new Date(a.appointmentDate).toLocaleDateString()} • Dr. {a.doctorId?.userId?.name || "Doctor"}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md uppercase">
                              {a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* INVOICES */}
                  {results.invoices?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                        Invoices ({results.invoices.length})
                      </p>
                      <div className="space-y-1">
                        {results.invoices.map((inv) => (
                          <div
                            key={inv._id}
                            onClick={() => handleSelect("/billing")}
                            className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">🧾</span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {inv.invoiceNumber} - ₹{inv.totalAmount}
                                </p>
                                <p className="text-[11px] text-slate-400">{inv.patientId?.name}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                              inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LAB ORDERS */}
                  {results.labOrders?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                        Lab Requisitions ({results.labOrders.length})
                      </p>
                      <div className="space-y-1">
                        {results.labOrders.map((lab) => (
                          <div
                            key={lab._id}
                            onClick={() => handleSelect("/lab")}
                            className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">🧪</span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {lab.orderNumber} ({lab.tests?.map((t) => t.name).join(", ")})
                                </p>
                                <p className="text-[11px] text-slate-400">{lab.patientId?.name}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md uppercase">
                              {lab.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty search */}
                  {(!results.doctors || results.doctors.length === 0) &&
                    (!results.patients || results.patients.length === 0) &&
                    (!results.appointments || results.appointments.length === 0) &&
                    (!results.invoices || results.invoices.length === 0) &&
                    (!results.labOrders || results.labOrders.length === 0) && (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <p className="font-semibold text-slate-600">No records found matching "{query}"</p>
                        <p className="text-[11px] mt-1 text-slate-400">Try searching for doctor names (e.g., Sharma), specializations (e.g., Cardiologist), or phone numbers</p>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
