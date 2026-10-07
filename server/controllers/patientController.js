import User from "../models/User.js";
import crypto from "crypto";
import { recordAudit } from "../middleware/auditLogger.js";

/**
 * POST /api/patients/walk-in
 * Front Desk / Receptionist Walk-in Patient Registration
 * Generates official MRN, registers patient without requiring upfront email verification.
 */
export const registerWalkInPatient = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      dob,
      gender,
      bloodGroup,
      address,
      emergencyContact,
      allergies,
      conditions,
      medications,
      dependents,
    } = req.body;

    if (!name || !phone) {
      return req.http.badRequest("Patient full name and contact phone number are required.");
    }

    // Check if phone or email already registered
    const existing = await User.findOne({
      $or: [
        { phone: phone.trim() },
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
      ],
    });

    if (existing) {
      return req.http.badRequest(
        `A patient account already exists with this ${
          existing.phone === phone.trim() ? "phone number" : "email address"
        }. MRN: ${existing.mrn || "N/A"}`
      );
    }

    // Auto-generate official MRN
    const mrn = await User.generateMRN();

    // Auto-generate safe fallback email if none provided
    const cleanEmail = email
      ? email.toLowerCase().trim()
      : `walkin.${mrn.toLowerCase().replace(/[^a-z0-9]/g, "")}@medassist.clinic`;

    // Secure temporary password (can be reset via phone/email)
    const tempPassword = crypto.randomBytes(8).toString("hex") + "Aa1!";

    const patient = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      email: cleanEmail,
      password: tempPassword,
      role: "patient",
      mrn,
      dob: dob ? new Date(dob) : undefined,
      gender: gender || "",
      bloodGroup: bloodGroup || "",
      emergencyContact: emergencyContact || "",
      medicalId: {
        bloodGroup: bloodGroup || "",
        allergies: allergies || "",
        conditions: conditions || "",
        medications: medications || "",
      },
      dependents: Array.isArray(dependents) ? dependents : [],
      isVerified: true,
      isEmailVerified: true, // Walk-in patients verified by front desk
    });

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "CREATE",
      resource: "Patient",
      resourceId: String(patient._id),
      details: `Registered walk-in patient '${patient.name}' with MRN: ${patient.mrn}`,
      diff: { before: null, after: patient.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.created(
      {
        patient: {
          _id: patient._id,
          mrn: patient.mrn,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          dob: patient.dob,
          medicalId: patient.medicalId,
          dependents: patient.dependents,
        },
      },
      `Patient registered successfully. Assigned MRN: ${patient.mrn}`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/patients
 * Search and list registered patients (Receptionist, Doctor, Clinic Admin)
 */
export const getPatients = async (req, res, next) => {
  try {
    const { search, bloodGroup, gender } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { role: "patient" };

    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (gender) filter.gender = gender;

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { mrn: regex },
      ];
    }

    const [patients, total] = await Promise.all([
      User.find(filter)
        .select("-password -refreshToken -resetPasswordToken -emailVerificationToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return req.http.ok(
      {
        patients,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
      "Patients retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/patients/:id
 * Retrieve patient profile and log clinical read audit
 */
export const getPatientById = async (req, res, next) => {
  try {
    const patient = await User.findOne({ _id: req.params.id, role: "patient" }).select(
      "-password -refreshToken -resetPasswordToken -emailVerificationToken"
    );

    if (!patient) return req.http.notFound("Patient not found");

    // Automatically audit patient chart reads by clinical staff
    if (req.user && req.user._id.toString() !== patient._id.toString()) {
      recordAudit({
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role,
        action: "VIEW_PATIENT_RECORD",
        resource: "Patient",
        resourceId: String(patient._id),
        details: `Viewed patient medical chart: ${patient.name} (MRN: ${patient.mrn || "N/A"})`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    }

    return req.http.ok({ patient }, "Patient chart retrieved");
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/patients/:id
 * Update patient profile and medical record
 */
export const updatePatient = async (req, res, next) => {
  try {
    const patient = await User.findOne({ _id: req.params.id, role: "patient" });
    if (!patient) return req.http.notFound("Patient not found");

    const before = patient.toObject();

    const allowed = [
      "name",
      "phone",
      "dob",
      "gender",
      "bloodGroup",
      "emergencyContact",
      "medicalId",
      "dependents",
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        patient[field] = req.body[field];
      }
    });

    await patient.save();

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "UPDATE",
      resource: "Patient",
      resourceId: String(patient._id),
      details: `Updated profile & medical history for ${patient.name} (MRN: ${patient.mrn})`,
      diff: { before, after: patient.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.ok({ patient }, "Patient record updated successfully");
  } catch (err) {
    next(err);
  }
};
