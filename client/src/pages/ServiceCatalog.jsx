import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";

export default function ServiceCatalog() {
  const [services, setServices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    departmentId: "",
    price: 500,
    durationMinutes: 15,
    category: "consultation",
    description: "",
    isActive: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (deptFilter) params.departmentId = deptFilter;

      const [resSrv, resDept] = await Promise.all([
        API.get("/services", { params }),
        API.get("/departments?isActive=true"),
      ]);
      setServices(resSrv.data?.data?.services || []);
      setDepartments(resDept.data?.data?.departments || []);
    } catch (err) {
      toast.error("Failed to load clinical services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, deptFilter]);

  const handleOpenAdd = () => {
    setEditingService(null);
    setForm({
      name: "",
      code: "",
      departmentId: departments[0]?._id || "",
      price: 500,
      durationMinutes: 15,
      category: "consultation",
      description: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (srv) => {
    setEditingService(srv);
    setForm({
      name: srv.name,
      code: srv.code,
      departmentId: srv.departmentId?._id || srv.departmentId || "",
      price: srv.price,
      durationMinutes: srv.durationMinutes || 15,
      category: srv.category || "consultation",
      description: srv.description || "",
      isActive: srv.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingService) {
        await API.put(`/services/${editingService._id}`, form);
        toast.success("Service updated!");
      } else {
        await API.post("/services", form);
        toast.success("Service created!");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete clinical service '${name}'?`)) return;
    try {
      await API.delete(`/services/${id}`);
      toast.success("Service deleted.");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete service.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Link to="/admin" className="hover:text-primary-600 transition">
                Admin Control
              </Link>
              <span>/</span>
              <span>Billing & Services</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>🩺</span> Clinical & Diagnostic Service Catalog
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage clinical consultation rates, diagnostic laboratory procedures, and standard durations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Service</span>
            </button>
            <Link
              to="/admin"
              className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
            >
              ← Admin
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            type="text"
            placeholder="Search service name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              Services: <strong className="text-slate-800">{services.length}</strong>
            </span>
          </div>
        </div>

        {/* Service Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Service & Code</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading clinical services...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No clinical services found matching current criteria.
                  </td>
                </tr>
              ) : (
                services.map((srv) => (
                  <tr key={srv._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{srv.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{srv.code}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {srv.departmentId?.name || "General"}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {srv.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{srv.durationMinutes || 15} mins</td>
                    <td className="py-3 px-4 font-black text-emerald-700">₹{srv.price}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          srv.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {srv.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(srv)}
                        className="text-primary-600 hover:text-primary-800 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(srv._id, srv.name)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">
                  {editingService ? "Edit Service" : "Add Clinical Service"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Complete Blood Count (CBC)"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Service Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. LAB-CBC"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      <option value="consultation">Consultation</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="laboratory">Laboratory</option>
                      <option value="procedure">Procedure</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Mins)</label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={form.durationMinutes}
                      onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows="2"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Preparation instructions, sample requirements..."
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActiveSrv"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="isActiveSrv" className="text-xs font-bold text-slate-700">
                    Service Active for Booking & Invoicing
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    {saving ? "Saving..." : editingService ? "Update Service" : "Save Service"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
