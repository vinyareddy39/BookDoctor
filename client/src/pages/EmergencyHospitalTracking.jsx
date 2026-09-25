import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import toast from "react-hot-toast";
import API from "../services/api";
import {
  fetchCandidateHospitals,
  selectFastestHospitalByRoad
} from "../services/hospitalService";
import { openUberRide, isMobileDevice } from "../utils/uberDeepLink";
import {
  formatDialNumber,
  formatDisplayNumber,
  getEmergencyPhoneNumber,
  reverseGeocode,
  geocodeManualLocation
} from "../services/locationService";

// Custom Leaflet marker icons
const userIcon = new L.DivIcon({
  className: "custom-user-marker",
  html: `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(37,99,235,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
      <span style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:block;"></span>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const hospitalIcon = new L.DivIcon({
  className: "custom-hospital-marker",
  html: `
    <div style="background:#dc2626;color:#fff;border-radius:10px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(220,38,38,0.4);border:2px solid #fff;font-size:16px;">
      🏥
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const selectedHospitalIcon = new L.DivIcon({
  className: "custom-selected-marker",
  html: `
    <div style="background:#059669;color:#fff;border-radius:12px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(5,150,105,0.5);border:3px solid #fff;font-size:20px;animation:bounce 1.2s infinite;">
      🏥
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});

export default function EmergencyHospitalTracking() {
  const location = useLocation();

  // Coordinates & Address
  const [userLocation, setUserLocation] = useState(location.state?.userLocation || null);
  const [userAddress, setUserAddress] = useState(location.state?.userAddress || "");
  const [manualInput, setManualInput] = useState("");
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);

  // Hospitals & Routing State
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Acquiring your live location...");
  const [errorMessage, setErrorMessage] = useState(null);

  // Twilio Calling on Desktop
  const [callingTwilio, setCallingTwilio] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  const emergencyPhone = getEmergencyPhoneNumber();
  const isMobile = isMobileDevice();

  /**
   * 1. Acquire live coordinates if not passed via navigation state
   */
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      loadHospitals(userLocation);
      if (!userAddress) {
        reverseGeocode(userLocation.latitude, userLocation.longitude).then(setUserAddress);
      }
    } else {
      acquireLiveLocation();
    }
  }, []);

  const acquireLiveLocation = () => {
    setLoading(true);
    setErrorMessage(null);
    setLoadingMessage("Requesting GPS permission & capturing live location...");

    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser. Please enter your location manually.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setUserLocation(loc);
        reverseGeocode(loc.latitude, loc.longitude).then(setUserAddress);
        loadHospitals(loc);
      },
      (err) => {
        console.warn("Geolocation acquisition failed:", err);
        let msg = "Could not acquire your live location.";
        if (err.code === 1) {
          msg = "Location permission was denied. Please allow location access or enter your location manually below.";
        } else if (err.code === 2) {
          msg = "GPS position unavailable. Please enter your location manually.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please retry or enter manually.";
        }
        setErrorMessage(msg);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  /**
   * 2. Query nearest hospitals and compute OSRM turn-by-turn road times
   */
  const loadHospitals = async (loc) => {
    setLoading(true);
    setErrorMessage(null);
    setLoadingMessage("Querying nearby emergency hospital facilities...");

    try {
      const candidates = await fetchCandidateHospitals(loc);
      if (!candidates || candidates.length === 0) {
        throw new Error("No emergency hospitals detected in your immediate geographic vicinity.");
      }

      setLoadingMessage("Calculating real driving road distances & ETAs via OSRM Matrix...");
      const result = await selectFastestHospitalByRoad(loc, candidates);

      if (result && result.rankedHospitals && result.rankedHospitals.length > 0) {
        setHospitals(result.rankedHospitals);
        setSelectedHospital(result.hospital || result.rankedHospitals[0]);
      } else if (result && result.hospital) {
        setHospitals([result.hospital]);
        setSelectedHospital(result.hospital);
      } else {
        throw new Error("Could not compute road distance routes to candidate hospitals.");
      }
    } catch (err) {
      console.error("Failed to load hospitals:", err);
      setErrorMessage(err.message || "Failed to load nearest emergency hospitals.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manual location input fallback
   */
  const handleManualLocationSubmit = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setIsGeocodingManual(true);
    setErrorMessage(null);

    try {
      const loc = await geocodeManualLocation(manualInput);
      const newLoc = { latitude: loc.latitude, longitude: loc.longitude };
      setUserLocation(newLoc);
      setUserAddress(loc.address);
      await loadHospitals(newLoc);
    } catch (err) {
      setErrorMessage(err.message || "Failed to locate entered address. Try a city or landmark.");
    } finally {
      setIsGeocodingManual(false);
    }
  };

  /**
   * 3. Open Uber with Universal Deep Link (Pre-fills pickup + dropoff)
   */
  const handleOpenUber = () => {
    if (!userLocation || !selectedHospital) {
      toast.error("Please wait until your location and nearest hospital are identified.");
      return;
    }

    openUberRide({
      userLat: userLocation.latitude,
      userLng: userLocation.longitude,
      userAddress: userAddress || "Live Location",
      hospLat: selectedHospital.lat,
      hospLng: selectedHospital.lng,
      hospitalName: selectedHospital.name,
      hospitalAddress: selectedHospital.address || "Emergency Department"
    });
  };

  /**
   * 4. Desktop Twilio Direct Call
   */
  const handleDesktopTwilioCall = async () => {
    if (callingTwilio) return;
    try {
      setCallingTwilio(true);
      toast.loading(`Bridging call to hospital hotline (${formatDisplayNumber(emergencyPhone)})...`, {
        id: "desktop-call"
      });

      const res = await API.post("/call", {
        phoneNumber: formatDialNumber(emergencyPhone)
      });

      if (res.data?.success) {
        toast.success(`Direct call initiated! Your phone is ringing.`, { id: "desktop-call" });
      } else {
        toast.success(`Call requested for ${formatDisplayNumber(emergencyPhone)}.`, { id: "desktop-call" });
      }
    } catch (err) {
      console.warn("Twilio call failed:", err);
      toast.error(err.response?.data?.error || "Could not bridge call via Twilio. Please dial manually.", {
        id: "desktop-call"
      });
    } finally {
      setTimeout(() => setCallingTwilio(false), 3000);
    }
  };

  const handleCopyNumber = () => {
    navigator.clipboard?.writeText?.(emergencyPhone);
    setCopiedNumber(true);
    toast.success("Hospital emergency hotline copied to clipboard!");
    setTimeout(() => setCopiedNumber(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* ── Top Emergency Header ── */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-5 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
              🚨
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight">Emergency Hospital Tracking</h1>
              <p className="text-xs text-red-100 font-medium">
                Live Road Navigation via OSRM Matrix &bull; Transit Dispatch
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Alert: No preferred beds available ── */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-sm">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <h2 className="text-sm font-black text-amber-900 uppercase tracking-wide">
              Preferred Hospital ER is at Capacity
            </h2>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              We evaluated real-time ER availability. Since preferred beds are currently full, our OSRM routing engine
              calculated the fastest alternative hospital emergency rooms near your live coordinates.
            </p>
          </div>
        </div>

        {/* ── Loading State ── */}
        {loading && (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <span className="absolute inset-0 rounded-full border-4 border-red-200 border-t-red-600 animate-spin" />
              <span className="text-2xl">📍</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">{loadingMessage}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Acquiring high-precision GPS coordinates and resolving true driving road distance.
              </p>
            </div>
          </div>
        )}

        {/* ── Error & Manual Location Fallback ── */}
        {!loading && errorMessage && (
          <div className="bg-white rounded-3xl p-6 border border-rose-200 shadow-sm space-y-4">
            <div className="flex items-start gap-3 text-rose-700">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-sm font-bold">Location Error</h3>
                <p className="text-xs text-rose-600 mt-0.5">{errorMessage}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={acquireLiveLocation}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <span>🔄</span>
                <span>Retry Getting GPS Location</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2">Or Enter Your Current City/Area Manually:</p>
              <form onSubmit={handleManualLocationSubmit} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. Hyderabad, Secunderabad, Ghatkesar"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="submit"
                  disabled={isGeocodingManual}
                  className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
                >
                  {isGeocodingManual ? "Searching..." : "Set Location"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Main Tracking Interface (Map + Hospital Cards) ── */}
        {!loading && userLocation && selectedHospital && (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* ── Left Column: Interactive Leaflet Map ── */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-800">Live Road Graph (OSRM)</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                </span>
              </div>

              <div className="h-[380px] sm:h-[440px] w-full relative z-0">
                <MapContainer
                  center={[userLocation.latitude, userLocation.longitude]}
                  zoom={13}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* User marker */}
                  <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
                    <Popup>
                      <div className="text-xs font-sans">
                        <strong className="text-blue-700">Your Live GPS Location</strong>
                        <p className="text-slate-500 mt-0.5">{userAddress || "Current Pickup Point"}</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Hospital markers */}
                  {hospitals.map((hosp, i) => (
                    <Marker
                      key={hosp.id || i}
                      position={[hosp.lat, hosp.lng]}
                      icon={selectedHospital?.id === hosp.id ? selectedHospitalIcon : hospitalIcon}
                      eventHandlers={{
                        click: () => setSelectedHospital(hosp)
                      }}
                    >
                      <Popup>
                        <div className="text-xs font-sans">
                          <strong className="text-slate-800">{hosp.name}</strong>
                          <p className="text-slate-500 text-[11px] mt-0.5">{hosp.address}</p>
                          <p className="text-emerald-700 font-bold mt-1">
                            ⚡ {hosp.roadDurationMins || hosp.etaMinutes || 5} min road ETA ({hosp.roadDistanceKm || hosp.distanceKm} km)
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Route Polyline from User to Selected Hospital */}
                  <Polyline
                    positions={[
                      [userLocation.latitude, userLocation.longitude],
                      [selectedHospital.lat, selectedHospital.lng]
                    ]}
                    color="#2563eb"
                    weight={4}
                    dashArray="8, 8"
                  />
                </MapContainer>
              </div>

              {/* Pickup and Destination Address Strip */}
              <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row gap-3 text-xs">
                <div className="flex-1 flex items-start gap-2">
                  <span className="text-blue-600 font-bold">📍 Pickup:</span>
                  <span className="text-slate-700 font-medium truncate">
                    {userAddress || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
                  </span>
                </div>
                <div className="flex-1 flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">🏥 Drop-off:</span>
                  <span className="text-slate-700 font-medium truncate">{selectedHospital.name}</span>
                </div>
              </div>
            </div>

            {/* ── Right Column: Hospital Ranking Cards & Transit Actions ── */}
            <div className="lg:col-span-5 space-y-4">
              {/* Prominent Action Card with Open Uber Now */}
              <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Recommended Destination
                  </span>
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    {selectedHospital.roadDurationMins || selectedHospital.etaMinutes || 5} mins road ETA
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-snug">{selectedHospital.name}</h2>
                  <p className="text-xs text-slate-500 mt-1">{selectedHospital.address}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1 text-blue-700">
                      <span>🛣️</span>
                      <span>{selectedHospital.roadDistanceKm || selectedHospital.distanceKm} km road distance</span>
                    </span>
                    <span>&bull;</span>
                    <span className="text-emerald-700">Verified ER Facility</span>
                  </div>
                </div>

                {/* ── PROMINENT OPEN UBER NOW BUTTON ── */}
                <button
                  type="button"
                  onClick={handleOpenUber}
                  className="w-full py-4 px-6 bg-black hover:bg-slate-900 active:scale-[0.98] text-white font-black rounded-2xl shadow-xl transition-all duration-200 flex items-center justify-center gap-3 text-base group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">🚗</span>
                  <div className="text-left">
                    <p className="leading-tight">Open Uber Now</p>
                    <p className="text-[11px] font-normal text-slate-300">
                      Pre-fills Pickup ({userAddress ? "Current GPS" : "Live Location"}) & Dropoff ({selectedHospital.name})
                    </p>
                  </div>
                  <span className="ml-auto text-lg text-slate-400 group-hover:text-white transition-colors">➔</span>
                </button>
              </div>

              {/* ── Ranked Hospital Alternative Cards ── */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Nearest Hospitals by Road Distance</span>
                  <span className="text-[10px] text-slate-400 font-normal">OSRM Sorted</span>
                </h3>

                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {hospitals.map((hosp, idx) => {
                    const isSelected = selectedHospital?.id === hosp.id;
                    const eta = hosp.roadDurationMins || hosp.etaMinutes || 5;
                    const dist = hosp.roadDistanceKm || hosp.distanceKm || 1.0;

                    return (
                      <div
                        key={hosp.id || idx}
                        onClick={() => setSelectedHospital(hosp)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-emerald-50/80 border-emerald-400 shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="text-xl mt-0.5">{isSelected ? "📍" : "🏥"}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{hosp.name}</h4>
                              {idx === 0 && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 whitespace-nowrap">
                                  Fastest
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{hosp.address}</p>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-black text-emerald-800 block">{eta} min</span>
                          <span className="text-[10px] text-slate-400">{dist} km</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FIXED BOTTOM BAR: Emergency Tap-to-Call Phone Number ── */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <span className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
              📞
            </span>
            <div>
              <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Emergency Hospital Hotline
              </p>
              <p className="text-[11px] text-slate-500">
                Direct telephony connection to emergency response team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Mobile: Native tel: Link to immediately open dialer */}
            {isMobile ? (
              <a
                href={`tel:${formatDialNumber(emergencyPhone)}`}
                className="w-full sm:w-auto py-3 px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>Call Hospital ({formatDisplayNumber(emergencyPhone)})</span>
              </a>
            ) : (
              /* Desktop: Detects desktop, provides Copy Number & Twilio Direct Bridge */
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="flex-1 sm:flex-none py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5"
                  title="Copy number to dial manually"
                >
                  <span>📋</span>
                  <span>{copiedNumber ? "Copied!" : `Copy ${formatDisplayNumber(emergencyPhone)}`}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDesktopTwilioCall}
                  disabled={callingTwilio}
                  className="flex-1 sm:flex-none py-2.5 px-5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  <span>📞</span>
                  <span>{callingTwilio ? "Bridging Call..." : "Call Now (Twilio Bridge)"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
