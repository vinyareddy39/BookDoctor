import path from "path";
import fs from "fs";
import ClinicalNote from "../models/ClinicalNote.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";
import FollowUp from "../models/FollowUp.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { sendNotificationToUser } from "../socket.js";
import { PRESCRIPTION_UPLOAD_DIR } from "../middleware/prescriptionUpload.js";

// Helper: resolve doctor id for current user if doctor
const resolveDoctorId = async (user) => {
  if (user.role === "doctor") {
    const doc = await Doctor.findOne({ userId: user._id });
    return doc?._id || null;
  }
  return null;
};

// ============================================================================
// 1. CLINICAL NOTES (EMR)
// ============================================================================

// CREATE CLINICAL NOTE (Doctor, Clinic Admin)
export const createClinicalNote = async (req, res, next) => {
  try {
    const { patientId, appointmentId, chiefComplaint, historyOfPresentIllness, vitals, examination, assessment, plan, diagnoses, isSigning } = req.body;

    let doctorId = req.body.doctorId;
    if (req.user.role === "doctor") {
      doctorId = await resolveDoctorId(req.user);
      if (!doctorId) return req.http.badRequest("Doctor record not found for this user");
    }

    if (!patientId || !chiefComplaint) {
      return req.http.badRequest("patientId and chiefComplaint are required");
    }

    const noteStatus = isSigning ? "signed" : "draft";
    const note = await ClinicalNote.create({
      patientId,
      doctorId,
      appointmentId: appointmentId || null,
      chiefComplaint,
      historyOfPresentIllness: historyOfPresentIllness || "",
      vitals: vitals || {},
      examination: examination || "",
      assessment: assessment || "",
      plan: plan || "",
      diagnoses: diagnoses || [],
      status: noteStatus,
      signedAt: isSigning ? new Date() : null,
      signedBy: isSigning ? req.user._id : null,
    });

    // Auto-save any primary diagnoses to the Diagnosis collection
    if (Array.isArray(diagnoses) && diagnoses.length > 0) {
      for (const d of diagnoses) {
        if (d.code && d.label) {
          await Diagnosis.findOneAndUpdate(
            { patientId, code: d.code.toUpperCase() },
            {
              patientId,
              doctorId,
              clinicalNoteId: note._id,
              code: d.code.toUpperCase(),
              label: d.label,
              status: "active",
              diagnosedDate: new Date(),
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "clinical_note",
      resourceId: note._id,
      after: note.toObject(),
      req,
    });

    return req.http.created(note, isSigning ? "Clinical note signed and locked" : "Draft clinical note saved");
  } catch (err) {
    next(err);
  }
};

// GET CLINICAL NOTES (Record-level scoping: receptionists and lab techs BLOCKED)
export const getClinicalNotes = async (req, res, next) => {
  try {
    const { patientId, appointmentId } = req.query;
    let query = {};

    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    } else if (patientId) {
      query.patientId = patientId;
    }

    if (appointmentId) query.appointmentId = appointmentId;

    if (req.user.role === "doctor") {
      const docId = await resolveDoctorId(req.user);
      if (docId) query.doctorId = docId;
    }

    const notes = await ClinicalNote.find(query)
      .populate("patientId", "name mrn dob gender bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .populate("signedBy", "name")
      .sort({ createdAt: -1 });

    return req.http.ok(notes);
  } catch (err) {
    next(err);
  }
};

// GET CLINICAL NOTE BY ID
export const getClinicalNoteById = async (req, res, next) => {
  try {
    const note = await ClinicalNote.findById(req.params.id)
      .populate("patientId", "name mrn dob gender bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .populate("signedBy", "name")
      .populate("parentNoteId");

    if (!note) return req.http.notFound("Clinical note not found");

    if (req.user.role === "patient" && String(note.patientId?._id || note.patientId) !== String(req.user._id)) {
      return req.http.forbidden("Access denied: You may only view your own clinical records");
    }

    return req.http.ok(note);
  } catch (err) {
    next(err);
  }
};

// UPDATE DRAFT CLINICAL NOTE
export const updateClinicalNote = async (req, res, next) => {
  try {
    const note = await ClinicalNote.findById(req.params.id);
    if (!note) return req.http.notFound("Clinical note not found");

    // Immutability Rule: signed notes CANNOT be directly edited
    if (note.status === "signed" || note.status === "amended") {
      return req.http.forbidden("Signed clinical notes are locked. Please create an amendment instead.");
    }

    const before = note.toObject();
    Object.assign(note, req.body);

    if (req.body.isSigning) {
      note.status = "signed";
      note.signedAt = new Date();
      note.signedBy = req.user._id;
    }

    await note.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "clinical_note",
      resourceId: note._id,
      before,
      after: note.toObject(),
      req,
    });

    return req.http.ok(note, note.status === "signed" ? "Clinical note signed and locked" : "Draft updated");
  } catch (err) {
    next(err);
  }
};

// AMEND SIGNED CLINICAL NOTE (Creates a new version, preserves original)
export const amendClinicalNote = async (req, res, next) => {
  try {
    const { amendmentReason, chiefComplaint, historyOfPresentIllness, vitals, examination, assessment, plan, diagnoses } = req.body;

    if (!amendmentReason?.trim()) {
      return req.http.badRequest("An amendment reason is required to modify a signed clinical note");
    }

    const originalNote = await ClinicalNote.findById(req.params.id);
    if (!originalNote) return req.http.notFound("Original clinical note not found");

    // Mark previous as amended
    originalNote.status = "amended";
    await originalNote.save();

    // Create new version linked to parent
    const amendedNote = await ClinicalNote.create({
      patientId: originalNote.patientId,
      doctorId: originalNote.doctorId,
      appointmentId: originalNote.appointmentId,
      version: originalNote.version + 1,
      parentNoteId: originalNote._id,
      status: "signed",
      signedAt: new Date(),
      signedBy: req.user._id,
      amendmentReason,
      chiefComplaint: chiefComplaint ?? originalNote.chiefComplaint,
      historyOfPresentIllness: historyOfPresentIllness ?? originalNote.historyOfPresentIllness,
      vitals: vitals ?? originalNote.vitals,
      examination: examination ?? originalNote.examination,
      assessment: assessment ?? originalNote.assessment,
      plan: plan ?? originalNote.plan,
      diagnoses: diagnoses ?? originalNote.diagnoses,
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "clinical_note",
      resourceId: amendedNote._id,
      before: originalNote.toObject(),
      after: amendedNote.toObject(),
      req,
    });

    return req.http.created(amendedNote, `Clinical note amendment v${amendedNote.version} created and locked`);
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// 2. DIAGNOSES (ICD CODES)
// ============================================================================

export const getDiagnoses = async (req, res, next) => {
  try {
    const { patientId, status } = req.query;
    let query = {};
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;

    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    }

    const diagnoses = await Diagnosis.find(query)
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
      .sort({ diagnosedDate: -1 });

    return req.http.ok(diagnoses);
  } catch (err) {
    next(err);
  }
};

export const createDiagnosis = async (req, res, next) => {
  try {
    const { patientId, code, label, category, notes, status } = req.body;

    let doctorId = req.body.doctorId;
    if (req.user.role === "doctor") {
      doctorId = await resolveDoctorId(req.user);
    }

    if (!patientId || !code || !label) {
      return req.http.badRequest("patientId, code, and label are required");
    }

    const diagnosis = await Diagnosis.create({
      patientId,
      doctorId: doctorId || null,
      code: code.trim().toUpperCase(),
      label: label.trim(),
      category: category || "General",
      notes: notes || "",
      status: status || "active",
      diagnosedDate: new Date(),
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "diagnosis",
      resourceId: diagnosis._id,
      after: diagnosis.toObject(),
      req,
    });

    return req.http.created(diagnosis, "Diagnosis recorded successfully");
  } catch (err) {
    next(err);
  }
};

export const updateDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const diagnosis = await Diagnosis.findById(id);
    if (!diagnosis) return req.http.notFound("Diagnosis not found");

    const before = diagnosis.toObject();
    if (status) diagnosis.status = status;
    if (notes !== undefined) diagnosis.notes = notes;
    await diagnosis.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "diagnosis",
      resourceId: id,
      before,
      after: diagnosis.toObject(),
      req,
    });

    return req.http.ok(diagnosis, "Diagnosis updated");
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// 3. PRESCRIPTIONS (STRUCTURED & PDF PERSISTED)
// ============================================================================

export const createPrescription = async (req, res, next) => {
  try {
    const {
      patientId: reqPatientId,
      appointmentId,
      clinicalNoteId,
      medicines,
      generalInstructions,
      validUntil,
      attachmentUrl,
      attachmentType,
      attachmentName,
      notes,
    } = req.body;

    let patientId = reqPatientId;
    if (req.user.role === "patient") {
      patientId = req.user._id;
    }

    let doctorId = req.body.doctorId;
    if (req.user.role === "doctor") {
      doctorId = await resolveDoctorId(req.user);
      if (!doctorId) return req.http.badRequest("Doctor profile not found");
    }

    let parsedMedicines = [];
    if (Array.isArray(medicines)) {
      parsedMedicines = medicines;
    } else if (typeof medicines === "string" && medicines.trim()) {
      try {
        parsedMedicines = JSON.parse(medicines);
      } catch (_) {
        parsedMedicines = [];
      }
    }

    if (!patientId) {
      return req.http.badRequest("patientId is required");
    }

    if (parsedMedicines.length === 0 && !attachmentUrl) {
      return req.http.badRequest("Either prescribed medicines or an uploaded prescription document/photo is required");
    }

    const uploadedBy = req.user.role === "patient" ? "patient" : (req.user.role === "doctor" ? "doctor" : "clinic_admin");

    const prescription = await Prescription.create({
      patientId,
      doctorId: doctorId || null,
      appointmentId: appointmentId || null,
      clinicalNoteId: clinicalNoteId || null,
      medicines: parsedMedicines,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      uploadedBy,
      notes: notes || "",
      generalInstructions: generalInstructions || "",
      validUntil: validUntil ? new Date(validUntil) : undefined,
      signedAt: new Date(),
    });

    // Backward-compatibility: if linked to appointment, update appointment.prescription string
    if (appointmentId && parsedMedicines.length > 0) {
      const summaryText = parsedMedicines
        .map((m) => `• ${m.name} - ${m.dosage}, ${m.frequency} (${m.duration}) [${m.timing}] ${m.instructions}`)
        .join("\n");

      await Appointment.findByIdAndUpdate(appointmentId, {
        prescription: summaryText,
        status: "completed",
        paymentStatus: "paid",
      });
    }

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "prescription",
      resourceId: prescription._id,
      after: prescription.toObject(),
      req,
    });

    // Notify appropriate party
    if (uploadedBy === "patient" && doctorId) {
      const doc = await Doctor.findById(doctorId).populate("userId");
      if (doc?.userId?._id) {
        sendNotificationToUser(doc.userId._id, {
          type: "PRESCRIPTION_UPLOADED",
          title: "Patient Uploaded Prescription",
          message: `A patient has uploaded their prescription document/photo for your review.`,
        });
      }
    } else {
      sendNotificationToUser(patientId, {
        type: "PRESCRIPTION_ADDED",
        title: "New Prescription Available",
        message: `Your prescription is ready. You can view, download, or inspect the document anytime.`,
      });
    }

    const populated = await Prescription.findById(prescription._id)
      .populate("patientId", "name mrn email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName" } });

    return req.http.created(populated, "Prescription saved and published successfully");
  } catch (err) {
    next(err);
  }
};

// UPLOAD / UPDATE PRESCRIPTION DOCUMENT (PHOTO OR PDF)
export const uploadPrescription = async (req, res, next) => {
  try {
    if (!req.file) {
      return req.http.badRequest("Please select a prescription photo or PDF file to upload");
    }

    const { prescriptionId, notes, generalInstructions, appointmentId } = req.body;
    let targetPatientId = req.body.patientId;
    if (req.user.role === "patient" || !targetPatientId) {
      targetPatientId = req.user._id;
    }

    let doctorId = req.body.doctorId;
    if (req.user.role === "doctor") {
      doctorId = await resolveDoctorId(req.user);
    }

    const mime = req.file.mimetype.toLowerCase();
    let attachmentType = "image";
    if (mime === "application/pdf") {
      attachmentType = "pdf";
    }

    const attachmentUrl = `/uploads/prescriptions/${req.file.filename}`;
    const attachmentName = req.file.originalname;

    // Case 1: Updating an existing prescription (e.g. updating the photo)
    if (prescriptionId) {
      const existingRx = await Prescription.findById(prescriptionId);
      if (!existingRx) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return req.http.notFound("Prescription record not found to update");
      }

      // Check ownership
      if (req.user.role === "patient" && String(existingRx.patientId) !== String(req.user._id)) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return req.http.forbidden("Access denied: You can only update your own prescription");
      }

      const before = existingRx.toObject();
      // Remove old file from disk if present
      if (existingRx.attachmentUrl) {
        const oldFilename = path.basename(existingRx.attachmentUrl);
        const oldPath = path.join(PRESCRIPTION_UPLOAD_DIR, oldFilename);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (_) {}
        }
      }

      existingRx.attachmentUrl = attachmentUrl;
      existingRx.attachmentType = attachmentType;
      existingRx.attachmentName = attachmentName;
      if (notes !== undefined) existingRx.notes = notes;
      if (generalInstructions !== undefined) existingRx.generalInstructions = generalInstructions;
      existingRx.version = (existingRx.version || 1) + 1;
      await existingRx.save();

      recordAudit({
        userId: req.user._id,
        role: req.user.role,
        action: "update",
        resource: "prescription",
        resourceId: existingRx._id,
        before,
        after: existingRx.toObject(),
        req,
      });

      const populated = await Prescription.findById(existingRx._id)
        .populate("patientId", "name mrn email phone")
        .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName" } });

      return req.http.ok(populated, "Prescription document updated successfully");
    }

    // Case 2: Creating a new prescription with uploaded file
    let parsedMedicines = [];
    if (req.body.medicines) {
      try {
        parsedMedicines = typeof req.body.medicines === "string" ? JSON.parse(req.body.medicines) : req.body.medicines;
      } catch (_) {
        parsedMedicines = [];
      }
    }

    const uploadedBy = req.user.role === "patient" ? "patient" : (req.user.role === "doctor" ? "doctor" : "clinic_admin");

    const newRx = await Prescription.create({
      patientId: targetPatientId,
      doctorId: doctorId || null,
      appointmentId: appointmentId || null,
      attachmentUrl,
      attachmentType,
      attachmentName,
      uploadedBy,
      notes: notes || "",
      generalInstructions: generalInstructions || "",
      medicines: Array.isArray(parsedMedicines) ? parsedMedicines : [],
      signedAt: new Date(),
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "prescription",
      resourceId: newRx._id,
      after: newRx.toObject(),
      req,
    });

    if (uploadedBy === "patient") {
      sendNotificationToUser(targetPatientId, {
        type: "PRESCRIPTION_UPLOADED",
        title: "Prescription Uploaded",
        message: "Your prescription photo/PDF has been uploaded and saved securely.",
      });
    } else {
      sendNotificationToUser(targetPatientId, {
        type: "PRESCRIPTION_ADDED",
        title: "Prescription Shared with You",
        message: "Your doctor has uploaded and shared a prescription document/photo with you.",
      });
    }

    const populated = await Prescription.findById(newRx._id)
      .populate("patientId", "name mrn email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName" } });

    return req.http.created(populated, "Prescription uploaded and shared successfully");
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// DOWNLOAD / STREAM PRESCRIPTION ATTACHMENT
export const downloadPrescriptionAttachment = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription || !prescription.attachmentUrl) {
      return req.http.notFound("No prescription attachment found");
    }

    if (req.user.role === "patient" && String(prescription.patientId) !== String(req.user._id)) {
      return req.http.forbidden("Access denied: You may only view your own prescriptions");
    }

    const filename = path.basename(prescription.attachmentUrl);
    const filePath = path.join(PRESCRIPTION_UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return req.http.notFound("Attachment file not found on disk");
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".pdf" ? "application/pdf" : (ext === ".png" ? "image/png" : "image/jpeg");
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    const downloadName = prescription.attachmentName || `prescription_${prescription._id}${ext}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(downloadName)}"`);
    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

export const getPrescriptions = async (req, res, next) => {
  try {
    const { patientId, appointmentId } = req.query;
    let query = {};

    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    } else if (patientId) {
      query.patientId = patientId;
    }

    if (appointmentId) query.appointmentId = appointmentId;

    if (req.user.role === "doctor") {
      const docId = await resolveDoctorId(req.user);
      if (docId && !patientId) query.doctorId = docId;
    }

    const prescriptions = await Prescription.find(query)
      .populate("patientId", "name mrn email phone dob")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName" } })
      .sort({ createdAt: -1 });

    return req.http.ok(prescriptions);
  } catch (err) {
    next(err);
  }
};

export const getPrescriptionById = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate("patientId", "name mrn email phone dob bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName address" } });

    if (!prescription) return req.http.notFound("Prescription not found");

    if (req.user.role === "patient" && String(prescription.patientId?._id || prescription.patientId) !== String(req.user._id)) {
      return req.http.forbidden("Access denied: You may only view your own prescriptions");
    }

    return req.http.ok(prescription);
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// 4. FOLLOW-UPS (DOCTOR & PATIENT FLOW)
// ============================================================================

export const createFollowUp = async (req, res, next) => {
  try {
    const { patientId, appointmentId, dueDate, reason, plan } = req.body;

    let doctorId = req.body.doctorId;
    if (req.user.role === "doctor") {
      doctorId = await resolveDoctorId(req.user);
    }

    if (!patientId || !dueDate || !reason) {
      return req.http.badRequest("patientId, dueDate, and reason are required");
    }

    const followUp = await FollowUp.create({
      patientId,
      doctorId: doctorId || null,
      appointmentId: appointmentId || null,
      dueDate: new Date(dueDate),
      reason,
      plan: plan || "",
      status: "pending",
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "follow_up",
      resourceId: followUp._id,
      after: followUp.toObject(),
      req,
    });

    return req.http.created(followUp, "Follow-up scheduled");
  } catch (err) {
    next(err);
  }
};

export const getFollowUps = async (req, res, next) => {
  try {
    const { patientId, status } = req.query;
    let query = {};

    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    } else if (patientId) {
      query.patientId = patientId;
    }

    if (status) query.status = status;

    if (req.user.role === "doctor") {
      const docId = await resolveDoctorId(req.user);
      if (docId) query.doctorId = docId;
    }

    const followUps = await FollowUp.find(query)
      .populate("patientId", "name mrn phone email")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .sort({ dueDate: 1 });

    return req.http.ok(followUps);
  } catch (err) {
    next(err);
  }
};

// PATIENT REQUESTS FOLLOW-UP
export const requestFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { requestedDate, patientNotes } = req.body;

    const followUp = await FollowUp.findById(id).populate("patientId", "name");
    if (!followUp) return req.http.notFound("Follow-up not found");

    if (req.user.role === "patient" && String(followUp.patientId._id) !== String(req.user._id)) {
      return req.http.forbidden("You can only request follow-up for your own records.");
    }

    followUp.status = "requested_by_patient";
    followUp.requestedDate = requestedDate ? new Date(requestedDate) : new Date();
    if (patientNotes) followUp.patientNotes = patientNotes;
    await followUp.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "follow_up",
      resourceId: followUp._id,
      after: followUp.toObject(),
      req,
    });

    // Notify doctor
    if (followUp.doctorId) {
      const doctorDoc = await Doctor.findById(followUp.doctorId);
      if (doctorDoc?.userId) {
        sendNotificationToUser(doctorDoc.userId, {
          type: "FOLLOW_UP_REQUEST",
          title: "Follow-Up Requested",
          message: `${followUp.patientId?.name || "Patient"} requested follow-up consultation on ${new Date(followUp.requestedDate).toLocaleDateString()}.`,
        });
      }
    }

    return req.http.ok(followUp, "Follow-up requested. Doctor will confirm or schedule slot.");
  } catch (err) {
    next(err);
  }
};

// DOCTOR APPROVES / SCHEDULES FOLLOW-UP
export const approveFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, appointmentId } = req.body;

    const followUp = await FollowUp.findById(id);
    if (!followUp) return req.http.notFound("Follow-up record not found");

    followUp.status = status || "approved";
    followUp.approvedBy = req.user._id;
    followUp.approvedAt = new Date();
    if (appointmentId) followUp.scheduledAppointmentId = appointmentId;
    await followUp.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "follow_up",
      resourceId: followUp._id,
      after: followUp.toObject(),
      req,
    });

    if (followUp.patientId) {
      sendNotificationToUser(followUp.patientId, {
        type: "FOLLOW_UP_APPROVED",
        title: "Follow-Up Approved",
        message: `Your doctor has approved your follow-up request. Status: ${followUp.status}.`,
      });
    }

    return req.http.ok(followUp, `Follow-up ${followUp.status}`);
  } catch (err) {
    next(err);
  }
};
