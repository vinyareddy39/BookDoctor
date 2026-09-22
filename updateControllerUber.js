
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

const startStr = "if (!nearestAmbulance || !nearestHospital) {";
const endStr = "message: \"No doctor available. Ambulance dispatched.\"";

if (code.includes(startStr)) {
  const replacement = `
    // Check if we need to fall back to Uber (no ambulance OR ambulance > 10 mins)
    const UBER_THRESHOLD_MINS = 10;
    const requiresUberFallback = !nearestAmbulance || minAmbDuration > UBER_THRESHOLD_MINS;

    if (!nearestHospital) {
      return req.http.notFound("No responders or hospital beds currently available. Please call 911 directly.");
    }

    if (requiresUberFallback) {
      const emergency = await Emergency.create({
        patientId: req.user._id,
        responseMode: "uber",
        assignedHospitalId: nearestHospital._id,
        hospitalEtaMinutes: minHospDuration,
        hospitalRouteGeoJSON: bestHospRoute,
        location: { lat, lng },
        emergencyType,
        status: "active",
        locationHistory: [{ lat, lng, timestamp: new Date() }]
      });

      await Hospital.findByIdAndUpdate(nearestHospital._id, { $inc: { erBedsAvailable: -1 } });

      const populatedEmergency = await Emergency.findById(emergency._id)
        .populate("patientId", "name phone medicalId")
        .populate("assignedHospitalId");

      return req.http.created({
        emergency: populatedEmergency,
        message: "No ambulance available quickly. Uber fallback suggested."
      });
    }

    // Otherwise, dispatch the ambulance normally
    const emergency = await Emergency.create({
      patientId: req.user._id,
      responseMode: "ambulance",
      assignedAmbulanceId: nearestAmbulance._id,
      assignedHospitalId: nearestHospital._id,
      ambulanceEtaMinutes: minAmbDuration,
      hospitalEtaMinutes: minHospDuration,
      ambulanceRouteGeoJSON: bestAmbRoute,
      hospitalRouteGeoJSON: bestHospRoute,
      location: { lat, lng },
      emergencyType,
      status: "active",
      locationHistory: [{ lat, lng, timestamp: new Date() }]
    });

    // Lock the ambulance
    await Ambulance.findByIdAndUpdate(nearestAmbulance._id, { 
      isAvailable: false, 
      currentEmergencyId: emergency._id 
    });

    // Decrement hospital bed
    await Hospital.findByIdAndUpdate(nearestHospital._id, { $inc: { erBedsAvailable: -1 } });

    const populatedEmergency = await Emergency.findById(emergency._id)
      .populate("patientId", "name phone medicalId")
      .populate("assignedAmbulanceId")
      .populate("assignedHospitalId");

    return req.http.created({
      emergency: populatedEmergency,
      message: "No doctor available. Ambulance dispatched."
`;
  
  // Replace the block
  const startIdx = code.indexOf(startStr);
  const endIdx = code.indexOf(endStr) + endStr.length;
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync(file, code);
}

