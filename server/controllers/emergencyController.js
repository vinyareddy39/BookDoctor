import Emergency from "../models/Emergency.js";
import Doctor from "../models/Doctor.js";
import { calculateDistance, estimateETA } from "../utils/distance.js";

// TRIGGER EMERGENCY (Patient)
export const triggerEmergency = async (req, res, next) => {
  try {
    const { lat, lng, emergencyType = "general" } = req.body;

    if (!lat || !lng) {
      return req.http.badRequest("Location (lat, lng) is required to trigger an SOS.");
    }

    // Find all doctors accepting emergencies with available capacity
    const availableDoctors = await Doctor.find({
      acceptingEmergencies: true,
      erCapacity: { $gt: 0 },
      lat: { $exists: true },
      lng: { $exists: true }
    }).populate("userId", "name phone");

    if (availableDoctors.length === 0) {
      return req.http.notFound("No available emergency responders found nearby.");
    }

    // Find the nearest one using Haversine
    let nearestDoctor = null;
    let minDistance = Infinity;

    for (const doc of availableDoctors) {
      const distance = calculateDistance(lat, lng, doc.lat, doc.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestDoctor = doc;
      }
    }

    const etaMinutes = estimateETA(minDistance);

    // Create the emergency record
    const emergency = await Emergency.create({
      patientId: req.user._id,
      assignedDoctorId: nearestDoctor._id,
      location: { lat, lng },
      emergencyType,
      status: "active",
      locationHistory: [{ lat, lng, timestamp: new Date() }]
    });

    // Populate patient info so doctor can see medical ID immediately
    const populatedEmergency = await Emergency.findById(emergency._id)
      .populate("patientId", "name phone medicalId")
      .populate({ path: "assignedDoctorId", populate: { path: "userId", select: "name phone" } });

    // Decrement ER capacity (optimistic lock / simple decrement for demo)
    await Doctor.findByIdAndUpdate(nearestDoctor._id, { $inc: { erCapacity: -1 } });

    return req.http.created({
      emergency: populatedEmergency,
      distanceKm: minDistance.toFixed(2),
      etaMinutes
    }, "Emergency triggered successfully.");
  } catch (err) {
    next(err);
  }
};

// UPDATE LOCATION (Patient)
export const updateLocation = async (req, res, next) => {
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
      .populate({ path: "assignedDoctorId", populate: { path: "userId", select: "name phone" } });

    if (!emergency) return req.http.notFound("Emergency not found");

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
    if (!doctors || doctors.length === 0) {
      return res.status(404).json({ success: false, message: "No doctors found in DB to update." });
    }

    // Ghatkesar Area Coordinates (for realistic local testing)
    const GHATKESAR_LOCATIONS = [
      { lat: 17.4485, lng: 78.6841 }, // Ghatkesar Center
      { lat: 17.4550, lng: 78.6700 }, // Near ORR Ghatkesar
      { lat: 17.4350, lng: 78.6900 }, // South Ghatkesar
      { lat: 17.4600, lng: 78.6800 }, // North Ghatkesar
      { lat: 17.4400, lng: 78.6750 }  // Edulabad Road
    ];

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

    return res.status(200).json({ 
      success: true, 
      message: "Successfully seeded 5 doctors around Ghatkesar! They are now accepting emergencies with ER capacity.",
      count: doctors.length
    });
  } catch (error) {
    next(error);
  }
};

