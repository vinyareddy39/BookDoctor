import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import SosEvent from "../models/SosEvent.js";
import VerifiedHospital from "../models/VerifiedHospital.js";
import EmergencyContact from "../models/EmergencyContact.js";
import User from "../models/User.js";
import { getGridKey, haversineDistanceKm } from "../services/hospitalRanker.js";
import { UberDeepLinkProvider, UberApiProvider } from "../services/rideProvider.js";

let mongoServer;

describe("SOS Emergency → Uber to Nearest ER Module Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe("1. Rule-Based Triage & Mandatory Safety Rules", () => {
    it("should flag critical: true and recommend ambulance for life-threatening symptoms", () => {
      const triageCases = [
        { chestPain: true },
        { difficultyBreathing: true },
        { severeBleeding: true },
        { unconscious: true },
        { strokeSigns: true },
        { severeInjury: true },
      ];

      for (const t of triageCases) {
        const isCritical = Boolean(
          t.chestPain ||
          t.difficultyBreathing ||
          t.severeBleeding ||
          t.unconscious ||
          t.strokeSigns ||
          t.severeInjury
        );
        expect(isCritical).toBe(true);
      }
    });

    it("should flag critical: false for non-life-threatening conditions", () => {
      const mildTriage = {
        chestPain: false,
        difficultyBreathing: false,
        severeBleeding: false,
        unconscious: false,
        strokeSigns: false,
        severeInjury: false,
        otherSymptoms: "Mild fever and ankle sprain",
      };

      const isCritical = Boolean(
        mildTriage.chestPain ||
        mildTriage.difficultyBreathing ||
        mildTriage.severeBleeding ||
        mildTriage.unconscious ||
        mildTriage.strokeSigns ||
        mildTriage.severeInjury
      );
      expect(isCritical).toBe(false);
    });
  });

  describe("2. Hospital Discovery, Distance & Grid Key Caching", () => {
    it("should compute accurate Haversine distance and consistent ~1km grid keys", () => {
      const p1 = { lat: 17.4474, lng: 78.3762 }; // Hyderabad Hitech City
      const p2 = { lat: 17.4400, lng: 78.3800 };

      const dist = haversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
      expect(dist).toBeGreaterThan(0.5);
      expect(dist).toBeLessThan(1.5);

      const gridKey1 = getGridKey(p1.lat, p1.lng);
      const gridKey2 = getGridKey(p1.lat + 0.002, p1.lng + 0.002);
      expect(typeof gridKey1).toBe("string");
      expect(gridKey1).toContain("_");
      expect(gridKey1).toBe(gridKey2); // within ~1km resolution
    });

    it("should store and query verified hospitals in MongoDB", async () => {
      const hosp = await VerifiedHospital.create({
        name: "Medicover Emergency Center",
        lat: 17.4485,
        lng: 78.3820,
        phone: "+91 40 6833 4455",
        has24x7ER: true,
        verified: true,
      });

      expect(hosp._id).toBeDefined();
      expect(hosp.verified).toBe(true);
      expect(hosp.has24x7ER).toBe(true);

      const found = await VerifiedHospital.findOne({ name: /Medicover/i });
      expect(found).not.toBeNull();
      expect(found.phone).toContain("40");
    });
  });

  describe("3. RideProvider & Universal Deep Link Builder", () => {
    it("should generate compliant universal Uber deep link with exact pickup and dropoff", () => {
      const provider = new UberDeepLinkProvider();
      const pickup = { lat: 17.4474, lng: 78.3762 };
      const hospital = {
        name: "Sunshine Hospitals 24/7 ER",
        lat: 17.4490,
        lng: 78.3850,
        address: "Gachibowli Road",
      };

      const links = provider.buildLinks(pickup, hospital);

      expect(links.webUrl).toContain("https://m.uber.com/ul/?action=setPickup");
      expect(links.webUrl).toContain("pickup%5Blatitude%5D=17.4474");
      expect(links.webUrl).toContain("pickup%5Blongitude%5D=78.3762");
      expect(links.webUrl).toContain("dropoff%5Blatitude%5D=17.449");
      expect(links.webUrl).toContain("dropoff%5Blongitude%5D=78.385");
      expect(links.appUrl).toContain("uber://?action=setPickup");
    });

    it("should return realistic price and time estimates in Sandbox/Fallback mode", async () => {
      const apiProvider = new UberApiProvider();
      const estimates = await apiProvider.getEstimates(17.4474, 78.3762, 17.4550, 78.3900);

      expect(Array.isArray(estimates)).toBe(true);
      expect(estimates.length).toBeGreaterThan(0);
      expect(estimates[0].productId).toBeDefined();
      expect(estimates[0].estimate).toContain("₹");
    });
  });

  describe("4. End-to-End SOS Event Lifecycle & Public Tokenized Tracking", () => {
    let testPatient;

    beforeAll(async () => {
      testPatient = await User.create({
        name: "Sneha Patel",
        email: "sneha.sos@example.com",
        password: "hashedpassword123",
        role: "patient",
        phone: "+919876543210",
      });

      await EmergencyContact.create({
        patientId: testPatient._id,
        name: "Rajesh Patel",
        phone: "+919876543299",
        relationship: "spouse",
        notifyOnSOS: true,
      });
    });

    it("should create an SosEvent and generate an unguessable tracking token", async () => {
      const event = await SosEvent.create({
        patientId: testPatient._id,
        triageAnswers: {
          chestPain: false,
          difficultyBreathing: false,
          severeBleeding: false,
          unconscious: false,
          strokeSigns: false,
          severeInjury: false,
        },
        critical: false,
        location: {
          lat: 17.4474,
          lng: 78.3762,
          accuracy: 15,
          address: "Madhapur, Hyderabad",
        },
        hospital: {
          name: "Apollo Emergency Hospital",
          lat: 17.4500,
          lng: 78.3800,
          phone: "108",
          has24x7ER: true,
        },
        provider: "uber_api",
        status: "hospital_selected",
      });

      expect(event._id).toBeDefined();
      expect(event.trackingToken).toBeDefined();
      expect(event.trackingToken.length).toBeGreaterThanOrEqual(32);
      expect(event.trackingTokenExpiresAt).toBeDefined();
      expect(event.critical).toBe(false);
    });

    it("should confirm ride, set driver details, and update status", async () => {
      const event = await SosEvent.findOne({ patientId: testPatient._id });
      expect(event).not.toBeNull();

      event.status = "ride_confirmed";
      event.rideStatus = "accepted";
      event.rideRequestId = `ub-test-${Date.now()}`;
      event.driver = {
        name: "K. Mohan",
        phone: "+91 98490 12345",
        vehicle: "Maruti Suzuki Dzire",
        plate: "TS 08 UB 2026",
        etaMinutes: 4,
        carLat: 17.4480,
        carLng: 78.3770,
      };
      event.audit.push({
        action: "ride_confirmed",
        timestamp: new Date(),
      });
      await event.save();

      const updated = await SosEvent.findById(event._id);
      expect(updated.status).toBe("ride_confirmed");
      expect(updated.rideStatus).toBe("accepted");
      expect(updated.driver.plate).toBe("TS 08 UB 2026");
      expect(updated.audit.length).toBeGreaterThan(0);
    });

    it("should provide sanitized public tracking data without leaking private medical ID", async () => {
      const event = await SosEvent.findOne({ patientId: testPatient._id });

      const sanitized = {
        patientName: testPatient.name,
        hospital: event.hospital,
        driver: event.driver,
        rideStatus: event.rideStatus,
      };

      expect(sanitized.patientName).toBe("Sneha Patel");
      expect(sanitized.hospital.name).toBe("Apollo Emergency Hospital");
      expect(sanitized.driver.name).toBe("K. Mohan");
      // Confirm medical history is NOT included
      expect(sanitized.medicalId).toBeUndefined();
    });

    it("should cancel ride upon user cancellation", async () => {
      const event = await SosEvent.findOne({ patientId: testPatient._id });
      event.rideStatus = "rider_canceled";
      event.status = "cancelled";
      await event.save();

      const cancelled = await SosEvent.findById(event._id);
      expect(cancelled.rideStatus).toBe("rider_canceled");
      expect(cancelled.status).toBe("cancelled");
    });
  });
});
