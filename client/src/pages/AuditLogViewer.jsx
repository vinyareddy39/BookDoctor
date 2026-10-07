import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLogs = async (targetPage = page) => {
    try {
      setLoading(true);
      const params = {
        page: targetPage,
        limit: 25,
      };
      if (roleFilter) params.role = roleFilter;
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await API.get("/audit-logs", { params });
      const payload = res.data?.data;
      setLogs(payload?.logs || []);
      setTotalPages(payload?.pagination?.pages || 1);
      setTotalRecords(payload?.pagination?.total || 0);
      setPage(payload?.pagination?.page || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [roleFilter, actionFilter, resourceFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleResetFilters = () => {
    setRoleFilter("");
    setActionFilter("");
    setResourceFilter("");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await API.get("/audit-logs/export-csv", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medassist-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Audit log CSV exported successfully!");
    } catch (err) {
      toast.error("Failed to export audit log CSV.");
    } finally {
      setExporting(false);
    }
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case "CREATE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "UPDATE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "DELETE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "LOGIN":
      case "LOGOUT":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "VIEW_PATIENT_RECORD":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Link to="/admin" className="hover:text-primary-600 transition">
                Admin Control
              </Link>
              <span>/</span>
              <span>Security & Compliance</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>🛡️</span> Immutable Audit Log Viewer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Full tamper-proof activity trail with automated mutation tracking, patient read logs, and diff captures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={exporting || totalRecords === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <span>{exporting ? "⏳" : "📥"}</span>
              <span>{exporting ? "Exporting CSV..." : "Export Filtered CSV"}</span>
            </button>
            <Link
              to="/admin"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Filters Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Search Details / User</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="User name, details, ID..."
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Roles</option>
                <option value="clinic_admin">Clinic Admin</option>
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
                <option value="lab_technician">Lab Technician</option>
                <option value="patient">Patient</option>
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="READ">READ</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="VIEW_PATIENT_RECORD">VIEW RECORD</option>
                <option value="REVOKE_SESSION">REVOKE SESSION</option>
                <option value="EXPORT_AUDIT">EXPORT CSV</option>
              </select>
            </div>

            {/* Resource Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Resource</label>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Resources</option>
                <option value="Patient">Patient</option>
                <option value="Appointment">Appointment</option>
                <option value="ClinicalNote">Clinical Note</option>
                <option value="Prescription">Prescription</option>
                <option value="LabOrder">Lab Order</option>
                <option value="Invoice">Invoice</option>
                <option value="Session">Session</option>
                <option value="User">User</option>
              </select>
            </div>

            {/* Date Start/End */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </form>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Found <strong className="text-slate-800">{totalRecords}</strong> total compliant log records
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => fetchLogs(1)}
                className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-sm"
              >
                Apply Search
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource & ID</th>
                  <th className="py-3 px-4">IP / Device</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-center">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading verified audit trail...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      No audit log records match the applied criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const hasDiff = log.diff && (log.diff.before || log.diff.after);
                    return (
                      <tr key={log._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {log.userName || "System"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                            {log.role?.replace("_", " ") || "system"}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${getActionBadgeClass(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-700">{log.resource}</span>
                          {log.resourceId && (
                            <span className="block text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                              {log.resourceId}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {log.ip || "unknown"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.details}>
                          {log.details || "-"}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {hasDiff ? (
                            <button
                              onClick={() => setSelectedDiff(log)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-primary-50 hover:text-primary-700 text-slate-700 rounded-lg text-[10px] font-bold transition"
                            >
                              Inspect Diff
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page <strong className="text-slate-800">{page}</strong> of {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchLogs(page - 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchLogs(page + 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diff Inspection Modal */}
      {selectedDiff && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Audit State Difference Inspection</h3>
                <p className="text-xs text-slate-500">
                  {selectedDiff.action} on {selectedDiff.resource} &bull; ID: {selectedDiff.resourceId || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setSelectedDiff(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Before Mutation</h4>
                <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap">
                  {selectedDiff.diff?.before
                    ? JSON.stringify(selectedDiff.diff.before, null, 2)
                    : "No previous state recorded (New record)"}
                </pre>
              </div>

              <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">After Mutation</h4>
                <pre className="text-[11px] font-mono text-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {selectedDiff.diff?.after
                    ? JSON.stringify(selectedDiff.diff.after, null, 2)
                    : "Record deleted or no diff payload"}
                </pre>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedDiff(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
