
import fs from "fs";

const file = "client/src/pages/EmergencyTracking.jsx";
let code = fs.readFileSync(file, "utf8");

// 1. Add isUberMode state check
code = code.replace(
  `const isAmbulanceMode = emergency.responseMode === "ambulance";`,
  `const isAmbulanceMode = emergency.responseMode === "ambulance";\n  const isUberMode = emergency.responseMode === "uber";`
);

// 2. Update Header Box logic
code = code.replace(
  `{isResolved ? "? Emergency Resolved" : isAmbulanceMode ? "?? AMBULANCE DISPATCHED" : "?? ACTIVE SOS EMERGENCY"}`,
  `{isResolved ? "? Emergency Resolved" : isUberMode ? "?? UBER FALLBACK TRIGGERED" : isAmbulanceMode ? "?? AMBULANCE DISPATCHED" : "?? ACTIVE SOS EMERGENCY"}`
);
code = code.replace(
  `? "No doctor available nearby. Ambulance routed to your location."`,
  `? "No doctor available nearby. Ambulance routed to your location."\n              : isUberMode\n                ? "Ambulance wait time is too long. Please request an Uber immediately."`
);
code = code.replace(
  `isResolved ? "bg-green-600" : isAmbulanceMode ? "bg-amber-500 animate-pulse-slow" : "bg-red-600 animate-pulse-slow"`,
  `isResolved ? "bg-green-600" : isUberMode ? "bg-blue-600 animate-pulse-slow" : isAmbulanceMode ? "bg-amber-500 animate-pulse-slow" : "bg-red-600 animate-pulse-slow"`
);

// 3. Render Uber block
const mapStart = code.indexOf(`{isAmbulanceMode ? (`);
const mapReplacement = `{isUberMode ? (
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-blue-700 uppercase tracking-wider">Urgent Ride Required</h2>
            <div>
              <p className="text-slate-700 font-medium mb-4">No ambulances are nearby or their ETA exceeds 10 minutes. Please take a cab immediately to the nearest available hospital.</p>
              
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mt-4">Destination Hospital</h2>
              <div className="mb-4">
                <p className="text-lg font-bold text-slate-900">{hospital?.name}</p>
                <p className="text-sm text-slate-500">{hospital?.address}</p>
                <p className="text-xs text-slate-500 mt-1">ER Beds Available: <span className="font-bold text-red-500">{hospital?.erBedsAvailable}</span></p>
              </div>

              {!isResolved && latestLoc?.lat && hospital?.lat && (
                <a 
                  href={\`https://m.uber.com/ul/?action=setPickup&pickup[latitude]=\${latestLoc.lat}&pickup[longitude]=\${latestLoc.lng}&dropoff[latitude]=\${hospital.lat}&dropoff[longitude]=\${hospital.lng}&dropoff[nickname]=\${encodeURIComponent(hospital.name)}\`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center w-full bg-black hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
                >
                  Request Uber to Hospital
                </a>
              )}
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                *This is a client-side deep link. It securely opens the Uber app pre-filled with the hospital coordinates.
              </p>
            </div>
          </div>
        ) : isAmbulanceMode ? (`;
code = code.replace(`{isAmbulanceMode ? (`, mapReplacement);

// 4. Update the Tracking Data panel
code = code.replace(
  `{isAmbulanceMode ? (`,
  `{(isAmbulanceMode || isUberMode) ? (`
);
code = code.replace(
  `<span className="text-xs text-slate-400 font-bold uppercase block">Ambulance Location</span>`,
  `{!isUberMode && <><span className="text-xs text-slate-400 font-bold uppercase block">Ambulance Location</span>`
);
code = code.replace(
  `{ambulance?.lat?.toFixed(5) || "--"}, {ambulance?.lng?.toFixed(5) || "--"}
                    </span>
                  </div>`,
  `{ambulance?.lat?.toFixed(5) || "--"}, {ambulance?.lng?.toFixed(5) || "--"}
                    </span>
                  </div></>}`
);

// 5. Update Map
code = code.replace(
  `{isAmbulanceMode ? (`,
  `{(isAmbulanceMode || isUberMode) ? (`
);
code = code.replace(
  `{ambulance?.lat && <Marker position={[ambulance.lat, ambulance.lng]}><Popup>Ambulance</Popup></Marker>}`,
  `{!isUberMode && ambulance?.lat && <Marker position={[ambulance.lat, ambulance.lng]}><Popup>Ambulance</Popup></Marker>}`
);
code = code.replace(
  `{ambRouteCoords.length > 0 && <Polyline positions={ambRouteCoords} color="#f59e0b" weight={5} opacity={0.8} />}`,
  `{!isUberMode && ambRouteCoords.length > 0 && <Polyline positions={ambRouteCoords} color="#f59e0b" weight={5} opacity={0.8} />}`
);

fs.writeFileSync(file, code);

