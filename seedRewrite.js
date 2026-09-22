
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

const seedStart = code.indexOf("export const seedGhatkesarData");

const newSeed = `export const seedGhatkesarData = async (req, res, next) => {
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
`;

code = code.substring(0, seedStart) + newSeed;
fs.writeFileSync(file, code);

