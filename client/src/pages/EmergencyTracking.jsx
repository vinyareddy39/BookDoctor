
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function EmergencyTracking() {
  const { emergencyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [emergency, setEmergency] = useState(location.state?.emergency || null);
  const [loading, setLoading] = useState(!location.state?.emergency);
  const [error, setError] = useState(null);
  const [uberVehicles, setUberVehicles] = useState([]);
  const [loadingUber, setLoadingUber] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [autoRedirectCancelled, setAutoRedirectCancelled] = useState(false);

  // Auto-redirect to pre-filled Uber URL after showing 2nd pic
  useEffect(() => {
    if (emergency?.responseMode !== "uber" || autoRedirectCancelled || emergency?.status === "resolved") return;
    const curLoc = emergency?.locationHistory?.[emergency.locationHistory.length - 1] || emergency?.location;
    const hosp = emergency?.assignedHospitalId;
    if (!curLoc?.lat || !hosp?.lat) return;

    if (redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (redirectCountdown === 0) {
      const uberUrl = getUberUrl();
      if (uberUrl && uberUrl !== "#") {
        window.location.href = uberUrl;
      }
    }
  }, [redirectCountdown, emergency?.responseMode, autoRedirectCancelled, emergency?.status, emergency]);

  const getUberUrl = (productId = null) => {
    const curLoc = emergency?.locationHistory?.[emergency.locationHistory.length - 1] || emergency?.location;
    const hosp = emergency?.assignedHospitalId;

    const pLat = curLoc?.lat;
    const pLng = curLoc?.lng;
    const dLat = hosp?.lat;
    const dLng = hosp?.lng;
    const dName = hosp?.name || "Hospital ER";
    const dAddr = hosp?.address || "Emergency Department";
    const pAddr = userAddress || "Live GPS Location";

    if (!pLat || !dLat) return "#";

    const clientId = "DfjKZC3xXnBEObgCRl1ChUSdRJDnjwBP";

    // Official Uber Universal Deep Link Location Objects
    const pickupObj = {
      latitude: Number(pLat),
      longitude: Number(pLng),
      addressLine1: "Live Location",
      addressLine2: pAddr,
    };

    const dropObj = {
      latitude: Number(dLat),
      longitude: Number(dLng),
      addressLine1: dName,
      addressLine2: dAddr,
    };

    const params = new URLSearchParams();
    if (clientId) params.append("client_id", clientId);
    params.append("pickup", JSON.stringify(pickupObj));
    params.append("drop[0]", JSON.stringify(dropObj));

    // Standard setPickup query parameters for legacy mobile apps
    params.append("action", "setPickup");
    params.append("pickup[latitude]", String(pLat));
    params.append("pickup[longitude]", String(pLng));
    params.append("pickup[nickname]", "Live Location");
    params.append("dropoff[latitude]", String(dLat));
    params.append("dropoff[longitude]", String(dLng));
    params.append("dropoff[nickname]", dName);
    params.append("dropoff[formatted_address]", dAddr);

    if (productId) {
      params.append("product_id", productId);
    }

    return `https://m.uber.com/looking?${params.toString()}`;
  };

  const getGoogleMapsUrl = () => {
    const curLoc = emergency?.locationHistory?.[emergency.locationHistory.length - 1] || emergency?.location;
    const hosp = emergency?.assignedHospitalId;
    const pLat = curLoc?.lat;
    const pLng = curLoc?.lng;
    const dLat = hosp?.lat;
    const dLng = hosp?.lng;
    const dName = hosp?.name || "Hospital ER";
    const dAddr = hosp?.address || "";
    if (!pLat || !dLat) return "#";
    return `https://www.google.com/maps/dir/?api=1&origin=${pLat},${pLng}&destination=${encodeURIComponent(dName + " " + dAddr)}&travelmode=driving`;
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
        if (!emergency && !location.state?.emergency) {
          setError("Failed to load emergency details.");
        }
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
          {isResolved ? "✅ Emergency Resolved" : isUberMode ? "🚗 UBER EMERGENCY DISPATCH" : isAmbulanceMode ? "🚑 AMBULANCE DISPATCHED" : "🚨 ACTIVE SOS EMERGENCY"}
        </h1>
        <p className="opacity-90 font-medium">
          {isResolved 
            ? "This emergency has been safely resolved and logged."
            : isAmbulanceMode 
              ? "Ambulance routed to your location."
              : isUberMode
                ? "Direct emergency hospital dispatch via Uber active. Bed reserved at nearest ER."
              : "Live tracking active. Hospital is preparing for your arrival."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {isUberMode ? (
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-blue-700 uppercase tracking-wider">Uber Emergency Ride Options</h2>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">Live API</span>
            </div>
            
            {/* Auto-Redirect to Uber Banner */}
            {!autoRedirectCancelled && !isResolved && (
              <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-4 rounded-xl shadow-md flex items-center justify-between gap-3 animate-fade-in border border-blue-400/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl animate-bounce">🚗</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm">
                        Redirecting to Uber in
                      </p>
                      <span className="bg-white text-blue-700 font-black text-xs px-2 py-0.5 rounded-full shadow-sm">
                        {redirectCountdown}s
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-100 mt-0.5">
                      Live Pickup & {hospital?.name || "Hospital ER"} Drop-off 100% pre-filled.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAutoRedirectCancelled(true)}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-lg transition border border-white/20"
                  >
                    Stay on Map
                  </button>
                  <a
                    href={getUberUrl()}
                    className="text-xs bg-white text-blue-700 hover:bg-blue-50 font-black px-3 py-1.5 rounded-lg transition shadow-sm"
                  >
                    Open Uber Now ➔
                  </a>
                </div>
              </div>
            )}

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
                  <div className="mt-0.5">
                    <p className="text-sm font-bold text-slate-900">{hospital?.name || "Nearest Hospital ER"}</p>
                    <p className="text-xs text-slate-500">{hospital?.address || "Emergency Ward"}</p>
                    <p className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      <span>⚡</span>
                      <span>Shortest real road route ({emergency?.hospitalEtaMinutes || 10} min ETA via OSRM/Dijkstra)</span>
                    </p>
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
                uberVehicles.map((v) => (
                  <a
                    key={v.product_id}
                    href={getUberUrl(v.product_id)}
                    target="_blank"
                    rel="noopener noreferrer"
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
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs">
                  Loading vehicles...
                </div>
              )}
            </div>

            {!isResolved && latestLoc?.lat && hospital?.lat && (
              <div className="space-y-2 pt-2">
                <a
                  href={getUberUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-black hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md text-sm"
                >
                  <span className="text-lg">🚗</span>
                  <span>Open in Uber App (Pre-filled Dispatch)</span>
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={getGoogleMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200 transition"
                  >
                    <span>🗺️</span>
                    <span>Google Maps (100% Autofill)</span>
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
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getUberUrl())}`}
                      alt="Uber QR Code"
                      className="mx-auto rounded-lg shadow-sm border border-slate-200 w-36 h-36"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Points directly into the native mobile Uber App with hospital ER pre-filled.
                    </p>
                  </div>
                )}
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

        {/* Right Column: Live Hospital Location, Route, & Tracking Data */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Live Hospital Route & Tracking</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 animate-pulse">
                Live Dijkstra / OSRM
              </span>
            </div>

            {/* Destination Hospital Summary Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Destination ER</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-100 text-green-700">
                  {hospital?.erBedsAvailable || 1} Beds Open
                </span>
              </div>
              <p className="text-base font-black text-slate-900 mt-1">{hospital?.name || "Nearest Hospital ER"}</p>
              <p className="text-xs text-slate-500">{hospital?.address || "Hyderabad"}</p>
              
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  <span>⚡</span>
                  <span>Shortest road route: {emergency?.hospitalEtaMinutes || 3} min ETA via OSRM/Dijkstra</span>
                </span>
                {hospital?.phone && (
                  <span className="text-xs text-slate-500 font-medium">📞 {hospital.phone}</span>
                )}
              </div>
            </div>

            {/* Live Interactive Route Map */}
            <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-200 shadow-inner relative z-0 mb-4">
              {latestLoc?.lat && (
                <MapContainer 
                  center={[latestLoc.lat, latestLoc.lng]} 
                  zoom={14} 
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  
                  {/* Markers */}
                  {latestLoc && <Marker position={[latestLoc.lat, latestLoc.lng]}><Popup>You are here (Pickup)</Popup></Marker>}
                  {hospital?.lat && <Marker position={[hospital.lat, hospital.lng]}><Popup>{hospital.name} (ER Destination)</Popup></Marker>}
                  
                  {/* OSRM Route */}
                  {hospRouteCoords.length > 0 && <Polyline positions={hospRouteCoords} color="#2563eb" weight={6} opacity={0.85} />}
                </MapContainer>
              )}
            </div>

            {/* Coordinates Data */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Your Live Location</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {latestLoc?.lat?.toFixed(5)}, {latestLoc?.lng?.toFixed(5)}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Hospital Location</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {hospital?.lat?.toFixed(5) || "--"}, {hospital?.lng?.toFixed(5) || "--"}
                </span>
              </div>
            </div>
          </div>

          {!isResolved && (
            <button 
              onClick={handleResolve}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md"
            >
              Mark as Resolved
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

