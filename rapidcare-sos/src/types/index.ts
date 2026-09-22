export interface User {
  id: string;
  name: string;
  phone: string;
  medicalId: {
    bloodGroup: string;
    allergies: string;
    conditions: string;
    medications: string;
  };
  contacts: EmergencyContact[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  specialties: string[];
  erBedsAvailable: number;
  icuBedsAvailable: number;
}

export interface Emergency {
  id: string;
  userId: string;
  status: "active" | "resolved";
  emergencyType: string;
  timestamp: number;
  location: { lat: number; lng: number };
  assignedHospitalId: string | null;
  etaMinutes: number | null;
  resolvedAt: number | null;
}

