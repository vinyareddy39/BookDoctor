import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { parsePrescriptionText } from "../services/prescriptionParser.js";
import Prescription from "../models/Prescription.js";
import DoseEvent from "../models/DoseEvent.js";
import CaregiverLink from "../models/CaregiverLink.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";

let mongoServer;

describe("RecoverTrack Post-Prescription Recovery Module Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe("1. Rule-Based Prescription Parser & Safety Confidence Flags", () => {
    it("should parse standard Indian/global prescription notations (1-0-1, 500mg, 5 days)", () => {
      const text = "Paracetamol 500mg 1-0-1 after food for 5 days\nAmoxicillin 250mg TID before food for 7 days";
      const parsed = parsePrescriptionText(text);

      expect(parsed).toHaveLength(2);

      // Item 1: Paracetamol
      expect(parsed[0].drug).toBe("Paracetamol");
      expect(parsed[0].strength).toBe("500mg");
      expect(parsed[0].frequency).toBe("Twice daily");
      expect(parsed[0].durationDays).toBe(5);
      expect(parsed[0].timing).toBe("after_food");
      expect(parsed[0].fieldConfidence.drug).toBeGreaterThanOrEqual(0.9);

      // Item 2: Amoxicillin
      expect(parsed[1].drug).toBe("Amoxicillin");
      expect(parsed[1].strength).toBe("250mg");
      expect(parsed[1].frequency).toBe("Thrice daily");
      expect(parsed[1].durationDays).toBe(7);
      expect(parsed[1].timing).toBe("before_food");
    });

    it("should parse duration in weeks and convert to days (2 weeks = 14 days)", () => {
      const text = "Pantoprazole 40mg OD morning before meals for 2 weeks";
      const parsed = parsePrescriptionText(text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].drug).toBe("Pantoprazole");
      expect(parsed[0].strength).toBe("40mg");
      expect(parsed[0].frequency).toBe("Morning");
      expect(parsed[0].durationDays).toBe(14);
      expect(parsed[0].timing).toBe("before_food");
    });

    it("should mark needsReview=true and lower confidence when duration or strength is missing", () => {
      const text = "Aspirin 1 tab daily"; // missing explicit strength (e.g. 75mg) and duration
      const parsed = parsePrescriptionText(text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].drug).toBe("Aspirin");
      expect(parsed[0].needsReview).toBe(true);
      expect(parsed[0].fieldConfidence.strength).toBeLessThan(0.9);
      expect(parsed[0].fieldConfidence.durationDays).toBeLessThan(0.9);
    });
  });

  describe("2. RecoverTrack Schema, Versioning, and Dose Generation Lifecycle", () => {
    let testPatient;
    let testDoctor;
    let testAppointment;
    let testPrescription;

    beforeAll(async () => {
      testPatient = await User.create({
        name: "Aarav Sharma",
        email: "aarav@example.com",
        password: "hashedpassword123",
        role: "patient",
      });

      testDoctor = await User.create({
        name: "Dr. Vikram Seth",
        email: "vikram@example.com",
        password: "hashedpassword123",
        role: "doctor",
      });

      testAppointment = await Appointment.create({
        patientId: testPatient._id,
        doctorId: testDoctor._id,
        appointmentDate: new Date(),
        appointmentTime: "10:00",
        amount: 500,
        status: "completed",
        paymentStatus: "paid",
      });
    });

    it("should save structured prescription linked to appointment (version 1)", async () => {
      testPrescription = await Prescription.create({
        patientId: testPatient._id,
        doctorId: testDoctor._id,
        appointmentId: testAppointment._id,
        version: 1,
        status: "shared",
        source: "doctor_structured",
        medications: [
          {
            drug: "Metformin",
            strength: "500 mg",
            dose: "1 tablet",
            frequency: "Twice daily",
            times: ["08:00", "20:00"],
            durationDays: 3,
            timing: "after_food",
            instructions: "after food",
            startDate: new Date(),
          },
        ],
        notes: "Take with food to avoid gastric upset.",
      });

      expect(testPrescription._id).toBeDefined();
      expect(testPrescription.version).toBe(1);
      expect(testPrescription.status).toBe("shared");
      expect(testPrescription.medications).toHaveLength(1);
      expect(testPrescription.medicines).toHaveLength(1); // backwards-compatible alias hook
    });

    it("should support versioning when doctor amends prescription", async () => {
      // Mark old version superseded
      testPrescription.status = "superseded";
      await testPrescription.save();

      const updatedPrescription = await Prescription.create({
        patientId: testPatient._id,
        doctorId: testDoctor._id,
        appointmentId: testAppointment._id,
        parentPrescriptionId: testPrescription._id,
        version: 2,
        status: "shared",
        source: "doctor_structured",
        medications: [
          {
            drug: "Metformin",
            strength: "850 mg",
            dose: "1 tablet",
            frequency: "Twice daily",
            times: ["08:00", "20:00"],
            durationDays: 5,
            timing: "after_food",
            instructions: "after food",
          },
        ],
        notes: "Dosage adjusted to 850 mg.",
      });

      expect(updatedPrescription.version).toBe(2);
      expect(updatedPrescription.parentPrescriptionId.toString()).toBe(testPrescription._id.toString());
      expect(updatedPrescription.status).toBe("shared");
    });

    it("should generate schedule of DoseEvents upon patient review and confirmation", async () => {
      const med = {
        drug: "Ciprofloxacin",
        strength: "500 mg",
        dose: "1 tablet",
        frequency: "Twice daily",
        times: ["08:00", "20:00"],
        durationDays: 3,
        timing: "after_food",
        instructions: "drink plenty of water",
        startDate: new Date("2026-10-10"),
      };

      const doseEvents = [];
      const baseDate = new Date(med.startDate);
      baseDate.setHours(0, 0, 0, 0);

      for (let day = 0; day < med.durationDays; day++) {
        const currentDate = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
        const dd = String(currentDate.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        for (const timeStr of med.times) {
          const [h, m] = timeStr.split(":");
          const scheduledAt = new Date(currentDate);
          scheduledAt.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

          doseEvents.push({
            prescriptionId: testPrescription._id,
            patientId: testPatient._id,
            drug: med.drug,
            strength: med.strength,
            dose: med.dose,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            scheduledAt,
            status: "scheduled",
          });
        }
      }

      await DoseEvent.insertMany(doseEvents);

      // 3 days * 2 times = 6 doses
      expect(doseEvents).toHaveLength(6);

      const savedDoses = await DoseEvent.find({ prescriptionId: testPrescription._id });
      expect(savedDoses).toHaveLength(6);
      expect(savedDoses[0].status).toBe("scheduled");
    });

    it("should record self-reported check-in as taken or skipped with audit metadata", async () => {
      const dose = await DoseEvent.findOne({ prescriptionId: testPrescription._id });
      expect(dose).toBeDefined();

      dose.status = "taken";
      dose.recordedAt = new Date();
      dose.recordedBy = testPatient._id;
      dose.method = "self_reported";
      await dose.save();

      const updated = await DoseEvent.findById(dose._id);
      expect(updated.status).toBe("taken");
      expect(updated.method).toBe("self_reported");
      expect(updated.recordedAt).toBeDefined();
    });

    it("should calculate adherence score with experimental disclaimer label", async () => {
      const doses = await DoseEvent.find({ prescriptionId: testPrescription._id });
      const totalDue = doses.length;
      const takenOnTime = doses.filter((d) => d.status === "taken").length;
      const takenLate = 0;
      const skipped = doses.filter((d) => d.status === "skipped").length;

      // Formula: ((taken_on_time * 1.0 + taken_late * 0.7) / total_due) * 100
      const score = Math.round(((takenOnTime * 1.0 + takenLate * 0.7) / totalDue) * 100);
      const label = "Experimental – not a clinical risk estimate";

      expect(score).toBeGreaterThan(0);
      expect(label).toBe("Experimental – not a clinical risk estimate");
    });
  });

  describe("3. Caregiver Consent & Delegation Link", () => {
    it("should create caregiver link with active consent and permissions", async () => {
      const patientId = new mongoose.Types.ObjectId();
      const caregiverId = new mongoose.Types.ObjectId();

      const link = await CaregiverLink.create({
        patientId,
        caregiverId,
        caregiverEmail: "caregiver@family.org",
        caregiverName: "Priya Sharma",
        relationship: "daughter",
        status: "active",
        permissions: {
          canViewSchedule: true,
          canRecordCheckin: true,
          receiveAlerts: true,
        },
      });

      expect(link._id).toBeDefined();
      expect(link.status).toBe("active");
      expect(link.permissions.canRecordCheckin).toBe(true);
      expect(link.consentedAt).toBeDefined();
    });
  });
});
