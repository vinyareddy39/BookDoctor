import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import {
  getFreshLocation,
  reverseGeocode,
  geocodeManualLocation,
  EMERGENCY_NUMBERS
} from "../../services/locationService";
import {
  checkBedAllocation,
  fetchCandidateHospitals,
  selectFastestHospitalByRoad,
  fetchRoadWeights
} from "../../services/hospitalService";
import { findNearestHospital } from "../../utils/dijkstra";
import { openUberRide } from "../../utils/uberDeepLink";

// Custom Leaflet Icons for clean presentation
const userIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hospitalIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/**
 * SOS Emergency Flow Component
 * 
 * Stages:
 * - 'LOCATION': Requesting live location (with permission explainer and error fallback)
 * - 'BED_CHECK': Checking bed allocation for user's request
 * - 'BED_ALLOCATED': Normal flow when bed is secured (does NOT open Uber)
 * - 'DIJKSTRA_ROUTING': Computing shortest road path via Dijkstra
 * - 'SHOW_INFO': Displays hospital information first, map, and explicit "Open Uber Now" button
 * - 'ERROR': Error state with manual fallback and emergency dialer
 */
export default function SOSFlow({ isOpen, onClose }) {
  const navigate = useNavigate();

  const [stage, setStage] = useState("LOCATION"); // LOCATION | BED_CHECK | BED_ALLOCATED | DIJKSTRA_ROUTING | SHOW_INFO | ERROR
  const [loadingMessage, setLoadingMessage] = useState("Getting your live location...");
  const [errorMessage, setErrorMessage] = useState(null);

  // Flow State
  const [userLocation, setUserLocation] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [allocatedData, setAllocatedData] = useState(null);
  const [nearestHospitalData, setNearestHospitalData] = useState(null);
  
  // Manual Location Fallback
  const [manualInput, setManualInput] = useState("");
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [autoRedirectCancelled, setAutoRedirectCancelled] = useState(false);

  // Initiate flow whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      startSOSFlow();
    } else {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setStage("LOCATION");
    setErrorMessage(null);
    setUserLocation(null);
    setUserAddress("");
    setAllocatedData(null);
    setNearestHospitalData(null);
    setManualInput("");
    setRedirectCountdown(3);
    setAutoRedirectCancelled(false);
  };

  // Auto-redirect to pre-filled Uber URL in 3 seconds once nearest hospital is shown
  useEffect(() => {
    if (stage !== "SHOW_INFO" || autoRedirectCancelled) return;
    if (!userLocation || !nearestHospitalData) return;

    if (redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (redirectCountdown === 0) {
      handleOpenUberClick();
    }
  }, [stage, redirectCountdown, autoRedirectCancelled, userLocation, nearestHospitalData]);

  /**
   * STEP 1: SOS Button Click & Live Location Acquisition
   */
  const startSOSFlow = async () => {
    setStage("LOCATION");
    setErrorMessage(null);
    setLoadingMessage("Getting your live location (fresh GPS fix)...");

    try {
      const loc = await getFreshLocation();
      setUserLocation(loc);

      // Reverse geocode asynchronously
      reverseGeocode(loc.latitude, loc.longitude).then(setUserAddress);

      // Move to STEP 2: Bed Check
      await handleBedCheck(loc);
    } catch (err) {
      console.warn("Live location error:", err);
      setErrorMessage(err.message || "Failed to acquire fresh GPS location.");
      setStage("ERROR");
    }
  };

  /**
   * STEP 2: Bed Check & Allocation
   */
  const handleBedCheck = async (loc) => {
    setStage("BED_CHECK");
    setLoadingMessage("Checking ER bed availability at preferred hospitals...");

    try {
      const bedResult = await checkBedAllocation(loc);

      if (bedResult.bedAllocated && bedResult.hospital) {
        // Bed IS allocated: Continue normal hospital flow. Do NOT open Uber!
        setAllocatedData(bedResult);
        setStage("BED_ALLOCATED");
      } else {
        // NO bed allocated: Go to STEP 3 (Dijkstra)
        await handleFindNearestHospital(loc);
      }
    } catch (err) {
      // In case of bed check failure, go to Dijkstra fallback
      await handleFindNearestHospital(loc);
    }
  };

  /**
   * STEP 3: Find Nearest Hospital via Road Duration Ranking
   */
  const handleFindNearestHospital = async (loc) => {
    setStage("DIJKSTRA_ROUTING");
    setLoadingMessage("Locating nearest emergency hospitals (Overpass API)...");

    try {
      // 1. Fetch closest 8 candidate hospitals (2km -> 5km -> 10km Overpass)
      const candidates = await fetchCandidateHospitals(loc);
      if (!candidates || candidates.length === 0) {
        throw new Error("No emergency hospitals found in your vicinity.");
      }

      // 2. Compute exact road driving durations via single OSRM Table API call
      setLoadingMessage("Calculating road travel times via OSRM Table Matrix...");
      let selected;
      try {
        selected = await selectFastestHospitalByRoad(loc, candidates);
      } catch (tableErr) {
        // Offline Dijkstra fallback
        const roadWeights = await fetchRoadWeights(loc, candidates);
        selected = findNearestHospital(loc, candidates, roadWeights);
      }

      setNearestHospitalData(selected);
      // Move to STEP 4: Show Information First
      setStage("SHOW_INFO");
    } catch (err) {
      console.error("Hospital search failed:", err);
      setErrorMessage(err.message || "Could not calculate nearest hospital route.");
      setStage("ERROR");
    }
  };

  /**
   * Manual location submission fallback
   */
  const handleManualLocationSubmit = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setIsGeocodingManual(true);
    setErrorMessage(null);

    try {
      const loc = await geocodeManualLocation(manualInput);
      setUserLocation({ latitude: loc.latitude, longitude: loc.longitude });
      setUserAddress(loc.address);

      // Re-run from bed check
      await handleBedCheck({ latitude: loc.latitude, longitude: loc.longitude });
    } catch (err) {
      setErrorMessage(err.message || "Failed to locate entered address.");
    } finally {
      setIsGeocodingManual(false);
    }
  };

  /**
   * STEP 5: Redirect to Uber
   */
  const handleOpenUberClick = () => {
    setAutoRedirectCancelled(true);
    if (!userLocation || !nearestHospitalData) return;

    openUberRide({
      userLat: userLocation.latitude,
      userLng: userLocation.longitude,
      userAddress: userAddress || "Live GPS Location",
      hospLat: nearestHospitalData.lat,
      hospLng: nearestHospitalData.lng,
      hospitalName: nearestHospitalData.name,
      hospitalAddress: nearestHospitalData.address || "Emergency Department"
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-scale-up">

        {/* Modal Header */}
        <div className="bg-red-600 text-white p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-black">
              🚨
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight">SOS EMERGENCY DISPATCH</h2>
              <p className="text-xs text-red-100 font-medium">Fastest Hospital ER & Transit Assistance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-6">

          {/* STAGE: LOADING STATES (LOCATION, BED_CHECK, DIJKSTRA_ROUTING) */}
          {(stage === "LOCATION" || stage === "BED_CHECK" || stage === "DIJKSTRA_ROUTING") && (
            <div className="text-center py-8 space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-4 border-red-200 border-t-red-600 animate-spin" />
                <span className="text-2xl">📍</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">{loadingMessage}</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {stage === "LOCATION" && "We need your live location to find the nearest hospital with available ER beds."}
                  {stage === "BED_CHECK" && "Querying live emergency bed status across hospital network..."}
                  {stage === "DIJKSTRA_ROUTING" && "Building turn-by-turn road graph with real travel times..."}
                </p>
              </div>
            </div>
          )}

          {/* STAGE: BED ALLOCATED (Normal Hospital Flow - NO Uber) */}
          {stage === "BED_ALLOCATED" && allocatedData && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <span className="text-2xl mt-0.5">✅</span>
                <div>
                  <h3 className="text-sm font-black text-emerald-900 uppercase">Emergency Bed Allocated!</h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your preferred emergency department has confirmed an open bed for your arrival.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reserved Hospital</p>
                <h4 className="text-base font-black text-slate-900">{allocatedData.hospital.name}</h4>
                <p className="text-xs text-slate-600">{allocatedData.hospital.address}</p>
                {allocatedData.hospital.phone && (
                  <p className="text-xs font-bold text-emerald-700 pt-1">
                    📞 Emergency Desk: {allocatedData.hospital.phone}
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/emergency/${allocatedData.emergency?._id}`, {
                      state: { emergency: allocatedData.emergency }
                    });
                  }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition text-sm text-center"
                >
                  View Emergency Hospital Tracking ➔
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: SHOW INFORMATION FIRST (NO BED AVAILABLE -> DIJKSTRA HOSPITAL & UBER OPTION) */}
          {stage === "SHOW_INFO" && nearestHospitalData && (
            <div className="space-y-4 animate-fade-in max-h-[75vh] overflow-y-auto pr-1">

              {/* Informational Banner */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                    No beds available at your preferred hospital
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Dijkstra's shortest road algorithm has identified the fastest available hospital ER near you.
                  </p>
                </div>
              </div>

              {/* Nearest Hospital Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏥</span> Nearest Hospital (Dijkstra)
                  </span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {nearestHospitalData.etaMinutes} mins ETA
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-black text-slate-900">{nearestHospitalData.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{nearestHospitalData.address}</p>
                  <p className="text-xs font-semibold text-blue-700 mt-1">
                    Road Distance: <span className="font-bold">{nearestHospitalData.distanceKm} km</span> via turn-by-turn road routing
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <strong>Pickup:</strong> {userAddress || "Live Location"}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {userLocation?.latitude.toFixed(4)}, {userLocation?.longitude.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Small Leaflet Map with Both Pins */}
              {userLocation && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-44 w-full relative z-0">
                  <MapContainer
                    center={[userLocation.latitude, userLocation.longitude]}
                    zoom={12}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
                      <Popup>Your Live Location</Popup>
                    </Marker>
                    <Marker position={[nearestHospitalData.lat, nearestHospitalData.lng]} icon={hospitalIcon}>
                      <Popup>{nearestHospitalData.name}</Popup>
                    </Marker>
                    <Polyline
                      positions={[
                        [userLocation.latitude, userLocation.longitude],
                        [nearestHospitalData.lat, nearestHospitalData.lng]
                      ]}
                      color="#2563eb"
                      weight={3}
                      dashArray="6, 6"
                    />
                  </MapContainer>
                </div>
              )}

              {/* STEP 5: ACTION BUTTONS (AUTO-REDIRECT IN 3S WITH MANUAL OVERRIDE) */}
              <div className="pt-2 space-y-2.5">
                {/* 3-Second Auto-Redirect Alert */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl animate-bounce">🚗</span>
                    <span className="text-xs font-bold text-slate-800">
                      {autoRedirectCancelled ? "Uber Dispatch Available" : "Redirecting to Uber in"}
                    </span>
                    {!autoRedirectCancelled && (
                      <span className="bg-blue-600 text-white font-black text-xs px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        {redirectCountdown}s
                      </span>
                    )}
                  </div>
                  {!autoRedirectCancelled && (
                    <button
                      type="button"
                      onClick={() => setAutoRedirectCancelled(true)}
                      className="text-[11px] bg-white hover:bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm transition whitespace-nowrap"
                    >
                      Stay on Map
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenUberClick}
                  className="w-full py-3.5 bg-black hover:bg-slate-800 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm active:scale-98"
                >
                  <span className="text-lg">🚗</span>
                  <span>Open Uber Now</span>
                  <span className="text-xs opacity-75 font-normal ml-1">➔</span>
                </button>

                {/* Prominent Ambulance Option Next to Uber */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="tel:+919398927430"
                    className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition text-center"
                  >
                    <span>🚑</span>
                    <span>9398927430</span>
                  </a>

                  <a
                    href={`tel:${EMERGENCY_NUMBERS.NATIONAL_EMERGENCY}`}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition text-center"
                  >
                    <span>📞</span>
                    <span>Call 112 (Emergency)</span>
                  </a>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  *A cab is not a substitute for an ambulance in critical trauma cases. Uber only pre-fills pickup & hospital destination; tap "Confirm" inside Uber.
                </p>
              </div>

            </div>
          )}

          {/* STAGE: ERROR / LOCATION PERMISSION FAILED */}
          {stage === "ERROR" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <span>⚠️</span>
                  <span>Location Access Required</span>
                </div>
                <p className="text-xs text-red-600 leading-relaxed">
                  {errorMessage || "We need your live location to calculate turn-by-turn road times to the nearest hospital."}
                </p>
              </div>

              {/* Retry Button */}
              <button
                type="button"
                onClick={startSOSFlow}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition text-xs shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>🔄</span>
                <span>Retry Getting Live GPS</span>
              </button>

              {/* Manual Location Fallback Input */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-700">Or Enter Your Location Manually:</p>
                <form onSubmit={handleManualLocationSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Area, landmark or lat, lng (e.g. Ghatkesar)"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={isGeocodingManual}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
                  >
                    {isGeocodingManual ? "Finding..." : "Set"}
                  </button>
                </form>
              </div>

              {/* Prominent Emergency Dialers Fallback */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
                  Immediate Emergency Assistance
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="tel:+919398927430"
                    className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition hover:bg-red-700"
                  >
                    <span>🚑</span>
                    <span>9398927430</span>
                  </a>
                  <a
                    href={`tel:${EMERGENCY_NUMBERS.NATIONAL_EMERGENCY}`}
                    className="py-3 bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition hover:bg-black"
                  >
                    <span>📞</span>
                    <span>112 Emergency</span>
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
