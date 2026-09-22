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

    // DIRECT UBER EMERGENCY DISPATCH: Find nearest hospital with open ER beds
    const hospitals = await Hospital.find({ erBedsAvailable: { $gt: 0 } });
    
    // Pass 1: Haversine shortlist (Top 3 closest hospitals)
    const hospShortlist = hospitals.map(hosp => ({
      hosp,
      dist: calculateDistance(lat, lng, hosp.lat, hosp.lng)
    })).sort((a, b) => a.dist - b.dist).slice(0, 3);

    let nearestHospital = null;
    let minHospDuration = Infinity;
    let bestHospRoute = null;

    // Pass 2: OSRM Routing for real road driving time
    for (const item of hospShortlist) {
      const routeData = await getRouteAndETA(lat, lng, item.hosp.lat, item.hosp.lng);
      if (routeData.durationMinutes < minHospDuration) {
        minHospDuration = routeData.durationMinutes;
        nearestHospital = item.hosp;
        bestHospRoute = routeData.routeGeoJSON;
      }
    }

    // Hyper-local Live Emergency Fallback:
    // If the closest database hospital is more than 8km away, dynamically query OpenStreetMap for a hospital right next to the user
    const closestDist = nearestHospital ? calculateDistance(lat, lng, nearestHospital.lat, nearestHospital.lng) : 999;
    if (closestDist > 8) {
      try {
        const osmRes = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=hospital&limit=3&bounded=1&viewbox=${lng - 0.06},${lat + 0.06},${lng + 0.06},${lat - 0.06}`,
          { headers: { "User-Agent": "BookDoctor-Emergency/1.0" }, timeout: 3500 }
        );
        if (osmRes.data && osmRes.data.length > 0) {
          const topResult = osmRes.data[0];
          const rawName = topResult.display_name.split(",")[0] || "Emergency Hospital";
          const rawAddr = topResult.display_name.split(",").slice(1, 3).join(",") || "Nearby Emergency Ward";
          const cleanName = rawName.length > 3 && rawName.toLowerCase() !== "hospital" ? rawName : `${rawName} Care Center`;

          const localHosp = await Hospital.create({
            name: cleanName,
            address: rawAddr,
            lat: parseFloat(topResult.lat),
            lng: parseFloat(topResult.lon),
            erBedsAvailable: 5,
            phone: "+91 40 108108"
          });
          nearestHospital = localHosp;
          minHospDuration = 5;
        }
      } catch (e) {
        // Fall back gracefully to closest catalog hospital
      }
    }

    if (!nearestHospital && hospitals.length > 0) {
      nearestHospital = hospitals[0];
    }

    if (!nearestHospital) {
      return req.http.notFound("No emergency hospital beds currently available. Please call 108/911 directly.");
    }

    // Create Emergency directly in UBER response mode
    const emergency = await Emergency.create({
      patientId: req.user._id,
      responseMode: "uber",
      assignedHospitalId: nearestHospital._id,
      hospitalEtaMinutes: minHospDuration !== Infinity ? minHospDuration : 15,
      hospitalRouteGeoJSON: bestHospRoute,
      location: { lat, lng },
      emergencyType,
      status: "active",
      locationHistory: [{ lat, lng, timestamp: new Date() }]
    });

    // Reserve 1 ER bed at destination hospital
    await Hospital.findByIdAndUpdate(nearestHospital._id, { $inc: { erBedsAvailable: -1 } });

    const populatedEmergency = await Emergency.findById(emergency._id)
      .populate("patientId", "name phone medicalId")
      .populate("assignedHospitalId");

    return req.http.created({
      emergency: populatedEmergency,
      message: "Emergency Uber mode triggered. Direct hospital dispatch active."
    });
  } catch (err) {
    next(err);
  }
};

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
                // ==========================================
        // KUKATPALLY / KPHB / HITEC CITY / MADHAPUR
        // ==========================================
        { name: "Prathima Hospitals", address: "Phase 6, KPHB Colony, Kukatpally, Hyderabad", lat: 17.4980, lng: 78.3920, specialties: ["Emergency", "Trauma", "Cardiac"], erBedsAvailable: 9, icuBedsAvailable: 4, phone: "+91 40 43454345" },
        { name: "Remedy Hospitals", address: "Road No 1, KPHB Colony, Kukatpally, Hyderabad", lat: 17.4935, lng: 78.3990, specialties: ["Emergency", "Critical Care", "Cardiac"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 40 40227777" },
        { name: "Anupama Hospital", address: "Road No 2, KPHB Colony, Kukatpally, Hyderabad", lat: 17.4910, lng: 78.4010, specialties: ["Emergency", "Trauma"], erBedsAvailable: 6, icuBedsAvailable: 2, phone: "+91 40 23154567" },
        { name: "Medicover Hospitals", address: "HUDA Techno Enclave, HITEC City, Madhapur, Hyderabad", lat: 17.4475, lng: 78.3780, specialties: ["Trauma", "Cardiac", "Critical Care"], erBedsAvailable: 10, icuBedsAvailable: 5, phone: "+91 40 68334455" },
        { name: "Apollo Cradle & Children's Hospital", address: "Kothaguda Junction, Kondapur, Hyderabad", lat: 17.4640, lng: 78.3650, specialties: ["Emergency", "Pediatric", "General"], erBedsAvailable: 8, icuBedsAvailable: 3, phone: "+91 40 44242424" },

        // ==========================================
        // HYDERABAD & TELANGANA
        // ==========================================
        { name: "Omni Hospitals", address: "Chaitanyapuri, Kothapet, Hyderabad", lat: 17.3664, lng: 78.5363, specialties: ["Cardiac", "Trauma", "ER"], erBedsAvailable: 6, icuBedsAvailable: 3, phone: "+91 40 44556677" },
        { name: "Yashoda Hospitals", address: "Nalgonda X Roads, Malakpet, Hyderabad", lat: 17.3753, lng: 78.5024, specialties: ["Cardiac", "Neuro", "Trauma"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 40 45674567" },
        { name: "Kamineni Hospitals", address: "LB Nagar, Hyderabad", lat: 17.3606, lng: 78.5524, specialties: ["Emergency", "Trauma", "Surgery"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 40 39879999" },
        { name: "Anurag Care Hospital", address: "Ghatkesar Main Rd, Hyderabad", lat: 17.4450, lng: 78.6850, specialties: ["Emergency", "Cardiac"], erBedsAvailable: 5, icuBedsAvailable: 2, phone: "+91 40 1234567" },
        { name: "AIIMS Hospital", address: "Warangal Highway, Bibinagar, Telangana", lat: 17.4721, lng: 78.7993, specialties: ["Multi-Specialty", "Emergency", "Trauma"], erBedsAvailable: 10, icuBedsAvailable: 5, phone: "+91 86 32345678" },
        { name: "Apollo Hospitals", address: "Road No 72, Jubilee Hills, Hyderabad", lat: 17.4165, lng: 78.4116, specialties: ["Cardiac", "Organ Transplant", "ER"], erBedsAvailable: 9, icuBedsAvailable: 4, phone: "+91 40 23607777" },
        { name: "Care Hospitals", address: "Road No 1, Banjara Hills, Hyderabad", lat: 17.4184, lng: 78.4485, specialties: ["Cardiac", "Critical Care", "ER"], erBedsAvailable: 6, icuBedsAvailable: 3, phone: "+91 40 61656565" },
        { name: "KIMS Hospitals", address: "Minister Rd, Secunderabad", lat: 17.4414, lng: 78.4870, specialties: ["Trauma", "Neuro", "Cardiac"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 40 44885000" },
        { name: "AIG Hospitals", address: "Mindspace Rd, Gachibowli, Hyderabad", lat: 17.4435, lng: 78.3663, specialties: ["Gastro", "Emergency", "Critical Care"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 40 42444222" },
        { name: "Continental Hospitals", address: "Financial District, Nanakramguda, Gachibowli", lat: 17.4208, lng: 78.3496, specialties: ["Emergency", "Trauma", "Cardiac"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 40 67000000" },

        // ==========================================
        // BENGALURU & KARNATAKA
        // ==========================================
        { name: "Manipal Hospital", address: "98 HAL Old Airport Rd, Kodihalli, Bengaluru", lat: 12.9592, lng: 77.6499, specialties: ["Cardiac", "Trauma", "ER"], erBedsAvailable: 10, icuBedsAvailable: 5, phone: "+91 80 25024444" },
        { name: "Apollo Hospitals", address: "Bannerghatta Rd, Opp IIMB, Bengaluru", lat: 12.8943, lng: 77.5991, specialties: ["Cardiac", "Emergency", "Neuro"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 80 26304050" },
        { name: "Narayana Health City", address: "258/A, Bommasandra Industrial Area, Anekal Taluk, Bengaluru", lat: 12.8123, lng: 77.6917, specialties: ["Cardiac", "Emergency", "Trauma"], erBedsAvailable: 12, icuBedsAvailable: 6, phone: "+91 80 71222222" },
        { name: "Fortis Hospital", address: "14 Cunningham Rd, Vasanth Nagar, Bengaluru", lat: 12.9880, lng: 77.5950, specialties: ["Emergency", "Critical Care"], erBedsAvailable: 6, icuBedsAvailable: 3, phone: "+91 80 41994444" },

        // ==========================================
        // DELHI NCR & GURUGRAM
        // ==========================================
        { name: "AIIMS New Delhi", address: "Sri Aurobindo Marg, Ansari Nagar, New Delhi", lat: 28.5672, lng: 77.2100, specialties: ["Apex Trauma", "Emergency", "Cardiac"], erBedsAvailable: 15, icuBedsAvailable: 8, phone: "+91 11 26588500" },
        { name: "Max Super Speciality Hospital", address: "1, 2 Press Enclave Rd, Saket, New Delhi", lat: 28.5284, lng: 77.2117, specialties: ["Cardiac", "Trauma", "Neuro"], erBedsAvailable: 9, icuBedsAvailable: 4, phone: "+91 11 26515050" },
        { name: "Medanta - The Medicity", address: "CH Bakhtawar Singh Rd, Sector 38, Gurugram", lat: 28.4395, lng: 77.0425, specialties: ["Critical Care", "Cardiac", "Emergency"], erBedsAvailable: 14, icuBedsAvailable: 7, phone: "+91 124 4141414" },
        { name: "Fortis Memorial Research Institute", address: "Sector 44, Opp HUDA City Centre, Gurugram", lat: 28.4595, lng: 77.0725, specialties: ["Trauma", "Cardiac", "ER"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 124 4962200" },

        // ==========================================
        // MUMBAI & PUNE (MAHARASHTRA)
        // ==========================================
        { name: "Kokilaben Dhirubhai Ambani Hospital", address: "Rao Saheb Achutrao Patwardhan Marg, Andheri West, Mumbai", lat: 19.1311, lng: 72.8252, specialties: ["Emergency", "Trauma", "Cardiac"], erBedsAvailable: 11, icuBedsAvailable: 5, phone: "+91 22 42696969" },
        { name: "Lilavati Hospital & Research Centre", address: "A-791, Bandra Reclamation, Bandra West, Mumbai", lat: 19.0519, lng: 72.8290, specialties: ["Cardiac", "Critical Care", "ER"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 22 26751000" },
        { name: "P.D. Hinduja Hospital", address: "Veer Savarkar Marg, Mahim, Mumbai", lat: 19.0330, lng: 72.8397, specialties: ["Emergency", "Cardiac"], erBedsAvailable: 6, icuBedsAvailable: 3, phone: "+91 22 24451515" },
        { name: "Ruby Hall Clinic", address: "40 Sassoon Rd, Sangamvadi, Pune", lat: 18.5314, lng: 73.8777, specialties: ["Trauma", "Cardiac", "Critical Care"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 20 66455100" },

        // ==========================================
        // CHENNAI & TAMIL NADU
        // ==========================================
        { name: "Apollo Hospitals", address: "21 Greams Lane, Thousand Lights, Chennai", lat: 13.0604, lng: 80.2505, specialties: ["Cardiac", "Emergency", "Trauma"], erBedsAvailable: 10, icuBedsAvailable: 5, phone: "+91 44 28290200" },
        { name: "MIOT International", address: "4/112, Mount Poonamallee Rd, Manapakkam, Chennai", lat: 13.0182, lng: 80.1873, specialties: ["Orthopedic", "Trauma", "ER"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 44 42002288" },
        { name: "Fortis Malar Hospital", address: "No 52, 1st Main Rd, Gandhi Nagar, Adyar, Chennai", lat: 13.0067, lng: 80.2570, specialties: ["Cardiac", "Emergency"], erBedsAvailable: 6, icuBedsAvailable: 3, phone: "+91 44 42892222" },

        // ==========================================
        // KOLKATA & EAST INDIA
        // ==========================================
        { name: "Apollo Multispeciality Hospitals", address: "58 Canal Circular Rd, Kadapara, Phool Bagan, Kolkata", lat: 22.5726, lng: 88.3970, specialties: ["Cardiac", "Emergency", "Critical Care"], erBedsAvailable: 9, icuBedsAvailable: 4, phone: "+91 33 23203040" },
        { name: "Fortis Hospital", address: "730, Anandapur, E.M. Bypass Road, Kolkata", lat: 22.5186, lng: 88.4014, specialties: ["Cardiac", "Trauma", "ER"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 33 66284444" },

        // ==========================================
        // AHMEDABAD & GUJARAT
        // ==========================================
        { name: "Apollo Hospitals", address: "Plot No 1A, Bhat GIDC Estate, Gandhinagar/Ahmedabad", lat: 23.1118, lng: 72.6373, specialties: ["Emergency", "Cardiac", "Trauma"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 79 66701800" },
        { name: "Zydus Hospital", address: "Zydus Hospitals Rd, Thaltej, Ahmedabad", lat: 23.0560, lng: 72.5085, specialties: ["Critical Care", "ER", "Cardiac"], erBedsAvailable: 7, icuBedsAvailable: 3, phone: "+91 79 66190201" },

        // ==========================================
        // JAIPUR & RAJASTHAN
        // ==========================================
        { name: "Fortis Escorts Hospital", address: "Jawaharlal Nehru Marg, Malviya Nagar, Jaipur", lat: 26.8523, lng: 75.8056, specialties: ["Cardiac", "Emergency"], erBedsAvailable: 6, icuBedsAvailable: 3, phone: "+91 141 2547000" },

        // ==========================================
        // LUCKNOW & UTTAR PRADESH
        // ==========================================
        { name: "Medanta Hospital", address: "Sector B, Pocket 1, Amar Shaheed Path, Golf City, Lucknow", lat: 26.7725, lng: 80.9984, specialties: ["Cardiac", "Trauma", "Emergency"], erBedsAvailable: 10, icuBedsAvailable: 5, phone: "+91 522 4505050" },

        // ==========================================
        // KOCHI & KERALA
        // ==========================================
        { name: "Aster Medcity", address: "Kuttisahib Road, Cheranelloor, South Chittoor, Kochi", lat: 10.0538, lng: 76.2673, specialties: ["Critical Care", "Emergency", "Cardiac"], erBedsAvailable: 8, icuBedsAvailable: 4, phone: "+91 484 6699999" }
      ]);

    return res.status(200).json({ 
      success: true, 
      message: "Successfully seeded Pan-India Network of Premier Hospitals and Ambulances!"
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

export const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: "lat and lng are required" });
    }

    const emergency = await Emergency.findByIdAndUpdate(
      id,
      {
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
        $push: { locationHistory: { lat: parseFloat(lat), lng: parseFloat(lng), timestamp: new Date() } }
      },
      { new: true }
    );

    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency not found" });
    }

    return res.status(200).json({ success: true, data: emergency });
  } catch (error) {
    next(error);
  }
};
