import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";

export default function WalkInRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "male",
    bloodGroup: "O+",
    address: "",
    emergencyContact: "",
    allergies: "",
    conditions: "",
    medications: "",
  });

  const [dependents, setDependents] = useState([]);
  const [newDep, setNewDep] = useState({ name: "", relation: "Child", gender: "male" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddDependent = () => {
    if (!newDep.name.trim()) return toast.error("Dependent name required");
    setDependents([...dependents, { ...newDep }]);
    setNewDep({ name: "", relation: "Child", gender: "male" });
  };

  const handleRemoveDependent = (idx) => {
    setDependents(dependents.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      return toast.error("Name and contact phone are required.");
    }

    try {
      setLoading(true);
      const res = await API.post("/patients/walk-in", {
        ...formData,
        dependents,
      });

      const patient = res.data?.data?.patient;
      setRegisteredPatient(patient);
      toast.success(`Patient registered! MRN: ${patient.mrn}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register patient.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Front Desk Operations</span>
              <span>/</span>
              <span className="text-primary-600">Walk-In Patient Intake</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>📝</span> Walk-In Patient Registration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Immediate front desk patient admission with automated Medical Record Number (MRN) assignment.
            </p>
          </div>
          <Link
            to="/patients"
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
          >
            📋 Patient Directory
          </Link>
        </div>

        {registeredPatient ? (
          /* Success Receipt Card */
          <div className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-lg space-y-6 animate-fade-in text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 text-3xl flex items-center justify-center mx-auto">
              ✓
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                Registration Verified
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">{registeredPatient.name}</h2>
              <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block font-mono">
                <span className="text-xs text-slate-500 uppercase block font-sans">Official Medical Record Number</span>
                <span className="text-xl font-black text-primary-700 tracking-wider">{registeredPatient.mrn}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-bold block">Phone</span>
                <span className="font-semibold text-slate-800">{registeredPatient.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Gender / Blood</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {registeredPatient.gender} &bull; {registeredPatient.bloodGroup || "N/A"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-bold block">Clinical Portal Email</span>
                <span className="font-mono text-slate-700">{registeredPatient.email}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setRegisteredPatient(null);
                  setFormData({
                    name: "",
                    phone: "",
                    email: "",
                    dob: "",
                    gender: "male",
                    bloodGroup: "O+",
                    address: "",
                    emergencyContact: "",
                    allergies: "",
                    conditions: "",
                    medications: "",
                  });
                  setDependents([]);
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                + Register Another Walk-In
              </button>
              <Link
                to={`/book-appointment/${registeredPatient._id}`}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition text-center shadow-md"
              >
                Schedule Appointment ➔
              </Link>
            </div>
          </div>
        ) : (
          /* Intake Form */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>👤</span> Personal & Demographic Details
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Primary patient identity credentials</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9849512453"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Leave empty to auto-generate"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Medical History */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>🩺</span> Clinical Baseline & Allergies
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Critical background for attending physicians</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Known Drug Allergies</label>
                  <input
                    type="text"
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleChange}
                    placeholder="e.g. Penicillin, Sulfa"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chronic Conditions</label>
                  <input
                    type="text"
                    name="conditions"
                    value={formData.conditions}
                    onChange={handleChange}
                    placeholder="e.g. Type 2 Diabetes, Hypertension"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Medications</label>
                  <input
                    type="text"
                    name="medications"
                    value={formData.medications}
                    onChange={handleChange}
                    placeholder="e.g. Metformin 500mg"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Family Dependents */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>👨‍👩‍👧</span> Family Dependents
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Add children or elderly parents linked to this account</p>

              <div className="flex flex-wrap gap-2 items-center mt-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Dependent Name"
                  value={newDep.name}
                  onChange={(e) => setNewDep({ ...newDep, name: e.target.value })}
                  className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
                <select
                  value={newDep.relation}
                  onChange={(e) => setNewDep({ ...newDep, relation: e.target.value })}
                  className="text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="Child">Child</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Other">Other</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddDependent}
                  className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition"
                >
                  + Add
                </button>
              </div>

              {dependents.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {dependents.map((dep, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2"
                    >
                      <span>
                        {dep.name} ({dep.relation})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDependent(idx)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate("/patients")}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                <span>{loading ? "⏳" : "✓"}</span>
                <span>{loading ? "Registering Patient..." : "Complete Walk-In Admission"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
