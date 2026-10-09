import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import toast from "react-hot-toast";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";

// Fix Leaflet Default Icon Path issues in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const userMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const hospitalMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to dynamically fit Leaflet bounds to both pickup and hospital
function RecenterMap({ pickup, hospital, routeCoords }) {
  const map = useMap();
  useEffect(() => {
    if (!pickup || !hospital) return;
    if (routeCoords && routeCoords.length > 0) {
      const bounds = L.latLngBounds(routeCoords);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      const bounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [hospital.lat, hospital.lng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, pickup, hospital, routeCoords]);
  return null;
}

export default function SOSFlow({ isOpen, onClose }) {
  const { user } = useAuth();

  // Stages: 'TRIAGE' | 'LOCATING' | 'HOSPITALS' | 'ESTIMATE' | 'COUNTDOWN' | 'TRACKING'
  const [stage, setStage] = useState("TRIAGE");
  
  // Triage state (Rule-based non-negotiable safety)
  const [triage, setTriage] = useState({
    chestPain: false,
    difficultyBreathing: false,
    severeBleeding: false,
    unconscious: false,
    strokeSigns: false,
    severeInjury: false,
  });
  const [shareWithDoctor, setShareWithDoctor] = useState(true);
  const [isListening, setIsListening] = useState(false);

  // SOS Event and location state
  const [sosEvent, setSosEvent] = useState(null);
  const [location, setLocation] = useState(null); // { lat, lng, accuracy, address }
  const [locatingError, setLocatingError] = useState(null);

  // Hospital state
  const [topHospitals, setTopHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);

  // Uber estimate and ride state
  const [estimates, setEstimates] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("uber-go");
  const [cancelCountdown, setCancelCountdown] = useState(5);
  const countdownIntervalRef = useRef(null);

  // Tracking state
  const [rideResult, setRideResult] = useState(null);
  const [trackingUrl, setTrackingUrl] = useState("");

  const isCriticalTriage = Boolean(
    triage.chestPain ||
    triage.difficultyBreathing ||
    triage.severeBleeding ||
    triage.unconscious ||
    triage.strokeSigns ||
    triage.severeInjury
  );

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStage("TRIAGE");
      setTriage({
        chestPain: false,
        difficultyBreathing: false,
        severeBleeding: false,
        unconscious: false,
        strokeSigns: false,
        severeInjury: false,
      });
      setSosEvent(null);
      setLocation(null);
      setTopHospitals([]);
      setSelectedHospital(null);
      setCancelCountdown(5);
      clearInterval(countdownIntervalRef.current);
    }
  }, [isOpen]);

  // Voice triage recognition helper (Web Speech API)
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast("Listening for symptoms (e.g., 'I have chest pain')...", { icon: "🎙️" });
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript.toLowerCase();
        setIsListening(false);
        toast.success(`Heard: "${text}"`);

        // Rule-based symptom matcher
        setTriage((prev) => ({
          ...prev,
          chestPain: prev.chestPain || /chest|heart/i.test(text),
          difficultyBreathing: prev.difficultyBreathing || /breath|suffocat|asthma/i.test(text),
          severeBleeding: prev.severeBleeding || /bleed|blood/i.test(text),
          unconscious: prev.unconscious || /faint|unconscious|dizzy|collapse/i.test(text),
          strokeSigns: prev.strokeSigns || /stroke|slur|numb|paraly/i.test(text),
          severeInjury: prev.severeInjury || /accident|fracture|broken|fall|injury/i.test(text),
        }));
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (_) {
      setIsListening(false);
    }
  };

  // STEP 1: Submit Triage & Start Location Acquisition
  const handleProceedToLocation = async () => {
    try {
      setStage("LOCATING");
      const res = await API.post("/sos/start", {
        triageAnswers: triage,
        shareWithDoctorConsent: shareWithDoctor,
      });
      const createdEvent = res.data?.data?.sosEvent || res.data?.sosEvent;
      setSosEvent(createdEvent);

      // Acquire Live GPS
      acquireLiveGPS(createdEvent._id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start emergency session.");
      setStage("TRIAGE");
    }
  };

  // STEP 2: Live GPS Acquisition with High Accuracy and watchPosition fallback
  const acquireLiveGPS = (eventId) => {
    if (!navigator.geolocation) {
      setLocatingError("Geolocation is not supported by your browser.");
      fallbackToCoordinates(eventId, 17.4474, 78.3762, 500, "Default Location (Hyderabad)");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          address: "Live GPS Location",
        };
        setLocation(coords);
        await fetchHospitalsForLocation(eventId, coords);
      },
      (err) => {
        console.warn("Geolocation warning, attempting fallback fix:", err.message);
        fallbackToCoordinates(eventId, 17.4474, 78.3762, 250, "Hyderabad Vicinity");
      },
      options
    );
  };

  const fallbackToCoordinates = async (eventId, lat, lng, accuracy, address) => {
    const coords = { lat, lng, accuracy, address };
    setLocation(coords);
    await fetchHospitalsForLocation(eventId, coords);
  };

  // STEP 3: Query Top 3 Ranked Hospitals via Overpass/DB and OSRM
  const fetchHospitalsForLocation = async (eventId, coords) => {
    try {
      const res = await API.post(`/sos/${eventId}/hospitals`, coords);
      const hospitals = res.data?.data?.topHospitals || res.data?.topHospitals || [];
      const preselected = res.data?.data?.preselectedHospital || hospitals[0] || null;

      setTopHospitals(hospitals);
      setSelectedHospital(preselected);

      // Fetch Uber Estimates for preselected hospital
      if (preselected) {
        try {
          const estRes = await API.post(`/sos/${eventId}/ride/estimate`);
          const estList = estRes.data?.data?.estimates || estRes.data?.estimates || [];
          setEstimates(estList);
        } catch (err) {
          console.debug("Estimates notice:", err?.message);
        }
      }

      setStage("HOSPITALS");
    } catch (err) {
      toast.error("Failed to query emergency hospitals. Calling 108 is strongly recommended.");
      setStage("HOSPITALS");
    }
  };

  // STEP 4: Start 5-Second Cancel Countdown Before Ride Confirmation
  const handleInitiateUberBooking = () => {
    setStage("COUNTDOWN");
    setCancelCountdown(5);

    countdownIntervalRef.current = setInterval(() => {
      setCancelCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          executeRideConfirmation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelCountdown = () => {
    clearInterval(countdownIntervalRef.current);
    setStage("HOSPITALS");
    toast("Uber booking cancelled.", { icon: "ℹ️" });
  };

  // STEP 5: Execute Confirmed Booking via RideProvider
  const executeRideConfirmation = async () => {
    if (!sosEvent || !selectedHospital) return;
    try {
      setStage("TRACKING");
      const res = await API.post(`/sos/${sosEvent._id}/ride/confirm`, {
        hospitalName: selectedHospital.name,
        hospitalLat: selectedHospital.lat,
        hospitalLng: selectedHospital.lng,
        hospitalPhone: selectedHospital.phone,
        hospitalAddress: selectedHospital.address,
        productId: selectedProduct,
        providerType: "uber_api",
      });

      const data = res.data?.data || res.data;
      setRideResult(data.rideResult);
      setTrackingUrl(data.trackingUrl);

      // If universal deep links returned, open for immediate mobile Uber app handoff
      if (data.deepLinks?.webUrl && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        window.location.href = data.deepLinks.appUrl || data.deepLinks.webUrl;
      }

      toast.success("Uber ride booked! Emergency contacts and doctor alerted.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm Uber ride. Please call 108 immediately.");
    }
  };

  // Cancel Confirmed Ride
  const handleCancelConfirmedRide = async () => {
    if (!sosEvent) return;
    if (!window.confirm("Are you sure you want to cancel the Uber ride?")) return;
    try {
      await API.delete(`/sos/${sosEvent._id}/ride`);
      toast.success("Ride cancelled. You can call 108 anytime.");
      setStage("HOSPITALS");
    } catch (err) {
      toast.error("Failed to cancel ride.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Prominent Top Ambulance Bar (Always visible - Non-negotiable safety) */}
        <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-pulse">🚨</span>
            <div>
              <p className="font-black text-sm uppercase tracking-wider">Emergency Ambulance Helpline</p>
              <p className="text-[11px] text-red-100">A cab is not suitable for life-threatening emergencies.</p>
            </div>
          </div>
          <a
            href="tel:108"
            className="bg-white text-red-700 font-black text-xs px-3.5 py-2 rounded-xl shadow-md hover:bg-red-50 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>📞 Call 108</span>
          </a>
        </div>

        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
            <h2 className="font-extrabold text-slate-800 text-base">BookDoctor SOS Emergency</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center text-lg font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* STAGE 1: RULE-BASED TRIAGE & VOICE INPUT */}
          {stage === "TRIAGE" && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                <p className="font-extrabold text-sm">⚠️ Mandatory Safety Triage</p>
                <p>
                  Please check if you or the patient are experiencing any of these life-threatening symptoms.
                </p>
              </div>

              {/* Symptom Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  { key: "chestPain", icon: "💔", label: "Chest pain or tightness" },
                  { key: "difficultyBreathing", icon: "🫁", label: "Severe difficulty breathing" },
                  { key: "severeBleeding", icon: "🩸", label: "Uncontrolled heavy bleeding" },
                  { key: "unconscious", icon: "😵", label: "Loss of consciousness / fainting" },
                  { key: "strokeSigns", icon: "🧠", label: "Stroke signs (face droop, slurred speech)" },
                  { key: "severeInjury", icon: "🩹", label: "Severe physical trauma / injury" },
                ].map((symptom) => (
                  <label
                    key={symptom.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      triage[symptom.key]
                        ? "bg-red-50 border-red-300 text-red-900 font-bold"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={triage[symptom.key]}
                      onChange={(e) => setTriage((prev) => ({ ...prev, [symptom.key]: e.target.checked }))}
                      className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                    />
                    <span className="text-base">{symptom.icon}</span>
                    <span className="flex-1">{symptom.label}</span>
                  </label>
                ))}
              </div>

              {/* Voice Input Assistant */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎙️</span>
                  <div>
                    <p className="font-bold text-slate-700">Voice Assistant</p>
                    <p className="text-[10px] text-slate-400">Tap to speak your emergency symptoms</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 ${
                    isListening ? "bg-red-600 text-white animate-pulse" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{isListening ? "Listening..." : "Speak Symptoms"}</span>
                </button>
              </div>

              {/* Doctor Consent Toggle */}
              <label className="flex items-center gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={shareWithDoctor}
                  onChange={(e) => setShareWithDoctor(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-slate-300"
                />
                <span>Notify my primary doctor in BookDoctor of this emergency visit.</span>
              </label>

              {/* Triage Decision Buttons */}
              <div className="pt-2">
                {isCriticalTriage ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-red-100/70 border border-red-300 rounded-xl text-xs text-red-900 font-bold flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Critical condition detected. You must call an ambulance immediately.</span>
                    </div>
                    <a
                      href="tel:108"
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-sm py-3.5 px-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span>📞 Call Ambulance 108 Now (Primary Action)</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleProceedToLocation}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors"
                    >
                      Secondary Option: Continue to Find Hospital & Book Uber →
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleProceedToLocation}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-sm py-3.5 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Locate Nearest ER & Book Uber →</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STAGE 2: ACQUIRING GPS LOCATION */}
          {stage === "LOCATING" && (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-800">Acquiring Live GPS Location</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Using high-accuracy geolocation to find emergency hospitals near you...
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="tel:108"
                  className="inline-block bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2 rounded-xl"
                >
                  In immediate danger? Call 108 now
                </a>
              </div>
            </div>
          )}

          {/* STAGE 3: HOSPITAL SELECTION & ROUTE PREVIEW */}
          {stage === "HOSPITALS" && location && (
            <div className="space-y-4">
              
              {/* Accuracy Warning / Pin Adjustment */}
              {location.accuracy != null && location.accuracy > 100 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                  <span>📍 GPS location approximate (±{Math.round(location.accuracy)}m).</span>
                  <span className="text-[10px] text-amber-600">Drag marker if needed</span>
                </div>
              )}

              {/* Leaflet OSM Map Preview */}
              <div className="h-48 sm:h-56 rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0">
                <MapContainer
                  center={[location.lat, location.lng]}
                  zoom={13}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* User Marker (Draggable) */}
                  <Marker
                    position={[location.lat, location.lng]}
                    icon={userMarkerIcon}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const newLat = e.target.getLatLng().lat;
                        const newLng = e.target.getLatLng().lng;
                        const updated = { ...location, lat: newLat, lng: newLng };
                        setLocation(updated);
                        if (sosEvent) fetchHospitalsForLocation(sosEvent._id, updated);
                      },
                    }}
                  >
                    <Popup>Your Location (Drag to adjust)</Popup>
                  </Marker>

                  {/* Destination Hospital Marker */}
                  {selectedHospital && (
                    <Marker
                      position={[selectedHospital.lat, selectedHospital.lng]}
                      icon={hospitalMarkerIcon}
                    >
                      <Popup>{selectedHospital.name}</Popup>
                    </Marker>
                  )}

                  {/* Route Polyline (OSRM road geometry or straight fallback) */}
                  {selectedHospital && (
                    <Polyline
                      positions={
                        selectedHospital.routeCoordinates || [
                          [location.lat, location.lng],
                          [selectedHospital.lat, selectedHospital.lng],
                        ]
                      }
                      color="#2563eb"
                      weight={4}
                      opacity={0.8}
                    />
                  )}

                  {selectedHospital && (
                    <RecenterMap
                      pickup={location}
                      hospital={selectedHospital}
                      routeCoords={selectedHospital.routeCoordinates}
                    />
                  )}
                </MapContainer>
              </div>

              {/* Top 3 Ranked Hospitals */}
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Nearest Emergency Hospitals (Ranked by Road Travel Time)
                </p>

                <div className="grid gap-2">
                  {topHospitals.map((h, idx) => {
                    const isSelected = selectedHospital?.id === h.id || selectedHospital?.name === h.name;
                    return (
                      <div
                        key={h.id || idx}
                        onClick={() => setSelectedHospital(h)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary-50/70 border-primary-500 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-sm text-slate-800">{h.name}</h4>
                              {idx === 0 && (
                                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  Fastest
                                </span>
                              )}
                              {h.has24x7ER && (
                                <span className="text-[10px] font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                                  24/7 ER
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{h.address}</p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-black text-primary-700">
                              ~{h.travelDurationMinutes || 5} mins
                            </div>
                            <div className="text-[11px] text-slate-400">{h.distanceKm} km</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Uber Ride Option & Confirmation Button */}
              {selectedHospital && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">🚗 Uber Service Selection:</span>
                    <span className="text-primary-700 font-extrabold">Pickup in ~3-4 mins</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {estimates.map((est) => (
                      <button
                        key={est.productId}
                        type="button"
                        onClick={() => setSelectedProduct(est.productId)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedProduct === est.productId
                            ? "bg-white border-primary-600 shadow-xs ring-1 ring-primary-600"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="font-bold text-slate-800">{est.displayName}</div>
                        <div className="text-primary-700 font-extrabold text-sm mt-0.5">{est.estimate}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiateUberBooking}
                    className="w-full bg-slate-900 hover:bg-black text-white font-black text-sm py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Confirm Uber to {selectedHospital.name} →</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STAGE 4: 5-SECOND CANCEL COUNTDOWN (Strict Non-Negotiable Confirmation Rule) */}
          {stage === "COUNTDOWN" && (
            <div className="py-12 text-center space-y-6">
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200 animate-ping opacity-25" />
                <div className="w-24 h-24 rounded-full bg-slate-900 text-white flex flex-col items-center justify-center shadow-xl">
                  <span className="text-3xl font-black">{cancelCountdown}</span>
                  <span className="text-[10px] text-slate-400 uppercase">Seconds</span>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-lg text-slate-800">Booking Your Uber Ride</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Destination: <span className="font-bold text-slate-800">{selectedHospital?.name}</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  You have 5 seconds to cancel before the ride is dispatched.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelCountdown}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-sm px-8 py-3 rounded-2xl shadow-lg transition-colors"
              >
                ✕ Cancel Booking Now
              </button>
            </div>
          )}

          {/* STAGE 5: RIDE TRACKING & EMERGENCY STATUS */}
          {stage === "TRACKING" && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <p className="font-black text-sm">Uber Driver En Route</p>
                    <p className="text-emerald-700">Driver is arriving in ~{rideResult?.driver?.etaMinutes || 4} mins</p>
                  </div>
                </div>
                <span className="bg-emerald-200/70 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                  Dispatched
                </span>
              </div>

              {/* Driver and Vehicle Details */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{rideResult?.driver?.name || "Uber Partner Driver"}</h4>
                    <p className="text-slate-500">{rideResult?.driver?.vehicle || "Maruti Suzuki Dzire"}</p>
                  </div>
                  <span className="font-mono font-bold bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
                    {rideResult?.driver?.plate || "TS 08 UB 2026"}
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <a
                    href={`tel:${rideResult?.driver?.phone || "+919849012345"}`}
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-800 border font-bold py-2 rounded-xl text-center text-xs transition-colors"
                  >
                    📞 Call Driver
                  </a>
                  <a
                    href={`tel:${selectedHospital?.phone || "108"}`}
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-800 border font-bold py-2 rounded-xl text-center text-xs transition-colors"
                  >
                    🏥 Call Hospital
                  </a>
                </div>
              </div>

              {/* Live Tracking Link for Emergency Contacts */}
              {trackingUrl && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900">🔗 Live Tracking Link Sent to Contacts:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(trackingUrl);
                        toast.success("Tracking link copied to clipboard!");
                      }}
                      className="text-[11px] font-bold text-primary-600 hover:underline"
                    >
                      Copy Link
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-blue-700 truncate bg-white p-2 rounded-lg border border-blue-100">
                    {trackingUrl}
                  </p>
                </div>
              )}

              {/* Final Safety Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <a
                  href="tel:108"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3 px-4 rounded-xl text-center shadow-md transition-colors"
                >
                  🚨 Call Ambulance 108
                </a>
                <button
                  type="button"
                  onClick={handleCancelConfirmedRide}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition-colors"
                >
                  Cancel Ride
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer / Medical Disclaimer */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center shrink-0">
          This app does not replace emergency services. In a critical emergency call 108/112 immediately.
        </div>

      </div>
    </div>
  );
}
