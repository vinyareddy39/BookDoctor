import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Prescription from "../models/Prescription.js";
import DoseEvent from "../models/DoseEvent.js";
import SymptomCheckin from "../models/SymptomCheckin.js";
import MedicalId from "../models/MedicalId.js";
import {
  submitSymptomCheckin,
  getSymptomTrends,
  requestRefill,
  getDoctorAdherenceAnalytics,
  checkAndSendRefillReminders,
  getMedicalId,
  updateMedicalId,
  generateShareableMedicalIdToken,
  getPublicMedicalId,
  revokeMedicalIdToken,
} from "../controllers/recoveryEnhancementController.js";

let mongoServer;
let patientUser;
let doctorUser;
let doctorDoc;
let testPrescription;

const mockRes = () => {
  const res = { headers: {}, statusCode: 200 };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

const mockReq = (user, body = {}, params = {}, query = {}) => ({
  user,
  body,
  params,
  query,
  headers: {},
  ip: "127.0.0.1",
  http: {
    ok: (data, msg) => ({ status: "success", data, message: msg }),
    created: (data, msg) => ({ status: "success", data, message: msg, statusCode: 201 }),
    badRequest: (msg) => ({ status: "fail", message: msg, statusCode: 400 }),
    conflict: (msg) => ({ status: "fail", message: msg, statusCode: 409 }),
    forbidden: (msg) => ({ status: "fail", message: msg, statusCode: 403 }),
    notFound: (msg) => ({ status: "fail", message: msg, statusCode: 404 }),
  },
});

describe("Phase 5: Recovery & SOS Enhancements Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    patientUser = await User.create({
      name: "Lakshmi Priya",
      email: "lakshmi@example.com",
      role: "patient",
      password: "Password123!",
      phone: "+919876500001",
    });

    doctorUser = await User.create({
      name: "Dr. Someshwar",
      email: "someshwar@example.com",
      role: "doctor",
      password: "Password123!",
      phone: "+919876500002",
    });

    doctorDoc = await Doctor.create({
      userId: doctorUser._id,
      specialization: "Orthopedics",
      experience: 14,
      consultationFee: 700,
      availableDays: ["Monday", "Tuesday", "Wednesday"],
      timeSlots: ["10:00 AM", "11:00 AM"],
    });

    testPrescription = await Prescription.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      status: "confirmed",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      medications: [
        {
          drug: "Amoxicillin",
          strength: "500 mg",
          dose: "1 capsule",
          frequency: "TID",
          durationDays: 7,
          confirmedByUser: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("1. Normal symptom check-in records cleanly without red flag", async () => {
    const req = mockReq(patientUser, {
      prescriptionId: testPrescription._id,
      painLevel: 3,
      woundCondition: "normal",
      temperature: 98.6,
      temperatureUnit: "F",
      generalFeeling: "better",
      notes: "Recovering smoothly",
    });

    const res = await submitSymptomCheckin(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.isRedFlag).toBe(false);
    expect(res.data.checkin.painLevel).toBe(3);
  });

  it("2. Red-flag rules: pain >= 8 or wound discharge or high fever triggers alert", async () => {
    const req = mockReq(patientUser, {
      prescriptionId: testPrescription._id,
      painLevel: 9,
      woundCondition: "discharge",
      temperature: 102.5,
      temperatureUnit: "F",
      generalFeeling: "worse",
    });

    const res = await submitSymptomCheckin(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.isRedFlag).toBe(true);
    expect(res.data.checkin.redFlagReasons.length).toBeGreaterThanOrEqual(3);
    expect(res.data.warningPrompt).toBeTruthy();
    expect(res.data.warningPrompt.recommendedActions.some(a => a.tel === "108")).toBe(true);
  });

  it("3. Symptom trend endpoint returns chronological data points", async () => {
    const req = mockReq(patientUser, {}, {}, { days: 7 });
    const res = await getSymptomTrends(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
    expect(res.data[0]).toHaveProperty("painLevel");
    expect(res.data[0]).toHaveProperty("date");
  });

  it("4. Refill request creation notifies doctor", async () => {
    const req = mockReq(patientUser, {
      prescriptionId: testPrescription._id,
      drugName: "Amoxicillin",
      notes: "Running out of capsules in 2 days",
    });

    const res = await requestRefill(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.drugName).toBe("Amoxicillin");
    expect(res.data.status).toBe("pending");
  });

  it("5. Doctor adherence analytics aggregates patient scores and flags <60% adherence", async () => {
    // Add dose events for testPrescription: 1 taken, 3 skipped => 25% adherence
    await DoseEvent.create({
      prescriptionId: testPrescription._id,
      patientId: patientUser._id,
      drug: "Amoxicillin",
      dose: "1 capsule",
      scheduledDate: "2026-10-10",
      scheduledTime: "08:00",
      scheduledAt: new Date(),
      status: "taken",
    });
    for (let i = 0; i < 3; i++) {
      await DoseEvent.create({
        prescriptionId: testPrescription._id,
        patientId: patientUser._id,
        drug: "Amoxicillin",
        dose: "1 capsule",
        scheduledDate: `2026-10-${11 + i}`,
        scheduledTime: "08:00",
        scheduledAt: new Date(),
        status: "skipped",
      });
    }

    const req = mockReq(doctorUser, {}, {}, {});
    const res = await getDoctorAdherenceAnalytics(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.patients.length).toBeGreaterThan(0);

    const patientStat = res.data.patients.find(p => String(p.patientId) === String(patientUser._id));
    expect(patientStat).toBeTruthy();
    expect(patientStat.adherenceRate).toBeLessThan(60);
    expect(patientStat.needsFollowUp).toBe(true);
  });

  it("6. Refill reminder cron helper triggers when 2 days remaining", async () => {
    const targetDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const presRunningOut = await Prescription.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      status: "confirmed",
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: targetDate,
      validUntil: targetDate,
      refillReminderSent: false,
      medications: [{ drug: "Metformin", strength: "500mg", confirmedByUser: true }],
    });

    const summary = await checkAndSendRefillReminders();
    expect(summary.remindersSent).toBeGreaterThanOrEqual(1);

    const reloaded = await Prescription.findById(presRunningOut._id);
    expect(reloaded.refillReminderSent).toBe(true);
  });

  it("7. Medical ID: update, token generation, public viewing (no login), and revocation", async () => {
    // Update Medical ID
    const updateReq = mockReq(patientUser, {
      bloodGroup: "O+",
      allergies: ["Penicillin", "Sulfa drugs"],
      chronicConditions: ["Hypertension"],
      emergencyContacts: [{ name: "Anand Priya", relationship: "Spouse", phone: "+919876500099" }],
      organDonor: true,
    });

    const updateRes = await updateMedicalId(updateReq, mockRes(), (e) => { throw e; });
    expect(updateRes.status).toBe("success");
    expect(updateRes.data.bloodGroup).toBe("O+");
    expect(updateRes.data.allergies).toContain("Penicillin");

    // Generate Shareable Token
    const shareReq = mockReq(patientUser);
    const shareRes = await generateShareableMedicalIdToken(shareReq, mockRes(), (e) => { throw e; });
    expect(shareRes.status).toBe("success");
    const { token } = shareRes.data;
    expect(token).toBeTruthy();

    // Public view (unauthenticated guest / paramedic)
    const publicReq = { params: { token }, http: mockReq(null).http };
    const publicRes = await getPublicMedicalId(publicReq, mockRes(), (e) => { throw e; });
    expect(publicRes.status).toBe("success");
    expect(publicRes.data.bloodGroup).toBe("O+");
    expect(publicRes.data.allergies).toContain("Penicillin");

    // Revoke token
    const revokeReq = mockReq(patientUser, {}, { token });
    const revokeRes = await revokeMedicalIdToken(revokeReq, mockRes(), (e) => { throw e; });
    expect(revokeRes.status).toBe("success");
    expect(revokeRes.data.revoked).toBe(true);

    // Subsequent public view returns forbidden/expired
    const publicAfterRevoke = await getPublicMedicalId(publicReq, mockRes(), (e) => { throw e; });
    expect(publicAfterRevoke.statusCode).toBe(403);
  });
});
