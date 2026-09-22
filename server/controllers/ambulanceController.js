
import Ambulance from "../models/Ambulance.js";
import Emergency from "../models/Emergency.js";

// GET AMBULANCE STATUS (Patient Tracking)
export const getAmbulanceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ambulance = await Ambulance.findById(id);
    if (!ambulance) return req.http.notFound("Ambulance not found");

    return req.http.ok(ambulance, "Ambulance status retrieved");
  } catch (err) {
    next(err);
  }
};

// UPDATE AMBULANCE LOCATION (Driver App / Simulation)
export const updateAmbulanceLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return req.http.badRequest("Location (lat, lng) is required.");
    }

    const ambulance = await Ambulance.findByIdAndUpdate(
      id,
      { lat, lng },
      { new: true }
    );

    if (!ambulance) return req.http.notFound("Ambulance not found");

    return req.http.ok(ambulance, "Ambulance location updated");
  } catch (err) {
    next(err);
  }
};

// COMPLETE AMBULANCE TRIP (Driver App)
export const completeAmbulanceTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ambulance = await Ambulance.findById(id);

    if (!ambulance) return req.http.notFound("Ambulance not found");
    
    if (ambulance.currentEmergencyId) {
      await Emergency.findByIdAndUpdate(ambulance.currentEmergencyId, {
        status: "resolved",
        resolvedAt: new Date()
      });
    }

    ambulance.isAvailable = true;
    ambulance.currentEmergencyId = null;
    await ambulance.save();

    return req.http.ok(ambulance, "Ambulance trip completed successfully");
  } catch (err) {
    next(err);
  }
};

