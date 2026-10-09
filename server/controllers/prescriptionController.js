import crypto from "crypto";
import Prescription from "../models/Prescription.js";
import DoseEvent from "../models/DoseEvent.js";
import CaregiverLink from "../models/CaregiverLink.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { createNotification } from "../services/notificationService.js";
import { parsePrescriptionText } from "../services/prescriptionParser.js";

// Helper: resolve Doctor doc id for logged-in user
const resolveDoctorId = async (user) => {
  if (user.role === "doctor") {
    const doc = await Doctor.findOne({ userId: user._id });
    return doc?._id || null;
  }
  return null;
};

// Verify caregiver access helper
const checkCaregiverAccess = async (patientId, userId) => {
  if (String(patientId) === String(userId)) return { allowed: true, isCaregiver: false };
  const link = await CaregiverLink.findOne({
    patientId,
    caregiverId: userId,
    status: "active",
  });
  if (link && link.permissions?.canViewSchedule) {
    return { allowed: true, isCaregiver: true, permissions: link.permissions };
  }
  return { allowed: false, isCaregiver: false };
};

// 1. SAVE STRUCTURED PRESCRIPTION (DOCTOR SIDE)
export const saveStructuredPrescription = async (req, res, next) => {
  try {
    const {
      appointmentId,
      patientId: targetPatientId,
      medications,
      notes = "",
      generalInstructions = "",
      validUntil,
    } = req.body;

    let doctorId = await resolveDoctorId(req.user);
    if (!doctorId && req.user.role === "doctor") {
      return req.http.badRequest("Doctor profile not found for user");
    }

    let appointment = null;
    let patientId = targetPatientId;

    if (appointmentId) {
      appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return req.http.notFound("Appointment not found");
      }
      patientId = appointment.patientId;
      if (!doctorId && appointment.doctorId) {
        doctorId = appointment.doctorId;
      }
    }

    if (!patientId) {
      return req.http.badRequest("patientId is required");
    }

    const medsArray = Array.isArray(medications) ? medications : [];

    // Find any existing prescription for this appointment to handle versioning
    let parentPrescription = null;
    if (appointmentId) {
      parentPrescription = await Prescription.findOne({
        appointmentId,
        status: { $in: ["shared", "active", "confirmed", "draft"] },
      }).sort({ version: -1 });
    }

    let newVersion = 1;
    let parentId = null;

    if (parentPrescription) {
      newVersion = (parentPrescription.version || 1) + 1;
      parentId = parentPrescription._id;
      // Mark old version superseded
      parentPrescription.status = "superseded";
      await parentPrescription.save();
    }

    const prescription = await Prescription.create({
      patientId,
      doctorId: doctorId || null,
      appointmentId: appointmentId || null,
      parentPrescriptionId: parentId,
      version: newVersion,
      status: "shared",
      source: medsArray.length > 0 ? "doctor_structured" : "manual",
      medications: medsArray,
      notes,
      generalInstructions,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      sharedAt: new Date(),
      signedAt: new Date(),
    });

    // Update appointment summary text for backwards compatibility
    if (appointmentId) {
      let summaryText = notes || "";
      if (medsArray.length > 0) {
        const medsSummary = medsArray
          .map((m) => `• ${m.drug || m.name} ${m.strength || ""} - ${m.dose || m.dosage || "1 dose"}, ${m.frequency || ""} (${m.durationDays || 5} days) [${m.timing || "after_food"}] ${m.instructions || ""}`)
          .join("\n");
        summaryText = notes ? `${notes}\n\nMedications:\n${medsSummary}` : medsSummary;
      }

      await Appointment.findByIdAndUpdate(appointmentId, {
        prescription: summaryText,
        status: "completed",
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

    // Notify patient
    await createNotification({
      recipient: patientId,
      sender: req.user._id,
      title: newVersion > 1 ? "Recovery Plan Updated" : "New Prescription & Recovery Plan Shared",
      message: newVersion > 1
        ? "Your doctor has updated your medication plan. Please review and confirm your new schedule."
        : "Your doctor has shared a prescription. Check your Recovery Plan to review your medication schedule.",
      type: "PRESCRIPTION_SHARED",
      referenceId: prescription._id,
      referenceModel: "Prescription",
      link: "/recovery-plan",
    });

    return req.http.created(prescription, "Prescription saved and shared with patient successfully");
  } catch (err) {
    next(err);
  }
};

// 2. GET PRESCRIPTION BY APPOINTMENT ID
export const getPrescriptionByAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const prescription = await Prescription.findOne({
      appointmentId,
      status: { $ne: "superseded" },
    })
      .populate("patientId", "name email phone dob")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName" } })
      .sort({ version: -1 });

    if (!prescription) {
      return req.http.ok(null, "No prescription found for this appointment");
    }

    // Patient check
    if (req.user.role === "patient" && String(prescription.patientId?._id || prescription.patientId) !== String(req.user._id)) {
      return req.http.forbidden("Access denied: You can only view your own prescriptions");
    }

    return req.http.ok(prescription);
  } catch (err) {
    next(err);
  }
};

// 3. EXTRACT DRAFT MEDICATIONS FROM FREE TEXT
export const extractPrescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return req.http.notFound("Prescription not found");
    }

    // Access check: patient, caregiver, or doctor
    const isPatient = req.user.role === "patient" && String(prescription.patientId) === String(req.user._id);
    const isDoctor = req.user.role === "doctor";
    if (!isPatient && !isDoctor && req.user.role !== "admin") {
      return req.http.forbidden("Access denied");
    }

    // Rule-based regex extraction
    const rawText = (prescription.notes || "") + "\n" + (prescription.generalInstructions || "");
    const candidateMedications = parsePrescriptionText(rawText);

    // Save as draft if meds were previously empty
    if (!prescription.medications || prescription.medications.length === 0) {
      prescription.medications = candidateMedications;
      prescription.source = "extracted";
      if (prescription.status !== "active") {
        prescription.status = "draft";
      }
      await prescription.save();
    }

    return req.http.ok({
      medications: candidateMedications,
      source: "extracted",
      message: "Candidate medications extracted for review. Please review and confirm each field.",
    });
  } catch (err) {
    next(err);
  }
};

// 4. CONFIRM PRESCRIPTION SCHEDULE & GENERATE DOSE EVENTS
export const confirmPrescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { medications } = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return req.http.notFound("Prescription not found");
    }

    // Check ownership or caregiver permission
    const access = await checkCaregiverAccess(prescription.patientId, req.user._id);
    if (!access.allowed && req.user.role !== "doctor" && req.user.role !== "admin") {
      return req.http.forbidden("Access denied: You cannot confirm this prescription");
    }

    if (!Array.isArray(medications) || medications.length === 0) {
      return req.http.badRequest("At least one reviewed medication is required to activate schedule");
    }

    // STRICT SAFETY VALIDATION: Every field must be reviewed and explicitly valid
    for (const [idx, med] of medications.entries()) {
      if (!med.drug || !med.drug.trim()) {
        return req.http.badRequest(`Medication #${idx + 1}: Drug name is missing and needs clarification.`);
      }
      if (!med.strength || !med.strength.trim()) {
        return req.http.badRequest(`Medication "${med.drug}": Strength (e.g. 500 mg) is missing and needs clarification.`);
      }
      if (!med.dose || !med.dose.trim()) {
        return req.http.badRequest(`Medication "${med.drug}": Dose (e.g. 1 tablet) is missing and needs clarification.`);
      }
      if (!med.frequency || !med.frequency.trim()) {
        return req.http.badRequest(`Medication "${med.drug}": Frequency is missing and needs clarification.`);
      }
      const days = parseInt(med.durationDays, 10);
      if (isNaN(days) || days <= 0) {
        return req.http.badRequest(`Medication "${med.drug}": Duration must be a positive number of days.`);
      }
      if (!Array.isArray(med.times) || med.times.length === 0) {
        return req.http.badRequest(`Medication "${med.drug}": At least one scheduled time (e.g. 08:00) is required.`);
      }
    }

    // Clean validated meds
    const validatedMeds = medications.map((m) => ({
      drug: m.drug.trim(),
      name: m.drug.trim(),
      strength: m.strength.trim(),
      dose: m.dose.trim(),
      dosage: m.dose.trim(),
      frequency: m.frequency.trim(),
      times: m.times.map((t) => t.trim()),
      durationDays: parseInt(m.durationDays, 10),
      duration: `${parseInt(m.durationDays, 10)} days`,
      startDate: m.startDate ? new Date(m.startDate) : new Date(),
      timing: m.timing || "after_food",
      instructions: m.instructions || "",
      needsReview: false,
      fieldConfidence: {
        drug: 1.0,
        strength: 1.0,
        dose: 1.0,
        frequency: 1.0,
        durationDays: 1.0,
      },
    }));

    // Update prescription
    prescription.medications = validatedMeds;
    prescription.medicines = validatedMeds;
    prescription.status = "active";
    prescription.confirmedAt = new Date();
    prescription.confirmedBy = req.user._id;
    await prescription.save();

    // Clean out old scheduled doses if re-confirming
    await DoseEvent.deleteMany({
      prescriptionId: prescription._id,
      status: "scheduled",
    });

    // Generate schedule of DoseEvents for full duration
    const doseEvents = [];
    for (const med of validatedMeds) {
      const baseDate = new Date(med.startDate || Date.now());
      baseDate.setHours(0, 0, 0, 0);

      for (let day = 0; day < med.durationDays; day++) {
        const currentDate = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
        const dd = String(currentDate.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        for (const timeStr of med.times) {
          const [hoursStr, minutesStr] = timeStr.split(":");
          const scheduledAt = new Date(currentDate);
          scheduledAt.setHours(parseInt(hoursStr, 10) || 8, parseInt(minutesStr, 10) || 0, 0, 0);

          doseEvents.push({
            prescriptionId: prescription._id,
            patientId: prescription.patientId,
            drug: med.drug,
            strength: med.strength,
            dose: med.dose,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            scheduledAt,
            instructions: med.instructions,
            timing: med.timing,
            status: "scheduled",
          });
        }
      }
    }

    if (doseEvents.length > 0) {
      await DoseEvent.insertMany(doseEvents);
    }

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "prescription",
      resourceId: prescription._id,
      after: { status: "active", doseEventsGenerated: doseEvents.length },
      req,
    });

    return req.http.ok(
      {
        prescription,
        generatedDosesCount: doseEvents.length,
      },
      `Recovery plan activated! Generated ${doseEvents.length} scheduled dose reminders.`
    );
  } catch (err) {
    next(err);
  }
};

// 5. GET PATIENT ACTIVE RECOVERY PLAN & ALL MEDICATIONS
export const getPatientRecoveryPlan = async (req, res, next) => {
  try {
    let patientId = req.user._id;

    // Caregiver delegation
    if (req.query.patientId) {
      const access = await checkCaregiverAccess(req.query.patientId, req.user._id);
      if (!access.allowed && req.user.role !== "doctor" && req.user.role !== "admin") {
        return req.http.forbidden("Access denied: Not authorized to view patient recovery plan");
      }
      patientId = req.query.patientId;
    }

    const prescriptions = await Prescription.find({
      patientId,
      status: { $in: ["active", "shared", "draft"] },
    })
      .populate("patientId", "name email phone dob")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name qualification clinicName" } })
      .populate("appointmentId", "appointmentDate appointmentTime")
      .sort({ createdAt: -1 });

    const latestActive = prescriptions.find((p) => p.status === "active") || prescriptions[0] || null;

    return req.http.ok({
      currentPlan: latestActive,
      allPlans: prescriptions,
    });
  } catch (err) {
    next(err);
  }
};

// 6. GET TODAY'S DOSES
export const getTodayDoses = async (req, res, next) => {
  try {
    let patientId = req.user._id;

    if (req.query.patientId) {
      const access = await checkCaregiverAccess(req.query.patientId, req.user._id);
      if (!access.allowed && req.user.role !== "doctor" && req.user.role !== "admin") {
        return req.http.forbidden("Access denied");
      }
      patientId = req.query.patientId;
    }

    // Default to client provided date or today in YYYY-MM-DD
    const todayStr = req.query.date || new Date().toISOString().split("T")[0];

    const doses = await DoseEvent.find({
      patientId,
      scheduledDate: todayStr,
    })
      .populate("prescriptionId", "doctorId status notes")
      .sort({ scheduledAt: 1 });

    return req.http.ok(doses);
  } catch (err) {
    next(err);
  }
};

// 7. GET DOSE HISTORY
export const getDoseHistory = async (req, res, next) => {
  try {
    let patientId = req.user._id;

    if (req.query.patientId) {
      const access = await checkCaregiverAccess(req.query.patientId, req.user._id);
      if (!access.allowed && req.user.role !== "doctor" && req.user.role !== "admin") {
        return req.http.forbidden("Access denied");
      }
      patientId = req.query.patientId;
    }

    const { drug, status, startDate, endDate } = req.query;
    const filter = { patientId };

    if (drug) {
      filter.drug = new RegExp(drug.trim(), "i");
    }

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.scheduledDate = {};
      if (startDate) filter.scheduledDate.$gte = startDate;
      if (endDate) filter.scheduledDate.$lte = endDate;
    }

    const history = await DoseEvent.find(filter)
      .sort({ scheduledAt: -1 })
      .limit(100);

    return req.http.ok(history);
  } catch (err) {
    next(err);
  }
};

// 8. CHECK-IN A DOSE (TAKEN / SKIPPED ONLY - NON-NEGOTIABLE SAFETY)
export const checkInDose = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes = "" } = req.body;

    if (status !== "taken" && status !== "skipped") {
      return req.http.badRequest("Invalid check-in status. Permitted values are strictly 'taken' or 'skipped'.");
    }

    const dose = await DoseEvent.findById(id);
    if (!dose) {
      return req.http.notFound("Dose event not found");
    }

    const access = await checkCaregiverAccess(dose.patientId, req.user._id);
    if (!access.allowed && req.user.role !== "doctor" && req.user.role !== "admin") {
      return req.http.forbidden("Access denied: You cannot record check-ins for this patient");
    }

    const isCaregiver = access.isCaregiver;
    const method = isCaregiver ? "caregiver_reported" : "self_reported";

    const before = dose.toObject();
    dose.status = status;
    dose.recordedAt = new Date();
    dose.recordedBy = req.user._id;
    dose.method = method;
    if (notes) dose.notes = notes;

    await dose.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "dose_event",
      resourceId: dose._id,
      before,
      after: dose.toObject(),
      req,
    });

    return req.http.ok(dose, `Dose marked as ${status} (${method === "self_reported" ? "Self-Reported" : "Caregiver-Reported"}).`);
  } catch (err) {
    next(err);
  }
};

// 9. ADHERENCE SUMMARY & EXPERIMENTAL ADHERENCE SCORE
export const getAdherenceSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return req.http.notFound("Prescription not found");
    }

    // Role check
    const access = await checkCaregiverAccess(prescription.patientId, req.user._id);
    if (!access.allowed && req.user.role !== "doctor" && req.user.role !== "admin") {
      return req.http.forbidden("Access denied");
    }

    const now = new Date();
    const pastDoses = await DoseEvent.find({
      prescriptionId: prescription._id,
      scheduledAt: { $lte: now },
    }).sort({ scheduledAt: 1 });

    const totalDue = pastDoses.length;
    let takenOnTime = 0;
    let takenLate = 0;
    let skipped = 0;
    let notConfirmed = 0;

    for (const d of pastDoses) {
      if (d.status === "taken") {
        if (d.recordedAt && d.scheduledAt) {
          const diffMin = (new Date(d.recordedAt).getTime() - new Date(d.scheduledAt).getTime()) / (1000 * 60);
          if (diffMin <= 60) {
            takenOnTime++;
          } else {
            takenLate++;
          }
        } else {
          takenOnTime++;
        }
      } else if (d.status === "skipped") {
        skipped++;
      } else {
        notConfirmed++;
      }
    }

    // Consecutive missed count from the tail
    let consecutiveMissed = 0;
    for (let i = pastDoses.length - 1; i >= 0; i--) {
      const s = pastDoses[i].status;
      if (s === "skipped" || s === "not_confirmed" || s === "scheduled") {
        consecutiveMissed++;
      } else {
        break;
      }
    }

    // Experimental Score: (taken_on_time * 1.0 + taken_late * 0.7) / total_due_doses * 100
    let adherenceScore = 100;
    if (totalDue > 0) {
      const rawScore = ((takenOnTime * 1.0 + takenLate * 0.7) / totalDue) * 100;
      // Consecutive missed penalty
      const penalty = Math.min(25, consecutiveMissed * 5);
      adherenceScore = Math.max(0, Math.min(100, Math.round(rawScore - penalty)));
    }

    return req.http.ok({
      prescriptionId: prescription._id,
      patientId: prescription.patientId,
      totalDue,
      takenOnTime,
      takenLate,
      skipped,
      notConfirmed,
      consecutiveMissed,
      adherenceScore,
      scoreLabel: "Experimental – not a clinical risk estimate",
      hasConsecutiveMissAlert: consecutiveMissed >= 2,
      alertMessage: consecutiveMissed >= 2 ? "⚠️ Patient has unconfirmed doses – follow-up recommended." : null,
    });
  } catch (err) {
    next(err);
  }
};

// 10. CAREGIVER INVITATION & MANAGEMENT
export const inviteCaregiver = async (req, res, next) => {
  try {
    const { email, caregiverName, relationship } = req.body;
    if (!email) {
      return req.http.badRequest("Caregiver email is required");
    }

    const patientId = req.user._id;
    const token = crypto.randomBytes(24).toString("hex");

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

    const link = await CaregiverLink.findOneAndUpdate(
      { patientId, caregiverEmail: email.toLowerCase().trim() },
      {
        patientId,
        caregiverEmail: email.toLowerCase().trim(),
        caregiverId: existingUser?._id || null,
        caregiverName: caregiverName || existingUser?.name || "Caregiver",
        relationship: relationship || "family",
        inviteToken: token,
        status: "active", // Active upon patient explicit invitation
        consentedAt: new Date(),
        revokedAt: null,
      },
      { upsert: true, new: true }
    );

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "caregiver_link",
      resourceId: link._id,
      after: link.toObject(),
      req,
    });

    if (existingUser) {
      await createNotification({
        recipient: existingUser._id,
        sender: req.user._id,
        title: "Caregiver Access Granted",
        message: `${req.user.name || "A patient"} has added you as a caregiver for their recovery plan.`,
        type: "CAREGIVER_INVITE",
        link: `/recovery-plan?caregiverFor=${patientId}`,
      });
    }

    return req.http.ok(link, "Caregiver invited successfully");
  } catch (err) {
    next(err);
  }
};

export const getCaregiverLinks = async (req, res, next) => {
  try {
    const patientLinks = await CaregiverLink.find({
      patientId: req.user._id,
      status: "active",
    }).populate("caregiverId", "name email phone");

    const asCaregiverLinks = await CaregiverLink.find({
      caregiverId: req.user._id,
      status: "active",
    }).populate("patientId", "name email phone dob");

    return req.http.ok({
      myCaregivers: patientLinks,
      patientsIcareFor: asCaregiverLinks,
    });
  } catch (err) {
    next(err);
  }
};

export const revokeCaregiverLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const link = await CaregiverLink.findOne({
      _id: id,
      patientId: req.user._id,
    });

    if (!link) {
      return req.http.notFound("Caregiver link not found");
    }

    link.status = "revoked";
    link.revokedAt = new Date();
    await link.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "caregiver_link",
      resourceId: link._id,
      after: { status: "revoked" },
      req,
    });

    return req.http.ok(link, "Caregiver access revoked successfully");
  } catch (err) {
    next(err);
  }
};
