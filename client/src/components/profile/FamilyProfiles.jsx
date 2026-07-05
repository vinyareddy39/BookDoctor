import { useState, useEffect } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function FamilyProfiles({ profile, setProfile }) {
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    relation: "",
    dob: "",
    gender: ""
  });

  const dependents = profile?.dependents || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/users/dependents", form);
      setProfile({ ...profile, dependents: res.data.data });
      toast.success("Family member added successfully!");
      setAdding(false);
      setForm({ name: "", relation: "", dob: "", gender: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add family member.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Are you sure you want to remove this family member?")) return;
    try {
      const res = await API.delete(`/users/dependents/${id}`);
      setProfile({ ...profile, dependents: res.data.data });
      toast.success("Family member removed.");
    } catch (err) {
      toast.error("Failed to remove family member.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-black text-slate-800 tracking-tight">Family Members</h3>
          <p className="text-xs text-slate-400 mt-0.5">Manage profiles for your dependents to book appointments on their behalf.</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary py-2 px-4 text-xs">
            + Add Member
          </button>
        )}
      </div>

      {adding && (
        <div className="card p-5 bg-slate-50 border border-slate-200">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Full Name</label>
                <input required type="text" className="input text-sm py-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="E.g. Jane Doe" />
              </div>
              <div>
                <label className="input-label">Relation</label>
                <select required className="input text-sm py-2" value={form.relation} onChange={e => setForm({...form, relation: e.target.value})}>
                  <option value="">Select Relation</option>
                  <option value="Parent">Parent</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="input-label">Date of Birth</label>
                <input type="date" className="input text-sm py-2" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Gender</label>
                <select className="input text-sm py-2" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary py-2 px-4 text-xs">
                {loading ? "Adding..." : "Save Member"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dependents.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-sm font-medium text-slate-500">No family members added yet.</p>
          </div>
        ) : (
          dependents.map(dep => (
            <div key={dep._id} className="card p-4 flex items-center justify-between border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  {dep.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{dep.name}</h4>
                  <p className="text-xs text-slate-500 font-medium">{dep.relation} {dep.dob && `· ${new Date(dep.dob).toLocaleDateString()}`}</p>
                </div>
              </div>
              <button onClick={() => handleRemove(dep._id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
