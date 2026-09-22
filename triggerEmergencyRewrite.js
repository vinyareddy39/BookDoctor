
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

// Add imports
if (!code.includes(`import Ambulance`)) {
  code = code.replace(
    `import Doctor from "../models/Doctor.js";`,
    `import Doctor from "../models/Doctor.js";\nimport Ambulance from "../models/Ambulance.js";\nimport Hospital from "../models/Hospital.js";`
  );
}

const triggerEmergencyStart = code.indexOf("export const triggerEmergency");
const updateLocationStart = code.indexOf("export const updateLocation");

const newTriggerEmergency = `export const triggerEmergency = async (req, res, next) => {
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

    // Phase 2: Fallback to Ambulance + Hospital
    const ambulances = await Ambulance.find({ isAvailable: true });
    let nearestAmbulance = null;
    let minAmbDistance = Infinity;
    for (const amb of ambulances) {
      const dist = calculateDistance(lat, lng, amb.lat, amb.lng);
      if (dist < minAmbDistance) {
        minAmbDistance = dist;
        nearestAmbulance = amb;
      }
    }

    const hospitals = await Hospital.find({ erBedsAvailable: { $gt: 0 } });
    let nearestHospital = null;
    let minHospDistance = Infinity;
    for (const hosp of hospitals) {
      const dist = calculateDistance(lat, lng, hosp.lat, hosp.lng);
      if (dist < minHospDistance) {
        minHospDistance = dist;
        nearestHospital = hosp;
      }
    }

    if (!nearestAmbulance || !nearestHospital) {
      return req.http.notFound("No responders or hospital beds currently available. Please call 911 directly.");
    }

    const ambulanceEtaMinutes = estimateETA(minAmbDistance);
    const hospitalEtaMinutes = estimateETA(minHospDistance);

    const emergency = await Emergency.create({
      patientId: req.user._id,
      responseMode: "ambulance",
      assignedAmbulanceId: nearestAmbulance._id,
      assignedHospitalId: nearestHospital._id,
      ambulanceEtaMinutes,
      hospitalEtaMinutes,
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

// UPDATE LOCATION (Patient)
`;

code = code.substring(0, triggerEmergencyStart) + newTriggerEmergency + code.substring(updateLocationStart + 29);

fs.writeFileSync(file, code);

