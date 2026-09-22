
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
  const [uberVehicles, setUberVehicles] = useState([]);
  const [loadingUber, setLoadingUber] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopyAddress = (customText) => {
    const target = customText || (emergency?.assignedHospitalId?.address 
      ? `${emergency.assignedHospitalId.name}, ${emergency.assignedHospitalId.address}` 
      : (emergency?.assignedHospitalId?.name || "Emergency Hospital"));
      
    let successful = false;
    try {
      const textArea = document.createElement("textarea");
      textArea.value = target;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      successful = document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch (err) {
      console.warn("Fallback execCommand copy error:", err);
    }

    if (!successful && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(target).catch(() => {});
    }

    setCopied(true);
    toast.success(`Copied: ${emergency?.assignedHospitalId?.name || "Hospital"}`);
    setTimeout(() => setCopied(false), 3000);
  };

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



  // Reverse geocode live GPS to human-readable area name (e.g. Kothapet, Ghatkesar)
  useEffect(() => {
    const curLoc = emergency?.locationHistory?.[emergency.locationHistory.length - 1] || emergency?.location;
    if (curLoc?.lat && curLoc?.lng && !userAddress) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${curLoc.lat}&lon=${curLoc.lng}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.address) {
            const sub = data.address.suburb || data.address.neighbourhood || data.address.residential || data.address.road || "";
            const city = data.address.city || data.address.town || data.address.state_district || "Hyderabad";
            let formatted = "Live GPS Location";
            if (sub) {
              formatted = `${sub}, ${city}`;
            } else if (data.display_name && typeof data.display_name === "string") {
              formatted = data.display_name.split(",").slice(0, 2).join(",");
            }
            setUserAddress(formatted);
          }
        })
        .catch(() => setUserAddress("Live GPS Location"));
    }
  }, [emergency?.locationHistory, emergency?.location, userAddress]);

  // Fetch live Uber vehicle estimates when in Uber mode
  useEffect(() => {
    if (emergency?.responseMode === "uber" && emergency?.assignedHospitalId?.lat) {
      const hosp = emergency.assignedHospitalId;
      const curLoc = emergency.locationHistory?.[emergency.locationHistory.length - 1] || emergency.location;
      if (!curLoc?.lat) return;

      setLoadingUber(true);
      API.get("/emergency/uber/estimates", {
        params: {
          startLat: curLoc.lat,
          startLng: curLoc.lng,
          endLat: hosp.lat,
          endLng: hosp.lng
        }
      })
        .then((res) => {
          if (res.data?.data && Array.isArray(res.data.data)) {
            setUberVehicles(res.data.data);
          }
        })
        .catch((err) => console.error("Uber estimates load error:", err))
        .finally(() => setLoadingUber(false));
    }
  }, [emergency?.responseMode, emergency?.assignedHospitalId, emergency?.location]);

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
  const isUberMode = emergency.responseMode === "uber";
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
      
      <div className={`p-6 rounded-2xl shadow-sm text-white ${isResolved ? "bg-green-600" : isUberMode ? "bg-blue-600 animate-pulse-slow" : isAmbulanceMode ? "bg-amber-500 animate-pulse-slow" : "bg-red-600 animate-pulse-slow"}`}>
        <h1 className="text-2xl md:text-3xl font-black mb-2">
          {isResolved ? "? Emergency Resolved" : isUberMode ? "?? UBER FALLBACK TRIGGERED" : isAmbulanceMode ? "?? AMBULANCE DISPATCHED" : "?? ACTIVE SOS EMERGENCY"}
        </h1>
        <p className="opacity-90 font-medium">
          {isResolved 
            ? "This emergency has been safely resolved and logged."
            : isAmbulanceMode 
              ? "No doctor available nearby. Ambulance routed to your location."
              : isUberMode
                ? "Ambulance wait time is too long. Please request an Uber immediately."
              : "Live tracking active. Doctor is preparing for your arrival."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {isUberMode ? (
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-blue-700 uppercase tracking-wider">Uber Emergency Ride Options</h2>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">Live API</span>
            </div>
            
            <p className="text-slate-600 text-sm">
              Ambulances are currently unavailable. Choose an Uber below to dispatch directly to the nearest available hospital.
            </p>

            {/* Transit Route Details: Pickup & Dropoff */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 shadow-inner">
              {/* Pickup / Live Location */}
              <div className="flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 relative" />
                  <div className="w-0.5 h-6 bg-slate-300 my-1" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Pickup (Your Live GPS Location)</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                      Live GPS 🟢
                    </span>
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {userAddress ? userAddress : (latestLoc?.lat ? `${latestLoc.lat.toFixed(5)}, ${latestLoc.lng.toFixed(5)}` : "Acquiring GPS coordinates...")}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Live GPS: {latestLoc?.lat ? `${latestLoc.lat.toFixed(4)}, ${latestLoc.lng.toFixed(4)}` : "Locating..."} • Auto-detected (No typing)
                  </p>
                </div>
              </div>

              {/* Destination ER */}
              <div className="flex items-start gap-3 pt-2.5 border-t border-slate-200/80">
                <div className="mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 block" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-red-600 uppercase tracking-wider">Destination ER (Nearest Hospital)</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-100 text-green-700 whitespace-nowrap">
                      {hospital?.erBedsAvailable || 1} ER Beds Open
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{hospital?.name || "Nearest Hospital ER"}</p>
                      <p className="text-xs text-slate-500">{hospital?.address || "Emergency Ward"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAddress()}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all shrink-0 ml-2 ${
                        copied
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                      title="Copy exact ER address to clipboard"
                    >
                      {copied ? "✓ Copied" : "📋 Copy Address"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Uber Vehicle Selection List */}
            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Vehicles Near You</p>
              
              {loadingUber ? (
                <div className="py-6 text-center text-slate-400 text-sm">
                  <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></span>
                  Contacting Uber API for live vehicle rates...
                </div>
              ) : uberVehicles.length > 0 ? (
                uberVehicles.map((v) => {
                  const deepLink = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${latestLoc?.lat || 17.4485}&pickup[longitude]=${latestLoc?.lng || 78.6841}&pickup[nickname]=My%20Location&dropoff[latitude]=${hospital?.lat || 17.4721}&dropoff[longitude]=${hospital?.lng || 78.7993}&dropoff[nickname]=${encodeURIComponent(hospital?.name || "Hospital ER")}&dropoff[formatted_address]=${encodeURIComponent(hospital?.address || hospital?.name || "Nearest Hospital ER")}`;
                  
                  return (
                    <a
                      key={v.product_id}
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleCopyAddress()}
                      className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 bg-white rounded-lg shadow-sm">{v.icon || "🚗"}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{v.display_name}</span>
                            {v.tag && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                {v.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {v.duration_mins} mins away • {v.distance_km} km
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">{v.estimate}</p>
                        <span className="text-xs font-bold text-blue-600 group-hover:underline">
                          Book Now ➔
                        </span>
                      </div>
                    </a>
                  );
                })
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs">
                  Loading vehicles...
                </div>
              )}
            </div>

            {!isResolved && latestLoc?.lat && hospital?.lat && (
              <div className="space-y-2 pt-2">
                <a
                  href={`https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${latestLoc.lat}&pickup[longitude]=${latestLoc.lng}&pickup[nickname]=My%20Location&dropoff[latitude]=${hospital.lat}&dropoff[longitude]=${hospital.lng}&dropoff[nickname]=${encodeURIComponent(hospital.name)}&dropoff[formatted_address]=${encodeURIComponent(hospital.address || hospital.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleCopyAddress()}
                  className="flex items-center justify-center gap-2 w-full bg-black hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md text-sm"
                >
                  <span className="text-lg">🚗</span>
                  <span>Open in Uber App (Auto-Copies Address)</span>
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${latestLoc.lat},${latestLoc.lng}&destination=${hospital.lat},${hospital.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200 transition"
                  >
                    <span>🗺️</span>
                    <span>Google Maps Route</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowQR(!showQR)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs border border-slate-300 transition"
                  >
                    <span>📱</span>
                    <span>{showQR ? "Hide Mobile QR" : "Scan for Phone"}</span>
                  </button>
                </div>

                {showQR && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center animate-fade-in-up">
                    <p className="text-xs font-bold text-slate-700 mb-2">Scan with Phone Camera to Open Native Uber App:</p>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${latestLoc.lat}&pickup[longitude]=${latestLoc.lng}&pickup[nickname]=My%20Location&dropoff[latitude]=${hospital.lat}&dropoff[longitude]=${hospital.lng}&dropoff[nickname]=${encodeURIComponent(hospital.name)}&dropoff[formatted_address]=${encodeURIComponent(hospital.address || hospital.name)}`
                      )}`}
                      alt="Uber QR Code"
                      className="mx-auto rounded-lg shadow-sm border border-slate-200 w-36 h-36"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Points directly into the mobile Uber App with hospital pre-filled.
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center text-[11px] text-amber-800">
                  📋 <b>Tip:</b> Hospital destination is copied to your clipboard. On desktop Uber, press <b>Ctrl + V</b> in the search bar.
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-400 text-center">
              *Real-time estimates powered by Uber Developer API with automated coordinate handoff.
            </p>
          </div>
        ) : isAmbulanceMode ? (
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
              {(isAmbulanceMode || isUberMode) ? (
                <>
                  {!isUberMode && (
    <div>
      <span className="text-xs text-slate-400 font-bold uppercase block">Ambulance Location</span>
      <span className="text-sm font-mono bg-amber-50 px-2 py-1 rounded text-amber-700">
        {ambulance?.lat?.toFixed(5) || "--"}, {ambulance?.lng?.toFixed(5) || "--"}
      </span>
    </div>
  )}
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
        {(isAmbulanceMode || isUberMode) ? (
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
                {!isUberMode && ambulance?.lat && <Marker position={[ambulance.lat, ambulance.lng]}><Popup>Ambulance</Popup></Marker>}
                {hospital?.lat && <Marker position={[hospital.lat, hospital.lng]}><Popup>Destination Hospital</Popup></Marker>}
                
                {/* OSRM Routes */}
                {!isUberMode && ambRouteCoords.length > 0 && <Polyline positions={ambRouteCoords} color="#f59e0b" weight={5} opacity={0.8} />}
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

