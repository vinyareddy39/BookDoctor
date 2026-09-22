
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

const start = code.indexOf("export const getEmergencyStatus");
const end = code.indexOf("export const resolveEmergency");

const newFunc = `export const getEmergencyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const emergency = await Emergency.findById(id)
      .populate("patientId", "name phone medicalId")
      .populate({ path: "assignedDoctorId", populate: { path: "userId", select: "name phone" } })
      .populate("assignedAmbulanceId")
      .populate("assignedHospitalId");

    if (!emergency) return req.http.notFound("Emergency not found");

    // Recalculate ETA and route dynamically for ambulance mode if active
    if (emergency.responseMode === "ambulance" && emergency.status === "active") {
      const amb = emergency.assignedAmbulanceId;
      const hosp = emergency.assignedHospitalId;
      const latestLoc = emergency.locationHistory?.[emergency.locationHistory.length - 1] || emergency.location;

      if (amb && latestLoc) {
        const ambRoute = await getRouteAndETA(amb.lat, amb.lng, latestLoc.lat, latestLoc.lng);
        emergency.ambulanceEtaMinutes = ambRoute.durationMinutes;
        emergency.ambulanceRouteGeoJSON = ambRoute.routeGeoJSON;
      }
      
      if (hosp && latestLoc) {
        const hospRoute = await getRouteAndETA(latestLoc.lat, latestLoc.lng, hosp.lat, hosp.lng);
        emergency.hospitalEtaMinutes = hospRoute.durationMinutes;
        emergency.hospitalRouteGeoJSON = hospRoute.routeGeoJSON;
      }
      
      // Save updated ETAs to DB (non-blocking)
      emergency.save().catch(err => console.error("Failed to save updated ETA:", err));
    }

    return req.http.ok(emergency, "Emergency status retrieved");
  } catch (err) {
    next(err);
  }
};

// RESOLVE EMERGENCY (Patient/Doctor)
`;

code = code.substring(0, start) + newFunc + code.substring(end + 50); // Need to skip the exact match of the old function

fs.writeFileSync(file, code);

