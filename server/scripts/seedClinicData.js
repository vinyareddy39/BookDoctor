import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Clinic from "../models/Clinic.js";
import Department from "../models/Department.js";
import Service from "../models/Service.js";
import Appointment from "../models/Appointment.js";
import ClinicalNote from "../models/ClinicalNote.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";
import FollowUp from "../models/FollowUp.js";
import LabOrder from "../models/LabOrder.js";
import LabResult from "../models/LabResult.js";
import Invoice from "../models/Invoice.js";
import Queue from "../models/Queue.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://localhost:27017/bookdoctor";

async function seed() {
  console.log("======================================================");
  console.log("🌱 STARTING MEDASSIST CLINIC DATA SEED SCRIPT");
  console.log("======================================================");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const defaultPassword = await bcrypt.hash("Password@123", 10);

  // ── 1. SEED CLINIC ────────────────────────────────────────────────────────
  console.log("\n🏥 Seeding Clinic Configuration...");
  let clinic = await Clinic.findOne({ code: "MED-HYD-01" });
  if (!clinic) {
    clinic = await Clinic.create({
      name: "MedAssist Central Multi-Specialty Clinic",
      code: "MED-HYD-01",
      email: "contact@medassistclinic.com",
      phone: "+91 98495 12453",
      address: {
        street: "Plot 42, Healthcare Avenue, HITEC City",
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "500081",
        country: "India",
      },
      workingHours: [
        { day: "Monday", openTime: "08:00", closeTime: "20:00", isOpen: true },
        { day: "Tuesday", openTime: "08:00", closeTime: "20:00", isOpen: true },
        { day: "Wednesday", openTime: "08:00", closeTime: "20:00", isOpen: true },
        { day: "Thursday", openTime: "08:00", closeTime: "20:00", isOpen: true },
        { day: "Friday", openTime: "08:00", closeTime: "20:00", isOpen: true },
        { day: "Saturday", openTime: "08:00", closeTime: "18:00", isOpen: true },
        { day: "Sunday", openTime: "09:00", closeTime: "14:00", isOpen: true },
      ],
      billingSettings: {
        currency: "INR",
        taxName: "GST",
        taxRatePercent: 18,
        invoicePrefix: "INV-2026-",
        paymentGateways: {
          razorpay: { enabled: true, keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_demo" },
          cashAtCounter: { enabled: true },
          upiAtCounter: { enabled: true },
        },
      },
    });
    console.log(`   Created Clinic: ${clinic.name} (${clinic.code})`);
  } else {
    console.log(`   Clinic already exists: ${clinic.name}`);
  }

  // ── 2. SEED DEPARTMENTS & SERVICES ───────────────────────────────────────
  console.log("\n🏢 Seeding Departments & Services...");
  const deptData = [
    {
      name: "General Medicine",
      code: "GEN",
      services: [
        { name: "General Physician Consultation", code: "GEN-001", price: 500, durationMinutes: 15 },
        { name: "Executive Health Checkup", code: "GEN-002", price: 2500, durationMinutes: 45 },
      ],
    },
    {
      name: "Cardiology",
      code: "CARD",
      services: [
        { name: "Cardiology Consultation", code: "CARD-001", price: 800, durationMinutes: 20 },
        { name: "12-Lead ECG", code: "CARD-002", price: 600, durationMinutes: 15 },
        { name: "2D Echocardiogram", code: "CARD-003", price: 2200, durationMinutes: 30 },
      ],
    },
    {
      name: "Pediatrics",
      code: "PED",
      services: [
        { name: "Pediatric Consultation", code: "PED-001", price: 600, durationMinutes: 20 },
        { name: "Childhood Immunization / Vaccine", code: "PED-002", price: 1200, durationMinutes: 15 },
      ],
    },
    {
      name: "Diagnostic Pathology & Lab",
      code: "LAB",
      services: [
        { name: "Complete Blood Picture (CBC)", code: "LAB-001", price: 350, durationMinutes: 10 },
        { name: "Fasting Blood Sugar & HbA1c", code: "LAB-002", price: 550, durationMinutes: 10 },
        { name: "Lipid Profile Panel", code: "LAB-003", price: 750, durationMinutes: 10 },
        { name: "Thyroid Profile (T3, T4, TSH)", code: "LAB-004", price: 650, durationMinutes: 10 },
      ],
    },
  ];

  const createdServices = [];
  for (const d of deptData) {
    let dept = await Department.findOne({ code: d.code, clinicId: clinic._id });
    if (!dept) {
      dept = await Department.create({
        clinicId: clinic._id,
        name: d.name,
        code: d.code,
        status: "active",
      });
      console.log(`   Created Department: ${dept.name}`);
    }

    for (const s of d.services) {
      let svc = await Service.findOne({ code: s.code, clinicId: clinic._id });
      if (!svc) {
        svc = await Service.create({
          clinicId: clinic._id,
          departmentId: dept._id,
          name: s.name,
          code: s.code,
          price: s.price,
          durationMinutes: s.durationMinutes,
          taxPercent: 18,
          status: "active",
        });
        console.log(`     Service: ${svc.name} - ₹${svc.price}`);
      }
      createdServices.push(svc);
    }
  }

  // ── 3. SEED CLINIC ADMIN ──────────────────────────────────────────────────
  console.log("\n👤 Seeding Clinic Admin...");
  let admin = await User.findOne({ email: "admin@medassist.com" });
  if (!admin) {
    admin = await User.create({
      name: "Dr. Rajeshwar Rao (Medical Director)",
      email: "admin@medassist.com",
      password: defaultPassword,
      role: "clinic_admin",
      phone: "+91 98495 10001",
      clinicId: clinic._id,
      isEmailVerified: true,
    });
    console.log(`   Created Clinic Admin: ${admin.email}`);
  } else {
    admin.role = "clinic_admin";
    await admin.save();
    console.log(`   Admin updated to clinic_admin: ${admin.email}`);
  }

  // ── 4. SEED RECEPTIONISTS ─────────────────────────────────────────────────
  console.log("\n👩‍💼 Seeding Receptionists...");
  const receptionists = [];
  const recData = [
    { name: "Sunita Reddy", email: "reception1@medassist.com", phone: "+91 98495 20001" },
    { name: "Pooja Varma", email: "reception2@medassist.com", phone: "+91 98495 20002" },
  ];
  for (const r of recData) {
    let rec = await User.findOne({ email: r.email });
    if (!rec) {
      rec = await User.create({
        name: r.name,
        email: r.email,
        password: defaultPassword,
        role: "receptionist",
        phone: r.phone,
        clinicId: clinic._id,
        isEmailVerified: true,
      });
      console.log(`   Created Receptionist: ${rec.name} (${rec.email})`);
    }
    receptionists.push(rec);
  }

  // ── 5. SEED LAB TECHNICIANS ───────────────────────────────────────────────
  console.log("\n🔬 Seeding Lab Technicians...");
  const labTechs = [];
  const techData = [
    { name: "Kiran Kumar (Senior Lab Tech)", email: "labtech1@medassist.com", phone: "+91 98495 30001" },
    { name: "Deepa Menon (Pathology Tech)", email: "labtech2@medassist.com", phone: "+91 98495 30002" },
  ];
  for (const t of techData) {
    let tech = await User.findOne({ email: t.email });
    if (!tech) {
      tech = await User.create({
        name: t.name,
        email: t.email,
        password: defaultPassword,
        role: "lab_technician",
        phone: t.phone,
        clinicId: clinic._id,
        isEmailVerified: true,
      });
      console.log(`   Created Lab Tech: ${tech.name} (${tech.email})`);
    }
    labTechs.push(tech);
  }

  // ── 6. SEED DOCTORS ───────────────────────────────────────────────────────
  console.log("\n🩺 Seeding Doctors & Schedules...");
  const doctors = [];
  const docData = [
    {
      name: "Dr. Ananya Sharma",
      email: "dr.sharma@medassist.com",
      phone: "+91 98495 40001",
      specialization: "Cardiology",
      experience: 12,
      fees: 800,
    },
    {
      name: "Dr. Vikram Patel",
      email: "dr.patel@medassist.com",
      phone: "+91 98495 40002",
      specialization: "General Medicine",
      experience: 15,
      fees: 500,
    },
    {
      name: "Dr. Shalini Singh",
      email: "dr.singh@medassist.com",
      phone: "+91 98495 40003",
      specialization: "Pediatrics",
      experience: 9,
      fees: 600,
    },
  ];

  for (const d of docData) {
    let docUser = await User.findOne({ email: d.email });
    if (!docUser) {
      docUser = await User.create({
        name: d.name,
        email: d.email,
        password: defaultPassword,
        role: "doctor",
        phone: d.phone,
        clinicId: clinic._id,
        isEmailVerified: true,
      });
    }

    let docProfile = await Doctor.findOne({ userId: docUser._id });
    if (!docProfile) {
      docProfile = await Doctor.create({
        userId: docUser._id,
        specialization: d.specialization,
        experience: d.experience,
        fees: d.fees,
        clinicId: clinic._id,
        isAvailable: true,
        consultationType: "both",
        workingHours: { start: "09:00", end: "17:00" },
      });
      console.log(`   Created Doctor: ${d.name} (${d.specialization})`);
    }
    doctors.push({ user: docUser, profile: docProfile });
  }

  // ── 7. SEED 20 PATIENTS WITH AUTO-GENERATED MRNs & DEPENDENTS ─────────────
  console.log("\n👥 Seeding 20 Patients with Dependents...");
  const patientNames = [
    { name: "Aarav Gupta", gender: "Male", age: 34, phone: "9876543201", dep: "Neha Gupta (Spouse)" },
    { name: "Priyanka Nair", gender: "Female", age: 29, phone: "9876543202", dep: "Aditya Nair (Son, Age 4)" },
    { name: "Rohan Verma", gender: "Male", age: 45, phone: "9876543203", dep: "Kavita Verma (Spouse)" },
    { name: "Ananya Iyer", gender: "Female", age: 31, phone: "9876543204", dep: "Siddharth Iyer (Spouse)" },
    { name: "Karthik Raja", gender: "Male", age: 52, phone: "9876543205", dep: "Meenakshi Raja (Spouse)" },
    { name: "Sneha Mukherjee", gender: "Female", age: 26, phone: "9876543206", dep: "Sourav Mukherjee (Brother)" },
    { name: "Arjun Reddy", gender: "Male", age: 38, phone: "9876543207", dep: "Divya Reddy (Spouse)" },
    { name: "Meera Krishnan", gender: "Female", age: 60, phone: "9876543208", dep: "Suresh Krishnan (Spouse)" },
    { name: "Varun Malhotra", gender: "Male", age: 41, phone: "9876543209", dep: "Ritu Malhotra (Spouse)" },
    { name: "Tanvi Joshi", gender: "Female", age: 24, phone: "9876543210", dep: "Mahesh Joshi (Father)" },
    { name: "Suresh Babu", gender: "Male", age: 58, phone: "9876543211", dep: "Lakshmi Babu (Spouse)" },
    { name: "Divya Kapoor", gender: "Female", age: 35, phone: "9876543212", dep: "Reyansh Kapoor (Son, Age 7)" },
    { name: "Nikhil Deshmukh", gender: "Male", age: 33, phone: "9876543213", dep: "Pooja Deshmukh (Spouse)" },
    { name: "Ishaan Rao", gender: "Male", age: 27, phone: "9876543214", dep: "Nalini Rao (Mother)" },
    { name: "Ritu Sengupta", gender: "Female", age: 42, phone: "9876543215", dep: "Amit Sengupta (Spouse)" },
    { name: "Gautam Pillai", gender: "Male", age: 49, phone: "9876543216", dep: "Radhika Pillai (Spouse)" },
    { name: "Kavya Menon", gender: "Female", age: 28, phone: "9876543217", dep: "Vinod Menon (Father)" },
    { name: "Alok Nanda", gender: "Male", age: 63, phone: "9876543218", dep: "Shanti Nanda (Spouse)" },
    { name: "Deepika Chawla", gender: "Female", age: 37, phone: "9876543219", dep: "Manav Chawla (Spouse)" },
    { name: "Harish Saxena", gender: "Male", age: 50, phone: "9876543220", dep: "Anita Saxena (Spouse)" },
  ];

  const patients = [];
  for (let i = 0; i < patientNames.length; i++) {
    const p = patientNames[i];
    const email = `patient${i + 1}@example.com`;
    const mrn = `MED-2026-${String(i + 1).padStart(5, "0")}`;

    let pat = await User.findOne({ email });
    if (!pat) {
      pat = await User.create({
        name: p.name,
        email,
        password: defaultPassword,
        role: "patient",
        phone: p.phone,
        mrn,
        clinicId: clinic._id,
        isEmailVerified: true,
        gender: p.gender,
        age: p.age,
        dependents: [
          {
            name: p.dep.split(" (")[0],
            relationship: p.dep.includes("Spouse") ? "Spouse" : p.dep.includes("Son") ? "Child" : "Parent",
            age: p.age > 40 ? p.age - 2 : p.age + 2,
            gender: p.gender === "Male" ? "Female" : "Male",
          },
        ],
      });
      console.log(`   [${i + 1}/20] Patient: ${pat.name} • MRN: ${pat.mrn} • Email: ${pat.email}`);
    }
    patients.push(pat);
  }

  // ── 8. SEED APPOINTMENTS & QUEUE ──────────────────────────────────────────
  console.log("\n📅 Seeding Appointments & Live Queue Tokens...");
  const today = new Date();
  const sampleAppointments = [];

  for (let i = 0; i < 6; i++) {
    const assignedDoc = doctors[i % doctors.length];
    const assignedPatient = patients[i];
    const apptDate = new Date(today);
    apptDate.setHours(9 + (i * 2), 0, 0, 0);

    const appt = await Appointment.create({
      patientId: assignedPatient._id,
      doctorId: assignedDoc.profile._id,
      clinicId: clinic._id,
      appointmentDate: apptDate,
      appointmentTime: `${9 + (i * 2)}:00 AM`,
      status: i < 2 ? "completed" : i < 4 ? "confirmed" : "pending",
      type: "in-person",
      paymentStatus: i < 3 ? "completed" : "pending",
      consultationFee: assignedDoc.profile.fees,
      notes: "Routine health consultation",
    });
    sampleAppointments.push(appt);

    // Queue Token for today's confirmed/waiting
    if (i < 4) {
      await Queue.create({
        clinicId: clinic._id,
        doctorId: assignedDoc.profile._id,
        patientId: assignedPatient._id,
        appointmentId: appt._id,
        tokenNumber: `T-${String(i + 1).padStart(3, "0")}`,
        queueDate: new Date(),
        status: i === 0 ? "completed" : i === 1 ? "in_consultation" : i === 2 ? "called" : "waiting",
      });
    }
  }
  console.log(`   Created ${sampleAppointments.length} sample appointments and queue tokens.`);

  // ── 9. SEED EMR CLINICAL NOTES, DIAGNOSES & PRESCRIPTIONS ─────────────────
  console.log("\n📝 Seeding EMR Clinical Notes, Diagnoses & Versioned Prescriptions...");
  const primaryDoc = doctors[0]; // Dr. Sharma
  const p1 = patients[0]; // Aarav Gupta

  // Diagnosis
  const diag = await Diagnosis.create({
    patientId: p1._id,
    doctorId: primaryDoc.profile._id,
    clinicId: clinic._id,
    code: "I10",
    label: "Essential (primary) hypertension",
    category: "Cardiovascular",
    status: "active",
    diagnosedDate: new Date(),
    notes: "Stage 1 essential hypertension documented. Lifestyle interventions initiated.",
  });

  // Clinical Note (SOAP)
  const clinicalNote = await ClinicalNote.create({
    patientId: p1._id,
    doctorId: primaryDoc.profile._id,
    clinicId: clinic._id,
    version: 1,
    status: "signed",
    chiefComplaint: "Mild headache, occasional dizziness, elevated home BP readings for 1 week.",
    historyOfPresentIllness: "Patient reports stress at work, erratic sleep. Denies chest pain or shortness of breath.",
    examination: "S1/S2 normal, chest clear, no pedal edema.",
    assessment: "Primary hypertension with mild tension headache. Well compensated.",
    plan: "Initiate low dose ACE inhibitor. Low sodium DASH diet. Regular brisk walking 30 mins daily.",
    vitals: {
      bloodPressure: "142/90",
      heartRate: 78,
      temperature: 98.4,
      spO2: 99,
      respiratoryRate: 16,
      weight: 74,
      height: 175,
      bmi: 24.2,
    },
    diagnoses: [{ code: diag.code, label: diag.label, isPrimary: true }],
    signedAt: new Date(),
    signedBy: primaryDoc.user._id,
    aiVisitSummary: "Patient presents with Stage 1 primary hypertension and tension headache. Blood pressure 142/90 mmHg. Commenced on Telmisartan 40mg daily with low-sodium dietary plan and lifestyle counseling. Follow-up in 2 weeks.",
    aiSummaryApproved: true,
    aiSummaryApprovedBy: primaryDoc.user._id,
    aiSummaryApprovedAt: new Date(),
  });

  // Prescription
  const prescription = await Prescription.create({
    patientId: p1._id,
    doctorId: primaryDoc.profile._id,
    clinicId: clinic._id,
    status: "signed",
    medicines: [
      {
        name: "Telmisartan 40mg",
        dosage: "1 tablet",
        frequency: "1-0-0",
        duration: "30 days",
        timing: "morning",
        instructions: "Take once daily in the morning after breakfast.",
      },
      {
        name: "Paracetamol 650mg",
        dosage: "1 tablet",
        frequency: "0-0-1",
        duration: "3 days",
        timing: "as_needed",
        instructions: "Take for headache only if needed (SOS).",
      },
    ],
    generalInstructions: "Reduce salt intake (< 5g/day). Avoid excessive caffeine. Keep daily BP log.",
    signedAt: new Date(),
    signedBy: primaryDoc.user._id,
  });

  // Follow-up
  const followUpDueDate = new Date();
  followUpDueDate.setDate(followUpDueDate.getDate() + 14);
  await FollowUp.create({
    patientId: p1._id,
    doctorId: primaryDoc.profile._id,
    clinicId: clinic._id,
    dueDate: followUpDueDate,
    reason: "BP titration and home monitoring log review",
    plan: "Repeat blood pressure reading; assess medication tolerance.",
    status: "approved",
  });
  console.log(`   Created Note (${clinicalNote._id}), Prescription (${prescription._id}), and Follow-up.`);

  // ── 10. SEED LAB ORDERS & RESULTS ────────────────────────────────────────
  console.log("\n🧪 Seeding Lab Orders & Dual-Verifier Diagnostic Results...");
  const labTech1 = labTechs[0];
  const labTech2 = labTechs[1];

  const labResult = await LabResult.create({
    clinicId: clinic._id,
    patientId: p1._id,
    doctorId: primaryDoc.profile._id,
    parameters: [
      { name: "Hemoglobin", value: "14.2", unit: "g/dL", referenceRange: "13.0 - 17.0", flag: "normal" },
      { name: "Total WBC Count", value: "6800", unit: "cells/mcL", referenceRange: "4000 - 11000", flag: "normal" },
      { name: "Platelet Count", value: "245000", unit: "cells/mcL", referenceRange: "150000 - 450000", flag: "normal" },
      { name: "Fasting Blood Sugar", value: "98", unit: "mg/dL", referenceRange: "70 - 100", flag: "normal" },
      { name: "Serum Total Cholesterol", value: "215", unit: "mg/dL", referenceRange: "< 200", flag: "high" },
    ],
    enteredBy: labTech1._id,
    enteredAt: new Date(),
    verifiedBy: labTech2._id, // Enforce verifier != entry user
    verifiedAt: new Date(),
    status: "verified",
  });

  const labOrder = await LabOrder.create({
    clinicId: clinic._id,
    patientId: p1._id,
    doctorId: primaryDoc.profile._id,
    orderNumber: "LAB-2026-0001",
    tests: [
      { name: "Complete Blood Picture (CBC)", code: "LAB-001", price: 350 },
      { name: "Lipid Profile Panel", code: "LAB-003", price: 750 },
    ],
    priority: "routine",
    status: "released",
    labResultId: labResult._id,
    orderedAt: new Date(),
    collectedAt: new Date(),
    releasedAt: new Date(),
    releasedBy: primaryDoc.user._id,
  });
  console.log(`   Created Lab Order ${labOrder.orderNumber} with dual-verified release.`);

  // ── 11. SEED INVOICES & PAYMENTS ──────────────────────────────────────────
  console.log("\n💳 Seeding Invoices & Counter Payment Entries...");
  const invoice = await Invoice.create({
    clinicId: clinic._id,
    patientId: p1._id,
    invoiceNumber: "INV-2026-00001",
    issueDate: new Date(),
    items: [
      { description: "Cardiology Specialist Consultation", quantity: 1, unitPrice: 800, total: 800 },
      { description: "Complete Blood Picture (CBC)", quantity: 1, unitPrice: 350, total: 350 },
      { description: "Lipid Profile Panel", quantity: 1, unitPrice: 750, total: 750 },
    ],
    subtotal: 1900,
    taxPercent: 18,
    taxAmount: 342,
    discountAmount: 142,
    totalAmount: 2100,
    paidAmount: 2100,
    balanceAmount: 0,
    status: "paid",
    payments: [
      {
        amount: 2100,
        method: "upi",
        reference: "UPI/2026/894729104",
        notes: "Paid at clinic counter via QR scan",
        recordedBy: receptionists[0]._id,
        paidAt: new Date(),
      },
    ],
  });
  console.log(`   Created Paid Invoice: ${invoice.invoiceNumber} (Total: ₹${invoice.totalAmount})`);

  console.log("\n======================================================");
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("======================================================");
  console.log("🔐 Credentials for Instant Testing:");
  console.log("   • Clinic Admin:   admin@medassist.com      / Password@123");
  console.log("   • Doctor 1:       dr.sharma@medassist.com  / Password@123");
  console.log("   • Doctor 2:       dr.patel@medassist.com   / Password@123");
  console.log("   • Doctor 3:       dr.singh@medassist.com   / Password@123");
  console.log("   • Receptionist 1: reception1@medassist.com / Password@123");
  console.log("   • Receptionist 2: reception2@medassist.com / Password@123");
  console.log("   • Lab Tech 1:     labtech1@medassist.com   / Password@123");
  console.log("   • Lab Tech 2:     labtech2@medassist.com   / Password@123");
  console.log("   • Patient 1:      patient1@example.com     / Password@123 (MRN: MED-2026-00001)");
  console.log("   • Patient 2-20:   patient2@example.com ... / Password@123");
  console.log("======================================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
