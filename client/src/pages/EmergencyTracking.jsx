import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function EmergencyTracking() {
  const { emergencyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch initial emergency status and start polling
  useEffect(() => {
    let statusInterval;
    let locationInterval;

    const fetchStatus = async () => {
      try {
        const res = await API.get(`/emergency/${emergencyId}/status`);
        const data = res.data?.data || res.data;
        setEmergency(data);
        
        // If resolved, stop polling and show alert
        if (data.status === "resolved") {
          toast.success("This emergency has been resolved.");
          clearInterval(statusInterval);
          clearInterval(locationInterval);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load emergency details.");
        clearInterval(statusInterval);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus(); // initial fetch

    // Poll status every 5 seconds
    statusInterval = setInterval(fetchStatus, 5000);

    // Watch patient location and POST updates every 5 seconds (only if active patient)
    if (user?.role === "patient") {
      const updateLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await API.post(`/emergency/${emergencyId}/location`, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              });
            } catch (err) {
              console.error("Failed to update live location", err);
            }
          },
          (err) => console.error(err),
          { enableHighAccuracy: true }
        );
      };

      locationInterval = setInterval(updateLocation, 5000);
    }

    const isAmbulanceMode = emergency.responseMode === "ambulance";
  const ambulance = emergency.assignedAmbulanceId;
  const hospital = emergency.assignedHospitalId;

  const distPatientToHosp = getDistance(latestLoc?.lat, latestLoc?.lng, hospital?.lat, hospital?.lng);
  const etaPatientToHosp = Math.round((distPatientToHosp / 40) * 60);

  const distAmbToPatient = getDistance(ambulance?.lat, ambulance?.lng, latestLoc?.lat, latestLoc?.lng);
  const etaAmbToPatient = Math.round((distAmbToPatient / 40) * 60);

  const doctorLocationUrl = `https://maps.google.com/maps?q=${doctor?.lat || 0},${doctor?.lng || 0}&output=embed`;
  const dirUrl = `https://www.google.com/maps/embed/v1/directions?key=YOUR_API_KEY&origin=${ambulance?.lat},${ambulance?.lng}&waypoints=${latestLoc?.lat},${latestLoc?.lng}&destination=${hospital?.lat},${hospital?.lng}`;
  const fallbackAmbulanceUrl = `https://maps.google.com/maps?q=${latestLoc?.lat || 0},${latestLoc?.lng || 0}&output=embed`;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in">
      
      <div className={`p-6 rounded-2xl shadow-sm text-white ${isResolved ? "bg-green-600" : isAmbulanceMode ? "bg-amber-500 animate-pulse-slow" : "bg-red-600 animate-pulse-slow"}`}>
        <h1 className="text-2xl md:text-3xl font-black mb-2">
          {isResolved ? "✅ Emergency Resolved" : isAmbulanceMode ? "🚨 AMBULANCE DISPATCHED" : "🚨 ACTIVE SOS EMERGENCY"}
        </h1>
        <p className="opacity-90 font-medium">
          {isResolved 
            ? "This emergency has been safely resolved and logged."
            : isAmbulanceMode 
              ? "No doctor available nearby. Ambulance routed to your location."
              : "Live tracking active. Doctor is preparing for your arrival."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {isAmbulanceMode ? (
          <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-amber-700 uppercase tracking-wider">Dispatched Ambulance</h2>
            <div>
              <p className="text-2xl font-bold text-slate-900">{ambulance?.driverName || "Ambulance Driver"}</p>
              <p className="text-slate-500">Vehicle: {ambulance?.vehicleNumber}</p>
              {ambulance?.phone && <p className="text-slate-500 font-medium mt-1">📞 {ambulance.phone}</p>}
            </div>

            {!isResolved && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-amber-600 uppercase">Distance</p>
                    <p className="text-xl font-black text-slate-800">{distAmbToPatient > 0 ? `${distAmbToPatient.toFixed(1)} km` : "Tracking..."}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600 uppercase">Ambulance ETA</p>
                    <p className="text-xl font-black text-slate-800">{etaAmbToPatient > 0 ? `${etaAmbToPatient} mins` : "--"}</p>
                  </div>
                </div>
              </div>
            )}
            
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mt-4">Destination Hospital</h2>
            <div>
              <p className="text-lg font-bold text-slate-900">{hospital?.name}</p>
              <p className="text-sm text-slate-500">{hospital?.address}</p>
              <p className="text-xs text-slate-500 mt-1">ER Beds Available: <span className="font-bold text-red-500">{hospital?.erBedsAvailable}</span></p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Responder Details</h2>
            <div>
              <p className="text-2xl font-bold text-slate-900">{doctor?.userId?.name || doctor?.clinicName || "Assigned Doctor"}</p>
              <p className="text-slate-500">{doctor?.specialization} Specialist</p>
              {doctor?.userId?.phone && <p className="text-slate-500 font-medium mt-1">📞 {doctor.userId?.phone}</p>}
            </div>

            {!isResolved && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-red-500 uppercase">Distance</p>
                    <p className="text-xl font-black text-slate-800">{distKm > 0 ? `${distKm.toFixed(1)} km` : "Tracking..."}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-red-500 uppercase">Estimated ETA</p>
                    <p className="text-xl font-black text-slate-800">{etaMins > 0 ? `${etaMins} mins` : "--"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">Tracking Data</h2>
            
            <div className="space-y-3 mb-6">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase block">Your Current Location</span>
                <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                  {latestLoc?.lat?.toFixed(5)}, {latestLoc?.lng?.toFixed(5)}
                </span>
              </div>
              {isAmbulanceMode ? (
                <>
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase block">Ambulance Location</span>
                    <span className="text-sm font-mono bg-amber-50 px-2 py-1 rounded text-amber-700">
                      {ambulance?.lat?.toFixed(5) || "--"}, {ambulance?.lng?.toFixed(5) || "--"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase block">Hospital Location</span>
                    <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                      {hospital?.lat?.toFixed(5) || "--"}, {hospital?.lng?.toFixed(5) || "--"}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block">Hospital Location</span>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                    {doctor?.lat?.toFixed(5) || "--"}, {doctor?.lng?.toFixed(5) || "--"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!isResolved && (
            <button 
              onClick={handleResolve}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all"
            >
              Mark as Resolved
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        {isAmbulanceMode ? (
          <iframe
            title="Tracking Map"
            className="w-full h-80 rounded-xl"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
            src={fallbackAmbulanceUrl}
          ></iframe>
        ) : doctor?.lat ? (
          <iframe
            title="Hospital Location"
            className="w-full h-80 rounded-xl"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
            src={doctorLocationUrl}
          ></iframe>
        ) : (
          <div className="w-full h-80 flex items-center justify-center bg-slate-100 rounded-xl">
            <p className="text-slate-500 font-medium">Map unavailable</p>
          </div>
        )}
      </div>

    </div>
  );
}
