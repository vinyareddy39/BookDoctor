import { Hospital } from "../types";

export const MOCK_HOSPITALS: Hospital[] = [
  {
    id: "hosp-1",
    name: "City General Hospital",
    lat: 17.443, // Adjust to desired city lat/lng
    lng: 78.375,
    specialties: ["general", "cardiology", "trauma"],
    erBedsAvailable: 5,
    icuBedsAvailable: 2,
  },
  {
    id: "hosp-2",
    name: "Sunrise Medical Center",
    lat: 17.450,
    lng: 78.380,
    specialties: ["general", "pediatrics"],
    erBedsAvailable: 2,
    icuBedsAvailable: 0,
  },
  {
    id: "hosp-3",
    name: "Apollo ER Speciality",
    lat: 17.435,
    lng: 78.365,
    specialties: ["trauma", "orthopedics", "neurology", "general"],
    erBedsAvailable: 8,
    icuBedsAvailable: 5,
  }
];

