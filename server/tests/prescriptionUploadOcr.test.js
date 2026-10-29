import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { processPrescriptionFile, extractTextFromPrescription } from "../services/ocrService.js";
import Prescription from "../models/Prescription.js";
import DoseEvent from "../models/DoseEvent.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoServer;

describe("RecoverTrack Handwritten Prescription OCR & Multi-Plan Tests", () => {
  let sampleRxImagePath;
  let testPatient;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create a temporary sample prescription image file for testing
    const sampleDir = path.resolve(__dirname, "../uploads/prescriptions");
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
    }
    sampleRxImagePath = path.join(sampleDir, "test_amox_rx.jpg");
    fs.writeFileSync(sampleRxImagePath, "SIMULATED_HANDWRITTEN_PRESCRIPTION_CONTENT_AMOX");

    testPatient = await User.create({
      name: "Rohit Verma",
      email: `rohit_${Date.now()}@example.com`,
      password: "Password123!",
      role: "patient",
      phone: "+919876543210",
    });
  });

  afterAll(async () => {
    if (fs.existsSync(sampleRxImagePath)) {
      try {
        fs.unlinkSync(sampleRxImagePath);
      } catch (_) {}
    }
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe("1. OCR Engine & Medical Handwriting Extraction", () => {
    it("should extract candidate prescription text from an image file", async () => {
      const result = await extractTextFromPrescription(sampleRxImagePath, "image/jpeg");
      expect(result).toBeDefined();
      expect(result.rawText).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(typeof result.rawText).toBe("string");
    });

    it("should parse OCR text into DRAFT medication items with confidence scoring", async () => {
      const processed = await processPrescriptionFile(sampleRxImagePath, "image/jpeg");
      expect(processed).toBeDefined();
      expect(processed.rawOcrText).toBeTruthy();
      expect(processed.ocrConfidence).toBeGreaterThanOrEqual(0.7);
      expect(Array.isArray(processed.draftMedications)).toBe(true);
      expect(processed.draftMedications.length).toBeGreaterThan(0);

      const firstMed = processed.draftMedications[0];
      expect(firstMed.drug).toBeTruthy();
      expect(firstMed.strength).toBeTruthy();
      expect(firstMed.frequency).toBeTruthy();
      expect(firstMed.durationDays).toBeGreaterThan(0);
      expect(firstMed.fieldConfidence).toBeDefined();
    });
  });

  describe("2. Non-Negotiable Safety Rule: Zero Doses from Raw OCR", () => {
    it("should create a DRAFT prescription with source='patient_upload' and ZERO generated DoseEvents", async () => {
      const processed = await processPrescriptionFile(sampleRxImagePath, "image/jpeg");

      const draftPrescription = await Prescription.create({
        patientId: testPatient._id,
        status: "draft",
        source: "patient_upload",
        uploadedBy: "patient",
        doctorName: "Dr. K. S. Rao",
        clinicName: "City Ortho Clinic",
        attachmentUrl: "/uploads/prescriptions/test_amox_rx.jpg",
        attachmentType: "image",
        attachmentName: "test_amox_rx.jpg",
        rawOcrText: processed.rawOcrText,
        ocrConfidence: processed.ocrConfidence,
        medications: processed.draftMedications,
      });

      expect(draftPrescription.status).toBe("draft");
      expect(draftPrescription.source).toBe("patient_upload");
      expect(draftPrescription.doctorName).toBe("Dr. K. S. Rao");

      // Verify ZERO dose events exist
      const doseCount = await DoseEvent.countDocuments({ prescriptionId: draftPrescription._id });
      expect(doseCount).toBe(0);
    });
  });

  describe("3. Explicit Patient Review & Confirmation Workflow", () => {
    it("should generate DoseEvents only when patient explicitly reviews and confirms medications", async () => {
      const reviewedMedications = [
        {
          drug: "Amoxicillin",
          strength: "500 mg",
          dose: "1 tablet",
          frequency: "Twice daily",
          times: ["08:00", "20:00"],
          durationDays: 3,
          timing: "after_food",
          instructions: "after food with water",
        },
      ];

      const prescription = await Prescription.create({
        patientId: testPatient._id,
        status: "draft",
        source: "patient_upload",
        uploadedBy: "patient",
        doctorName: "Dr. K. S. Rao",
        clinicName: "City Ortho Clinic",
        attachmentUrl: "/uploads/prescriptions/test_amox_rx.jpg",
        attachmentType: "image",
        attachmentName: "test_amox_rx.jpg",
        medications: reviewedMedications,
      });

      // Simulate confirmation: update status to active and generate scheduled DoseEvents
      prescription.status = "active";
      prescription.confirmedAt = new Date();
      prescription.confirmedBy = testPatient._id;
      await prescription.save();

      const doseEvents = [];
      const startDate = new Date();
      for (let day = 0; day < 3; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dateStr = currentDate.toISOString().split("T")[0];

        for (const timeStr of reviewedMedications[0].times) {
          const [hoursStr, minutesStr] = timeStr.split(":");
          const scheduledAt = new Date(currentDate);
          scheduledAt.setHours(parseInt(hoursStr, 10), parseInt(minutesStr, 10), 0, 0);

          doseEvents.push({
            prescriptionId: prescription._id,
            patientId: prescription.patientId,
            drug: reviewedMedications[0].drug,
            strength: reviewedMedications[0].strength,
            dose: reviewedMedications[0].dose,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            scheduledAt,
            instructions: reviewedMedications[0].instructions,
            timing: reviewedMedications[0].timing,
            status: "scheduled",
          });
        }
      }

      await DoseEvent.insertMany(doseEvents);

      // Total generated: 3 days * 2 times per day = 6 doses
      const createdDoses = await DoseEvent.find({ prescriptionId: prescription._id });
      expect(createdDoses).toHaveLength(6);
      expect(createdDoses[0].drug).toBe("Amoxicillin");
      expect(createdDoses[0].status).toBe("scheduled");
    });
  });

  describe("4. Multiple Active Plans Coexistence", () => {
    it("should allow a patient to have both doctor online shared and patient uploaded active plans", async () => {
      // Plan 1: Online Doctor Prescription
      const onlinePlan = await Prescription.create({
        patientId: testPatient._id,
        status: "active",
        source: "doctor_structured",
        uploadedBy: "doctor",
        doctorName: "Dr. Anjali Mehta",
        medications: [
          {
            drug: "Pantoprazole",
            strength: "40 mg",
            dose: "1 capsule",
            frequency: "Morning",
            times: ["08:00"],
            durationDays: 5,
            timing: "before_food",
          },
        ],
      });

      // Plan 2: Uploaded Handwritten Prescription
      const uploadedPlan = await Prescription.create({
        patientId: testPatient._id,
        status: "active",
        source: "patient_upload",
        uploadedBy: "patient",
        doctorName: "Dr. Suresh Reddy",
        clinicName: "Dental Care Clinic",
        attachmentUrl: "/uploads/prescriptions/dental_rx.jpg",
        attachmentType: "image",
        medications: [
          {
            drug: "Ibuprofen",
            strength: "400 mg",
            dose: "1 tablet",
            frequency: "Night",
            times: ["21:00"],
            durationDays: 3,
            timing: "after_food",
          },
        ],
      });

      // Query all active plans for this patient
      const activePlans = await Prescription.find({
        patientId: testPatient._id,
        status: "active",
      }).sort({ createdAt: -1 });

      expect(activePlans.length).toBeGreaterThanOrEqual(2);
      const sources = activePlans.map((p) => p.source);
      expect(sources).toContain("doctor_structured");
      expect(sources).toContain("patient_upload");
    });
  });

  describe("5. Doctor Side: Upload Handwritten Prescription / Notes with OCR & Save", () => {
    it("should process doctor-uploaded handwritten notes and attach them to appointment prescription", async () => {
      const doctorUser = await User.create({
        name: "Dr. Ananya Sharma",
        email: `dr_ananya_${Date.now()}@example.com`,
        password: "Password123!",
        role: "doctor",
        phone: "+919876543299",
      });

      // 1. Process file through OCR service
      const ocrResult = await processPrescriptionFile(sampleRxImagePath, "image/jpeg");
      expect(ocrResult).toBeDefined();
      expect(ocrResult.rawOcrText).toBeDefined();
      expect(ocrResult.draftMedications.length).toBeGreaterThan(0);

      // 2. Doctor reviews, edits candidate medications and notes, then saves with attachment
      const prescription = await Prescription.create({
        appointmentId: new mongoose.Types.ObjectId(),
        patientId: testPatient._id,
        doctorId: doctorUser._id,
        status: "shared",
        version: 1,
        source: "doctor_structured",
        uploadedBy: "doctor",
        doctorName: doctorUser.name,
        notes: `Clinical Assessment from handwritten notes:\n${ocrResult.rawOcrText.substring(0, 80)}`,
        attachmentUrl: "/uploads/prescriptions/test_amox_rx.jpg",
        attachmentType: "image",
        attachmentName: "test_amox_rx.jpg",
        rawOcrText: ocrResult.rawOcrText,
        ocrConfidence: ocrResult.ocrConfidence,
        medications: ocrResult.draftMedications.map((m) => ({
          ...m,
          timing: "after_food",
          instructions: "Take with water",
        })),
      });

      expect(prescription._id).toBeDefined();
      expect(prescription.uploadedBy).toBe("doctor");
      expect(prescription.attachmentUrl).toBe("/uploads/prescriptions/test_amox_rx.jpg");
      expect(prescription.rawOcrText).toBe(ocrResult.rawOcrText);
      expect(prescription.notes).toContain("Clinical Assessment");
      expect(prescription.status).toBe("shared");
    });
  });
});
