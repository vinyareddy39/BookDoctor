import Emergency from "../models/Emergency.js";
import Doctor from "../models/Doctor.js";
import Ambulance from "../models/Ambulance.js";
import Hospital from "../models/Hospital.js";
import { calculateDistance, estimateETA } from "../utils/distance.js";
import { getRouteAndETA } from "../utils/routing.js";
import { getUberEstimates } from "../services/uberService.js";

// TRIGGER EMERGENCY (Patient)
export const triggerEmergency = async (req, res, next) => {
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

    });

  } catch (err) {
    next(err);
  }
};

// UPDATE LOCATION (Patient)
 async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return req.http.badRequest("Location (lat, lng) is required.");
    }

    const emergency = await Emergency.findOneAndUpdate(
      { _id: id, patientId: req.user._id, status: "active" },
      { 
        $set: { location: { lat, lng } },
        $push: { locationHistory: { lat, lng, timestamp: new Date() } }
      },
      { new: true }
    );

    if (!emergency) return req.http.notFound("Active emergency not found");

    return req.http.ok(emergency, "Location updated");
  } catch (err) {
    next(err);
  }
};

// GET EMERGENCY STATUS (Patient/Doctor)
export const getEmergencyStatus = async (req, res, next) => {
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

      let saveNeeded = false;

      if (amb && latestLoc) {
        const ambRoute = await getRouteAndETA(amb.lat, amb.lng, latestLoc.lat, latestLoc.lng);
        emergency.ambulanceEtaMinutes = ambRoute.durationMinutes;
        emergency.ambulanceRouteGeoJSON = ambRoute.routeGeoJSON;
        saveNeeded = true;
      }
      
      if (hosp && latestLoc) {
        const hospRoute = await getRouteAndETA(latestLoc.lat, latestLoc.lng, hosp.lat, hosp.lng);
        emergency.hospitalEtaMinutes = hospRoute.durationMinutes;
        emergency.hospitalRouteGeoJSON = hospRoute.routeGeoJSON;
        saveNeeded = true;
      }
      
      if (saveNeeded) {
        await emergency.save().catch(err => console.error("Failed to save updated ETA:", err));
      }
    }

    return req.http.ok(emergency, "Emergency status retrieved");
  } catch (err) {
    next(err);
  }
};

// RESOLVE EMERGENCY (Patient/Doctor)
export const resolveEmergency = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const emergency = await Emergency.findById(id);
    if (!emergency) return req.http.notFound("Emergency not found");

    emergency.status = "resolved";
    emergency.resolvedAt = new Date();
    await emergency.save();

    // Free up the bed/capacity for the doctor
    if (emergency.assignedDoctorId) {
      await Doctor.findByIdAndUpdate(emergency.assignedDoctorId, { $inc: { erCapacity: 1 } });
    }

    return req.http.ok(emergency, "Emergency resolved");
  } catch (err) {
    next(err);
  }
};

// GET INCOMING EMERGENCIES (Doctor Dashboard)
export const getIncomingEmergencies = async (req, res, next) => {
  try {
    // Assuming req.user is a doctor. Find their Doctor record.
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return req.http.forbidden("User is not a doctor");

    const emergencies = await Emergency.find({ assignedDoctorId: doctor._id, status: "active" })
      .populate("patientId", "name phone medicalId")
      .sort({ createdAt: -1 });

    return req.http.ok(emergencies, "Incoming emergencies retrieved");
  } catch (err) {
    next(err);
  }
};

// UPDATE ER CAPACITY (Doctor Dashboard)
export const markCapacityUpdated = async (req, res, next) => {
  try {
    const { acceptingEmergencies, erCapacity } = req.body;
    
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return req.http.forbidden("User is not a doctor");

    if (acceptingEmergencies !== undefined) doctor.acceptingEmergencies = acceptingEmergencies;
    if (erCapacity !== undefined) doctor.erCapacity = erCapacity;

    await doctor.save();

    return req.http.ok({ acceptingEmergencies: doctor.acceptingEmergencies, erCapacity: doctor.erCapacity }, "Emergency capacity updated");
  } catch (err) {
    next(err);
  }
};


// HACKATHON DEMO: Seed Ghatkesar Doctors via GET request (Bypasses local ISP blocks by running on Render)
export const seedGhatkesarData = async (req, res, next) => {
  try {
    const doctors = await Doctor.find().limit(5);
    
    const GHATKESAR_LOCATIONS = [
      { lat: 17.4485, lng: 78.6841 }, // Ghatkesar Center
      { lat: 17.4550, lng: 78.6700 }, // Near ORR Ghatkesar
      { lat: 17.4350, lng: 78.6900 }, // South Ghatkesar
      { lat: 17.4600, lng: 78.6800 }, // North Ghatkesar
      { lat: 17.4400, lng: 78.6750 }  // Edulabad Road
    ];

    if (doctors && doctors.length > 0) {
      for (let i = 0; i < doctors.length; i++) {
        const doc = doctors[i];
        const loc = GHATKESAR_LOCATIONS[i % GHATKESAR_LOCATIONS.length];
        
        doc.acceptingEmergencies = true;
        doc.erCapacity = Math.floor(Math.random() * 5) + 2; // 2 to 6 beds
        doc.lat = loc.lat;
        doc.lng = loc.lng;
        doc.city = "Ghatkesar, Hyderabad";
        
        await doc.save();
      }
    }

    // Seed Mock Ambulances
    await Ambulance.deleteMany({});
    await Ambulance.insertMany([
      { driverName: "Ramesh Ambulance", phone: "+91 9876543210", vehicleNumber: "TS 07 EA 1234", lat: 17.4490, lng: 78.6830, isAvailable: true },
      { driverName: "Suresh Rescue", phone: "+91 9876543211", vehicleNumber: "TS 08 AB 5678", lat: 17.4500, lng: 78.6800, isAvailable: true }
    ]);

    // Seed Mock Hospitals
    await Hospital.deleteMany({});
    await Hospital.insertMany([
      { name: "Anurag Care Hospital", address: "Ghatkesar Main Rd", lat: 17.4450, lng: 78.6850, specialties: ["Trauma", "Cardiac"], erBedsAvailable: 5, icuBedsAvailable: 2, phone: "+91 40 1234567" },
      { name: "Sreenidhi Lifeline", address: "Yampee Rd, Ghatkesar", lat: 17.4380, lng: 78.6900, specialties: ["General", "Orthopedic"], erBedsAvailable: 3, icuBedsAvailable: 1, phone: "+91 40 7654321" }
    ]);

    return res.status(200).json({ 
      success: true, 
      message: "Successfully seeded Doctors, Ambulances, and Hospitals around Ghatkesar for demo!"
    });
  } catch (error) {
    next(error);
  }
};

// HACKATHON DEMO: Disable all doctors to force the ambulance fallback
export const disableAllDoctors = async (req, res, next) => {
  try {
    await Doctor.updateMany({}, { acceptingEmergencies: false, erCapacity: 0 });
    return res.status(200).json({ 
      success: true, 
      message: "All doctors disabled! Next SOS trigger will force the Ambulance Fallback flow."
    });
  } catch (error) {
    next(error);
  }
};

// HACKATHON DEMO: Disable all ambulances to force the Uber fallback
export const disableAllAmbulances = async (req, res, next) => {
  try {
    await Ambulance.updateMany({}, { isAvailable: false });
    return res.status(200).json({ 
      success: true, 
      message: "All ambulances disabled! Next SOS trigger will force the Uber Fallback flow."
    });
  } catch (error) {
    next(error);
  }
};

export const getUberEstimatesHandler = async (req, res, next) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.query;
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ success: false, message: "Missing coordinates" });
    }

    const estimates = await getUberEstimates(
      parseFloat(startLat),
      parseFloat(startLng),
      parseFloat(endLat),
      parseFloat(endLng)
    );

    return res.status(200).json({ success: true, data: estimates });
  } catch (error) {
    next(error);
  }
};
