import mongoose from "mongoose";
import dotenv from "dotenv";
import Doctor from "../models/Doctor.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Coordinates around Hyderabad
const HYDERABAD_LOCATIONS = [
  { lat: 17.4435, lng: 78.3772 }, // HITEC City
  { lat: 17.4239, lng: 78.4738 }, // Banjara Hills
  { lat: 17.4399, lng: 78.4983 }, // Secunderabad
  { lat: 17.3850, lng: 78.4867 }, // Charminar
  { lat: 17.4504, lng: 78.3808 }  // Madhapur
];

const seedEmergencyData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected for Seeding.");

    const doctors = await Doctor.find().limit(5);

    if (doctors.length === 0) {
      console.log("No doctors found in the database. Please register some doctors first.");
      process.exit(1);
    }

    console.log(`Found ${doctors.length} doctors. Assigning emergency capabilities...`);

    for (let i = 0; i < doctors.length; i++) {
      const doc = doctors[i];
      const loc = HYDERABAD_LOCATIONS[i % HYDERABAD_LOCATIONS.length];
      
      doc.acceptingEmergencies = true;
      doc.erCapacity = Math.floor(Math.random() * 5) + 1; // 1 to 5 beds
      doc.lat = loc.lat;
      doc.lng = loc.lng;
      doc.city = "Hyderabad";
      
      await doc.save();
      console.log(`Updated Doctor ${doc._id} - Capacity: ${doc.erCapacity}, Location: ${doc.lat}, ${doc.lng}`);
    }

    console.log("? Seed completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("? Seeding failed:", err);
    process.exit(1);
  }
};

seedEmergencyData();

