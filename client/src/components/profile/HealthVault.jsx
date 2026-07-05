import { useState, useEffect } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function HealthVault({ profile }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dependentId, setDependentId] = useState("");

  const dependents = profile?.dependents || [];

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await API.get("/users/health-records");
      setRecords(res.data.data);
    } catch (err) {
      toast.error("Failed to load health records.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a file to upload.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("notes", notes);
    if (dependentId) formData.append("dependentId", dependentId);

    setUploading(true);
    try {
      const res = await API.post("/users/health-records", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setRecords([res.data.data, ...records]);
      toast.success("Health record uploaded successfully!");
      
      // Reset form
      setFile(null);
      setTitle("");
      setNotes("");
      setDependentId("");
      e.target.reset();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload record.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await API.delete(`/users/health-records/${id}`);
      setRecords(records.filter(r => r._id !== id));
      toast.success("Record deleted.");
    } catch (err) {
      toast.error("Failed to delete record.");
    }
  };

  const getOwnerName = (depId) => {
    if (!depId) return "Self";
    const dep = dependents.find(d => d._id === depId);
    return dep ? dep.name : "Unknown";
  };

  const getFileIcon = (type) => {
    if (type === "pdf") return "📄";
    if (type === "image") return "🖼️";
    return "📁";
  };

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="card p-6 bg-white border border-slate-200">
        <h3 className="text-base font-black text-slate-800 tracking-tight mb-4">Upload New Record</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Document Title</label>
              <input required type="text" className="input py-2 text-sm" value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g. Blood Test Report" />
            </div>
            <div>
              <label className="input-label">Belongs To</label>
              <select className="input py-2 text-sm" value={dependentId} onChange={e => setDependentId(e.target.value)}>
                <option value="">Self (Patient)</option>
                {dependents.map(dep => (
                  <option key={dep._id} value={dep._id}>{dep.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="input-label">Notes (Optional)</label>
              <input type="text" className="input py-2 text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional information..." />
            </div>
            <div className="md:col-span-2">
              <label className="input-label">Select File</label>
              <input required type="file" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={uploading} className="btn-primary py-2 px-6 text-sm">
              {uploading ? "Uploading..." : "Upload Record"}
            </button>
          </div>
        </form>
      </div>

      {/* Records List */}
      <div>
        <h3 className="text-base font-black text-slate-800 tracking-tight mb-4">Your Health Vault</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading records...</p>
        ) : records.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-sm font-medium text-slate-500">No health records uploaded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map(record => (
              <div key={record._id} className="card p-4 border border-slate-200 hover:border-primary-300 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div className="text-3xl">{getFileIcon(record.fileType)}</div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                    {getOwnerName(record.dependentId)}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 truncate" title={record.title}>{record.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{new Date(record.date).toLocaleDateString()}</p>
                {record.notes && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{record.notes}</p>}
                
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                  <a href={`http://localhost:5000${record.fileUrl}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold rounded-lg transition-colors">
                    View
                  </a>
                  <button onClick={() => handleDelete(record._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
