
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function EmergencyTracking() {
  const { emergencyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let statusInterval;
    let locationInterval;

    const fetchStatus = async () => {
      try {
        const res = await API.get(`/emergency/${emergencyId}/status`);
        const data = res.data?.data || res.data;
        setEmergency(data);
        
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

    fetchStatus();

    statusInterval = setInterval(fetchStatus, 5000);

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

    return () => {
      clearInterval(statusInterval);
      clearInterval(locationInterval);
    };
  }, [emergencyId, user]);

  const handleResolve = async () => {
    try {
      await API.patch(`/emergency/${emergencyId}/resolve`);
      toast.success("Emergency marked as resolved.");
      navigate("/");
    } catch (err) {
      toast.error("Failed to resolve emergency.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Loading Live Tracking...</div>;
  }

  if (error || !emergency) {
    return <div className="p-8 text-center text-red-500 font-bold">{error || "Emergency not found."}</div>;
  }

  const doctor = emergency.assignedDoctorId;
  const isResolved = emergency.status === "resolved";
  const isAmbulanceMode = emergency.responseMode === "ambulance";
  const ambulance = emergency.assignedAmbulanceId;
  const hospital = emergency.assignedHospitalId;

  const latestLoc = emergency.locationHistory?.[emergency.locationHistory.length - 1] || emergency.location;

  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const p = 0.017453292519943295;    
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  const distKm = getDistance(latestLoc?.lat, latestLoc?.lng, doctor?.lat, doctor?.lng);
  const etaMins = Math.round((distKm / 40) * 60);

  const etaPatientToHosp = emergency.hospitalEtaMinutes || "--";
  const etaAmbToPatient = emergency.ambulanceEtaMinutes || "--";

  const getFlippedCoords = (geoJSON) => {
    if (!geoJSON || !geoJSON.coordinates) return [];
    return geoJSON.coordinates.map(c => [c[1], c[0]]);
  };

  const ambRouteCoords = getFlippedCoords(emergency.ambulanceRouteGeoJSON);
  const hospRouteCoords = getFlippedCoords(emergency.hospitalRouteGeoJSON);

  const doctorLocationUrl = `https://maps.google.com/maps?q=${doctor?.lat || 0},${doctor?.lng || 0}&output=embed`;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in">
      
      <div className={`p-6 rounded-2xl shadow-sm text-white ${isResolved ? "bg-green-600" : isAmbulanceMode ? "bg-amber-500 animate-pulse-slow" : "bg-red-600 animate-pulse-slow"}`}>
        <h1 className="text-2xl md:text-3xl font-black mb-2">
          {isResolved ? "? Emergency Resolved" : isAmbulanceMode ? "?? AMBULANCE DISPATCHED" : "?? ACTIVE SOS EMERGENCY"}
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
              {ambulance?.phone && <p className="text-slate-500 font-medium mt-1">?? {ambulance.phone}</p>}
            </div>

            {!isResolved && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div className="flex justify-between items-center">
                  <div className="text-right w-full">
                    <p className="text-xs font-bold text-amber-600 uppercase">Ambulance ETA</p>
                    <p className="text-xl font-black text-slate-800">{etaAmbToPatient !== "--" ? `${etaAmbToPatient} mins` : "--"}</p>
                    <p className="text-[10px] text-amber-600 font-medium uppercase mt-1">(Traffic-Aware Routing)</p>
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
              {doctor?.userId?.phone && <p className="text-slate-500 font-medium mt-1">?? {doctor.userId?.phone}</p>}
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

      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-0">
        {isAmbulanceMode ? (
          <div className="w-full h-80 rounded-xl overflow-hidden">
            {latestLoc?.lat && (
              <MapContainer 
                center={[latestLoc.lat, latestLoc.lng]} 
                zoom={13} 
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* Markers */}
                {latestLoc && <Marker position={[latestLoc.lat, latestLoc.lng]}><Popup>You are here</Popup></Marker>}
                {ambulance?.lat && <Marker position={[ambulance.lat, ambulance.lng]}><Popup>Ambulance</Popup></Marker>}
                {hospital?.lat && <Marker position={[hospital.lat, hospital.lng]}><Popup>Destination Hospital</Popup></Marker>}
                
                {/* OSRM Routes */}
                {ambRouteCoords.length > 0 && <Polyline positions={ambRouteCoords} color="#f59e0b" weight={5} opacity={0.8} />}
                {hospRouteCoords.length > 0 && <Polyline positions={hospRouteCoords} color="#ef4444" weight={5} opacity={0.8} dashArray="10, 10" />}
              </MapContainer>
            )}
          </div>
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

