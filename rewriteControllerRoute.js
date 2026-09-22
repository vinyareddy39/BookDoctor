
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

// Add getRouteAndETA import
if (!code.includes("getRouteAndETA")) {
  code = code.replace(
    `import { calculateDistance, estimateETA } from "../utils/distance.js";`,
    `import { calculateDistance, estimateETA } from "../utils/distance.js";\nimport { getRouteAndETA } from "../utils/routing.js";`
  );
}

// Phase 2: Rewrite triggerEmergency to do two-pass matching for ambulance and hospital
const triggerStart = code.indexOf("export const triggerEmergency = async (req, res, next) => {");
const triggerEnd = code.indexOf("// UPDATE LOCATION (Patient)");

const newTrigger = `export const triggerEmergency = async (req, res, next) => {
  try {
    const { lat, lng, emergencyType = "general" } = req.body;

    if (!lat || !lng) {
      return req.http.badRequest("Location (lat, lng) is required to trigger an SOS.");
    }

    // Phase 1: Try to find nearest doctor
    const availableDoctors = await Doctor.find({
      acceptingEmergencies: true,
      erCapacity: { $gt: 0 },
      lat: { $exists: true },
      lng: { $exists: true }
    }).populate("userId", "name phone");

    let nearestDoctor = null;
    let minDistance = Infinity;

    for (const doc of availableDoctors) {
      const distance = calculateDistance(lat, lng, doc.lat, doc.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestDoctor = doc;
      }
    }

    if (nearestDoctor) {
      const etaMinutes = estimateETA(minDistance);
      const emergency = await Emergency.create({
        patientId: req.user._id,
        assignedDoctorId: nearestDoctor._id,
        responseMode: "doctor",
        location: { lat, lng },
        emergencyType,
        status: "active",
        locationHistory: [{ lat, lng, timestamp: new Date() }]
      });

      const populatedEmergency = await Emergency.findById(emergency._id)
        .populate("patientId", "name phone medicalId")
        .populate({ path: "assignedDoctorId", populate: { path: "userId", select: "name phone" } });

      await Doctor.findByIdAndUpdate(nearestDoctor._id, { $inc: { erCapacity: -1 } });

      return req.http.created({
        emergency: populatedEmergency,
        distanceKm: minDistance.toFixed(2),
        etaMinutes
      }, "Emergency triggered successfully.");
    }

    // Phase 2: Fallback to Ambulance + Hospital with Two-Pass Routing
    const ambulances = await Ambulance.find({ isAvailable: true });
    
    // Pass 1: Haversine shortlist (Top 3)
    const ambShortlist = ambulances.map(amb => ({
      amb,
      dist: calculateDistance(lat, lng, amb.lat, amb.lng)
    })).sort((a, b) => a.dist - b.dist).slice(0, 3);

    let nearestAmbulance = null;
    let minAmbDuration = Infinity;
    let bestAmbRoute = null;

    // Pass 2: OSRM Routing
    for (const item of ambShortlist) {
      const routeData = await getRouteAndETA(item.amb.lat, item.amb.lng, lat, lng);
      if (routeData.durationMinutes < minAmbDuration) {
        minAmbDuration = routeData.durationMinutes;
        nearestAmbulance = item.amb;
        bestAmbRoute = routeData.routeGeoJSON;
      }
    }

    const hospitals = await Hospital.find({ erBedsAvailable: { $gt: 0 } });
    
    // Pass 1: Haversine shortlist (Top 3)
    const hospShortlist = hospitals.map(hosp => ({
      hosp,
      dist: calculateDistance(lat, lng, hosp.lat, hosp.lng)
    })).sort((a, b) => a.dist - b.dist).slice(0, 3);

    let nearestHospital = null;
    let minHospDuration = Infinity;
    let bestHospRoute = null;

    // Pass 2: OSRM Routing
    for (const item of hospShortlist) {
      const routeData = await getRouteAndETA(lat, lng, item.hosp.lat, item.hosp.lng);
      if (routeData.durationMinutes < minHospDuration) {
        minHospDuration = routeData.durationMinutes;
        nearestHospital = item.hosp;
        bestHospRoute = routeData.routeGeoJSON;
      }
    }

    if (!nearestAmbulance || !nearestHospital) {
      return req.http.notFound("No responders or hospital beds currently available. Please call 911 directly.");
    }

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
    });

  } catch (err) {
    next(err);
  }
};

`;

code = code.substring(0, triggerStart) + newTrigger + code.substring(triggerEnd);
fs.writeFileSync(file, code);

