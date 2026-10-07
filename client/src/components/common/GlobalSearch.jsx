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
      setTimeout(() => inputRef.current?.focus(), 50);
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
        setResults(res.data?.data);
      } catch (err) {
        console.warn("Global search error:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url) => {
    setIsOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Trigger Button in Header */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 p-2 xl:px-3 xl:py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-500 text-xs font-medium transition flex-shrink-0"
        title="Search Portal (Ctrl+K)"
        aria-label="Search Portal"
      >
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden 2xl:inline">Search portal…</span>
        <kbd className="hidden 2xl:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Search Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patients by name/phone/MRN, appointments, invoices, or lab orders..."
                className="w-full text-sm font-medium text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold"
                >
                  ESC
                </button>
              )}
            </div>

            {/* Results Body */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {!results && !loading && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p className="font-semibold">Type a patient name, MRN, invoice number, or lab test to search</p>
                </div>
              )}

              {results && (
                <>
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
                            onClick={() => handleSelect("/calendar")}
                            className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">🗓️</span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {a.patientId?.name || "Patient"} • Token #{a.tokenNumber || "N/A"}
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
                  {results.patients?.length === 0 &&
                    results.appointments?.length === 0 &&
                    results.invoices?.length === 0 &&
                    results.labOrders?.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <p className="font-semibold">No records found matching "{query}"</p>
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
