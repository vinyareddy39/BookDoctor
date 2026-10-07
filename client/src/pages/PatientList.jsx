import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bloodFilter, setBloodFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const fetchPatients = async (targetPage = page) => {
    try {
      setLoading(true);
      const params = {
        page: targetPage,
        limit: 15,
      };
      if (search.trim()) params.search = search.trim();
      if (bloodFilter) params.bloodGroup = bloodFilter;

      const res = await API.get("/patients", { params });
      const payload = res.data?.data;
      setPatients(payload?.patients || []);
      setTotalPages(payload?.pagination?.pages || 1);
      setTotalPatients(payload?.pagination?.total || 0);
      setPage(payload?.pagination?.page || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load patient directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(1);
  }, [bloodFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPatients(1);
  };

  const handleViewPatient = async (id) => {
    try {
      const res = await API.get(`/patients/${id}`);
      setSelectedPatient(res.data?.data?.patient);
    } catch (err) {
      toast.error("Failed to load patient chart.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Clinical Registry</span>
              <span>/</span>
              <span>Patient Directory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>🗂️</span> Registered Patient Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Lookup patients by Name, Mobile Number, or Medical Record Number (MRN).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/reception/walk-in"
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-2"
            >
              <span>+</span>
              <span>Walk-In Registration</span>
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by Patient Name, Phone, MRN (e.g. MED-2026-00001)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={bloodFilter}
              onChange={(e) => setBloodFilter(e.target.value)}
              className="text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="">All Blood Groups</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
            >
              Search
            </button>
          </form>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
            <span>
              Total Patients: <strong className="text-slate-800">{totalPatients}</strong>
            </span>
          </div>
        </div>

        {/* Patient Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">MRN</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Gender / Blood</th>
                <th className="py-3 px-4">Dependents</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Searching patient directory...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No registered patients found.
                  </td>
                </tr>
              ) : (
                patients.map((pat) => (
                  <tr key={pat._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-primary-700 whitespace-nowrap">
                      {pat.mrn || "MED-AUTO"}
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900">
                      {pat.name}
                      {pat.dob && (
                        <span className="block font-normal text-[11px] text-slate-400">
                          DOB: {new Date(pat.dob).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{pat.phone || "—"}</td>
                    <td className="py-3 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {pat.gender || "—"} &bull; {pat.bloodGroup || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {pat.dependents?.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {pat.dependents.length} Dependents
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to={`/timeline/${pat._id}`}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition"
                      >
                        Timeline
                      </Link>
                      <button
                        onClick={() => handleViewPatient(pat._id)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition"
                      >
                        View Chart
                      </button>
                      <Link
                        to={`/book-appointment/${pat._id}`}
                        className="px-3 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold rounded-lg text-xs transition"
                      >
                        Book Visit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page <strong className="text-slate-800">{page}</strong> of {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchPatients(page - 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchPatients(page + 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Patient Details Modal */}
        {selectedPatient && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full font-mono">
                    MRN: {selectedPatient.mrn || "MED-AUTO"}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1">{selectedPatient.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block">Mobile Phone</span>
                  <span className="font-semibold text-slate-800">{selectedPatient.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Email</span>
                  <span className="font-semibold text-slate-800 truncate block">{selectedPatient.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Gender / Blood</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {selectedPatient.gender || "—"} &bull; {selectedPatient.bloodGroup || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Emergency Contact</span>
                  <span className="font-semibold text-slate-800">{selectedPatient.emergencyContact || "—"}</span>
                </div>
              </div>

              {/* Medical ID info */}
              <div className="space-y-2 text-xs">
                <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">Clinical Baseline</h4>
                <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-1">
                  <span className="font-bold text-red-800 block text-[11px]">Known Allergies:</span>
                  <p className="text-slate-700">{selectedPatient.medicalId?.allergies || "No drug allergies recorded."}</p>
                </div>
                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl space-y-1">
                  <span className="font-bold text-amber-800 block text-[11px]">Chronic Conditions:</span>
                  <p className="text-slate-700">{selectedPatient.medicalId?.conditions || "No chronic illnesses noted."}</p>
                </div>
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                  <span className="font-bold text-blue-800 block text-[11px]">Active Medications:</span>
                  <p className="text-slate-700">{selectedPatient.medicalId?.medications || "No active prescriptions."}</p>
                </div>
              </div>

              {/* Dependents */}
              {selectedPatient.dependents?.length > 0 && (
                <div className="text-xs space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">Registered Dependents</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.dependents.map((dep, idx) => (
                      <span key={idx} className="px-3 py-1 bg-slate-100 rounded-xl text-slate-700 font-medium text-xs">
                        {dep.name} ({dep.relation})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
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
