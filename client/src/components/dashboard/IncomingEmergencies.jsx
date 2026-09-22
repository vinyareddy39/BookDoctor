import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";

export default function IncomingEmergencies({ doctorProfile, setDoctorProfile }) {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchEmergencies = async () => {
    try {
      const res = await API.get("/emergency/doctor/incoming");
      setEmergencies(res.data?.data || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencies();
    const interval = setInterval(fetchEmergencies, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleToggleEmergency = async () => {
    try {
      setUpdating(true);
      const newStatus = !doctorProfile?.acceptingEmergencies;
      await API.patch("/emergency/doctor/capacity", { acceptingEmergencies: newStatus });
      setDoctorProfile(prev => ({ ...prev, acceptingEmergencies: newStatus }));
      toast.success(newStatus ? "You are now accepting SOS emergencies!" : "SOS Emergencies paused.");
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCapacity = async (newCap) => {
    if (newCap < 0) return;
    try {
      setUpdating(true);
      await API.patch("/emergency/doctor/capacity", { erCapacity: newCap });
      setDoctorProfile(prev => ({ ...prev, erCapacity: newCap }));
      toast.success(`ER Capacity updated to ${newCap}`);
    } catch (err) {
      toast.error("Failed to update capacity");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Settings / Toggle Header */}
      <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-red-700">SOS Emergency Response</h2>
          <p className="text-sm text-red-600/80 mt-1 font-medium">Toggle availability and manage your live incoming emergency feed.</p>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Capacity Input */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-red-700 uppercase mb-1">Available Beds</span>
            <div className="flex items-center bg-white rounded-lg border border-red-200 overflow-hidden shadow-sm">
              <button 
                disabled={updating}
                onClick={() => handleUpdateCapacity((doctorProfile?.erCapacity || 0) - 1)}
                className="px-3 py-1 bg-slate-50 hover:bg-red-100 font-bold text-slate-700 transition-colors"
              >-</button>
              <span className="px-4 py-1 font-black text-slate-900 border-x border-red-100">{doctorProfile?.erCapacity || 0}</span>
              <button 
                disabled={updating}
                onClick={() => handleUpdateCapacity((doctorProfile?.erCapacity || 0) + 1)}
                className="px-3 py-1 bg-slate-50 hover:bg-red-100 font-bold text-slate-700 transition-colors"
              >+</button>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-red-700 uppercase mb-1">Status</span>
            <button
              disabled={updating}
              onClick={handleToggleEmergency}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                doctorProfile?.acceptingEmergencies ? "bg-red-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  doctorProfile?.acceptingEmergencies ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Feed */}
      <h3 className="font-black text-slate-800 text-lg">Active Incoming Emergencies ({emergencies.length})</h3>
      
      {loading ? (
        <div className="p-8 text-center text-slate-500 font-bold">Loading emergencies...</div>
      ) : emergencies.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-4xl block mb-2">??</span>
          <p className="text-slate-500 font-bold">No active emergencies assigned to you.</p>
          {!doctorProfile?.acceptingEmergencies && (
            <p className="text-sm text-slate-400 mt-2">Turn on "Accepting Emergencies" above to receive alerts.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emergencies.map(em => {
            const loc = em.locationHistory?.[em.locationHistory.length - 1] || em.location;
            return (
              <div key={em._id} className="card p-5 border-l-4 border-l-red-500 bg-white shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-black text-lg text-slate-900">{em.patientId?.name || "Unknown Patient"}</h4>
                    <p className="text-sm text-red-600 font-bold uppercase tracking-wider">{em.emergencyType} SOS</p>
                  </div>
                  <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-xs animate-pulse">LIVE</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 p-3 rounded-lg mb-4">
                  <div>
                    <span className="block text-slate-400 text-xs font-bold uppercase">Blood Group</span>
                    <span className="font-semibold text-slate-700">{em.patientId?.medicalId?.bloodGroup || "--"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-xs font-bold uppercase">Allergies</span>
                    <span className="font-semibold text-slate-700">{em.patientId?.medicalId?.allergies || "None"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Conditions</span>
                    <span className="font-semibold text-slate-700">{em.patientId?.medicalId?.conditions || "None"}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Contact: <b>{em.patientId?.phone || "N/A"}</b></span>
                  <a 
                    href={`https://maps.google.com/maps?q=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 font-bold hover:underline flex items-center gap-1"
                  >
                    ?? Open GPS Route
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

