
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../services/api";

export default function AmbulanceDashboard() {
  const [ambulanceId, setAmbulanceId] = useState("");
  const [ambulance, setAmbulance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emergency, setEmergency] = useState(null);

  // Mock login for demo purposes
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!ambulanceId) return;
    setLoading(true);
    try {
      const res = await API.get(`/ambulance/${ambulanceId}`);
      setAmbulance(res.data.data || res.data);
      if (res.data.data?.currentEmergencyId || res.data?.currentEmergencyId) {
        // Fetch emergency details
        const emRes = await API.get(`/emergency/${res.data.data?.currentEmergencyId || res.data?.currentEmergencyId}/status`);
        setEmergency(emRes.data.data || emRes.data);
      }
      toast.success("Ambulance driver logged in.");
    } catch (err) {
      toast.error("Ambulance not found or invalid ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPickedUp = () => {
    // In a real app this would call an API to update emergency status to "picked_up"
    // For demo, we will just show a toast
    toast.success("Patient marked as picked up! Rerouting to hospital.");
  };

  const handleCompleteTrip = async () => {
    try {
      await API.post(`/ambulance/${ambulance._id}/complete`);
      toast.success("Trip completed! Ambulance is available again.");
      setAmbulance(prev => ({ ...prev, currentEmergencyId: null, isAvailable: true }));
      setEmergency(null);
    } catch (err) {
      toast.error("Failed to complete trip.");
    }
  };

  if (!ambulance) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-700">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">
            ??
          </div>
          <h1 className="text-2xl font-black text-white text-center mb-2">Driver Portal</h1>
          <p className="text-slate-400 text-center mb-8">Enter your Vehicle/Ambulance ID to start shift.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="e.g. 64f1b2c..." 
              value={ambulanceId}
              onChange={(e) => setAmbulanceId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none"
            />
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-black py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Start Shift"}
            </button>
          </form>
          <p className="text-xs text-slate-500 text-center mt-6">
            Hackathon Demo: Copy an Ambulance Object ID from your database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div>
            <h1 className="text-2xl font-black text-white">{ambulance.driverName}</h1>
            <p className="text-amber-500 font-bold">{ambulance.vehicleNumber}</p>
          </div>
          <div className={`px-4 py-1.5 rounded-full font-bold text-sm border ${!ambulance.currentEmergencyId ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"}`}>
            {!ambulance.currentEmergencyId ? "?? Available for Dispatch" : "?? ACTIVE DISPATCH"}
          </div>
        </div>

        {/* Active Emergency Card */}
        {emergency ? (
          <div className="bg-slate-800 rounded-2xl border border-red-500/30 overflow-hidden shadow-2xl">
            <div className="bg-red-500/10 p-6 border-b border-red-500/20">
              <h2 className="text-xl font-black text-red-400 mb-1">Incoming SOS Request!</h2>
              <p className="text-slate-400 text-sm">Proceed to patient location immediately.</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Patient Name</p>
                  <p className="text-lg font-bold text-white">{emergency.patientId?.name || "Unknown"}</p>
                  <p className="text-slate-400">?? {emergency.patientId?.phone || "No phone"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Medical ID</p>
                  <div className="bg-slate-900 p-3 rounded-lg mt-1 border border-slate-700">
                    <p className="text-sm"><span className="text-slate-500">Blood:</span> <span className="text-red-400 font-bold">{emergency.patientId?.medicalId?.bloodGroup || "Unknown"}</span></p>
                    <p className="text-sm"><span className="text-slate-500">Allergies:</span> {emergency.patientId?.medicalId?.allergies || "None"}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Destination Hospital</p>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <p className="text-lg font-bold text-white">{emergency.assignedHospitalId?.name}</p>
                  <p className="text-slate-400">{emergency.assignedHospitalId?.address}</p>
                  <p className="text-amber-500 font-bold text-sm mt-2">Call Ahead: {emergency.assignedHospitalId?.phone}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-700">
                <button 
                  onClick={handleMarkPickedUp}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl transition-colors"
                >
                  Mark Patient Picked Up
                </button>
                <button 
                  onClick={handleCompleteTrip}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black py-4 rounded-xl transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  Complete Trip (At Hospital)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 p-12 rounded-2xl border border-slate-700 text-center">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <span className="text-4xl opacity-50">?</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Waiting for Dispatch</h3>
            <p className="text-slate-400">Your vehicle is marked as available. Sit tight.</p>
          </div>
        )}

      </div>
    </div>
  );
}

