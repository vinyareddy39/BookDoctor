import crypto from "crypto";
import SymptomCheckin from "../models/SymptomCheckin.js";
import RefillRequest from "../models/RefillRequest.js";
import MedicalId from "../models/MedicalId.js";
import Prescription from "../models/Prescription.js";
import DoseEvent from "../models/DoseEvent.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { dispatchNotification, EVENT_TYPES } from "../services/centralNotificationService.js";

/**
 * 1. Submit Daily Symptom Check-in with Red-Flag Rules (Rule-based, NO AI)
 */
export const submitSymptomCheckin = async (req, res, next) => {
  try {
    const {
      prescriptionId,
      painLevel,
      woundCondition = "none",
      temperature = null,
      temperatureUnit = "F",
      generalFeeling = "same",
      notes = "",
    } = req.body;
    const patientId = req.user._id;

    if (painLevel === undefined || painLevel === null || painLevel < 0 || painLevel > 10) {
      return req.http.badRequest("Pain level must be between 0 and 10.");
    }

    let doctorId = null;
    if (prescriptionId) {
      const pres = await Prescription.findById(prescriptionId);
      if (pres?.doctorId) doctorId = pres.doctorId;
    }

    // Apply Deterministic Red-Flag Rules
    const redFlagReasons = [];

    // Rule 1: High pain level (>= 8)
    if (painLevel >= 8) {
      redFlagReasons.push(`High pain score reported: ${painLevel}/10`);
    }

    // Rule 2: Wound discharge or bleeding
    if (["discharge", "bleeding"].includes(woundCondition)) {
      redFlagReasons.push(`Critical wound condition observed: ${woundCondition}`);
    }

    // Rule 3: Elevated temperature (> 101°F or > 38.3°C)
    if (temperature !== null && temperature !== undefined && temperature > 0) {
      const tempNum = Number(temperature);
      if (temperatureUnit === "F" && tempNum >= 101.0) {
        redFlagReasons.push(`High fever detected: ${tempNum}°F (threshold: 101°F)`);
      } else if (temperatureUnit === "C" && tempNum >= 38.3) {
        redFlagReasons.push(`High fever detected: ${tempNum}°C (threshold: 38.3°C)`);
      }
    }

    // Rule 4: Consecutive worsening feeling
    if (generalFeeling === "worse") {
      const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
      const priorCheckin = await SymptomCheckin.findOne({
        patientId,
        createdAt: { $gte: yesterday },
      }).sort({ createdAt: -1 });

      if (priorCheckin && priorCheckin.generalFeeling === "worse") {
        redFlagReasons.push("General condition reported 'worse' for 2 consecutive days");
      }
    }

    const isRedFlag = redFlagReasons.length > 0;

    const checkin = await SymptomCheckin.create({
      patientId,
      prescriptionId: prescriptionId || null,
      doctorId: doctorId || null,
      painLevel: Number(painLevel),
      woundCondition,
      temperature: temperature ? Number(temperature) : null,
      temperatureUnit,
      generalFeeling,
      notes,
      isRedFlag,
      redFlagReasons,
    });

    let warningPrompt = null;
    if (isRedFlag) {
      warningPrompt = {
        title: "⚠️ High-Urgency Symptoms Detected",
        message:
          "Your reported symptoms suggest you should be evaluated by a healthcare professional immediately.",
        reasons: redFlagReasons,
        recommendedActions: [
          { label: "Call Ambulance 108", tel: "108", primary: true },
          { label: "Emergency 112", tel: "112" },
          { label: "Call Clinic / Doctor", action: "call_clinic" },
        ],
      };

      // Notify Doctor if doctorId is known
      if (doctorId) {
        const doctorDoc = await Doctor.findById(doctorId).populate("userId", "name");
        if (doctorDoc?.userId?._id) {
          await dispatchNotification({
            userId: doctorDoc.userId._id,
            eventType: EVENT_TYPES.SYMPTOM_RED_FLAG,
            title: "⚠️ Red-Flag Symptom Alert",
            message: `Patient ${req.user.name || "Patient"} reported high-urgency symptoms: ${redFlagReasons.join("; ")}.`,
            channels: ["in_app", "sms", "email"],
            data: {
              entityType: "symptom_checkin",
              entityId: checkin._id,
              deepLink: "/doctor/dashboard",
              metadata: {
                patientName: req.user.name || "Patient",
                alertReason: redFlagReasons.join("; "),
              },
            },
          });
        }
      }
    }

    return req.http.created({ checkin, isRedFlag, warningPrompt }, "Symptom check-in recorded.");
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Get Symptom History & Trend (7 to 30 days)
 */
export const getSymptomTrends = async (req, res, next) => {
  try {
    let patientId = req.user._id;

    // Doctor querying a specific patient
    if (req.user.role === "doctor" && req.query.patientId) {
      patientId = req.query.patientId;
    }

    const days = parseInt(req.query.days) || 14;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const checkins = await SymptomCheckin.find({
      patientId,
      createdAt: { $gte: sinceDate },
    })
      .sort({ createdAt: 1 })
      .lean();

    const formattedTrend = checkins.map((c) => ({
      id: c._id,
      date: new Date(c.createdAt).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
      }),
      timestamp: c.createdAt,
      painLevel: c.painLevel,
      temperature: c.temperature,
      temperatureUnit: c.temperatureUnit,
      woundCondition: c.woundCondition,
      generalFeeling: c.generalFeeling,
      isRedFlag: c.isRedFlag,
      reasons: c.redFlagReasons,
    }));

    return req.http.ok(formattedTrend, "Symptom trend retrieved.");
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Request Refill for Medication
 */
export const requestRefill = async (req, res, next) => {
  try {
    const { prescriptionId, drugName, notes = "" } = req.body;
    const patientId = req.user._id;

    if (!prescriptionId || !drugName) {
      return req.http.badRequest("Prescription ID and drug name are required.");
    }

    const prescription = await Prescription.findById(prescriptionId).populate({
      path: "doctorId",
      populate: { path: "userId", select: "name" },
    });
    if (!prescription) return req.http.notFound("Prescription not found.");

    const med = prescription.medications?.find(
      (m) => m.drug?.toLowerCase() === drugName.toLowerCase()
    );

    const refillReq = await RefillRequest.create({
      prescriptionId,
      patientId,
      doctorId: prescription.doctorId?._id || prescription.doctorId,
      drugName,
      currentDose: med ? `${med.strength || ""} ${med.dose || ""}`.trim() : "",
      patientNotes: notes,
    });

    // Notify Doctor
    const docUserId = prescription.doctorId?.userId?._id || prescription.doctorId?.userId;
    if (docUserId) {
      await dispatchNotification({
        userId: docUserId,
        eventType: EVENT_TYPES.REFILL_DUE,
        title: "Medication Refill Requested",
        message: `Patient ${req.user.name || "Patient"} requested a refill for ${drugName}.`,
        channels: ["in_app", "email"],
        data: {
          entityType: "refill_request",
          entityId: refillReq._id,
          deepLink: "/doctor/dashboard",
        },
      });
    }

    return req.http.created(refillReq, "Refill request submitted to your doctor.");
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Doctor Adherence Analytics
 */
export const getDoctorAdherenceAnalytics = async (req, res, next) => {
  try {
    let doctorId = null;
    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (!doc) return req.http.ok({ patients: [], overallAdherenceRate: 0 });
      doctorId = doc._id;
    } else if (req.query.doctorId && ["admin", "clinic_admin"].includes(req.user.role)) {
      doctorId = req.query.doctorId;
    } else {
      return req.http.forbidden("Doctor access required");
    }

    // Find all confirmed prescriptions by this doctor
    const prescriptions = await Prescription.find({
      doctorId,
      status: "confirmed",
    })
      .populate("patientId", "name email phone dob gender")
      .sort({ updatedAt: -1 })
      .lean();

    const patientMap = new Map();

    for (const p of prescriptions) {
      const pid = String(p.patientId?._id || p.patientId);
      if (!patientMap.has(pid)) {
        patientMap.set(pid, {
          patientId: p.patientId?._id,
          patientName: p.patientId?.name || "Patient",
          patientEmail: p.patientId?.email || "",
          prescriptionCount: 0,
          prescriptions: [],
          totalScheduledDoses: 0,
          totalTakenDoses: 0,
          totalSkippedDoses: 0,
        });
      }

      const entry = patientMap.get(pid);
      entry.prescriptionCount += 1;
      entry.prescriptions.push(p);

      // Query dose events for this prescription
      const doses = await DoseEvent.find({ prescriptionId: p._id }).lean();
      entry.totalScheduledDoses += doses.length;
      entry.totalTakenDoses += doses.filter((d) => d.status === "taken").length;
      entry.totalSkippedDoses += doses.filter((d) => d.status === "skipped").length;
    }

    // Attach latest symptom checkin and calculate adherence score
    const patientAnalyticsList = [];
    let totalAllScheduled = 0;
    let totalAllTaken = 0;

    for (const [pid, entry] of patientMap.entries()) {
      const adherenceRate =
        entry.totalScheduledDoses > 0
          ? Math.round((entry.totalTakenDoses / entry.totalScheduledDoses) * 100)
          : 100;

      totalAllScheduled += entry.totalScheduledDoses;
      totalAllTaken += entry.totalTakenDoses;

      const latestCheckin = await SymptomCheckin.findOne({ patientId: pid })
        .sort({ createdAt: -1 })
        .lean();

      patientAnalyticsList.push({
        patientId: pid,
        patientName: entry.patientName,
        patientEmail: entry.patientEmail,
        adherenceRate,
        needsFollowUp: adherenceRate < 60,
        totalScheduledDoses: entry.totalScheduledDoses,
        totalTakenDoses: entry.totalTakenDoses,
        totalSkippedDoses: entry.totalSkippedDoses,
        latestPainScore: latestCheckin ? latestCheckin.painLevel : null,
        latestGeneralFeeling: latestCheckin ? latestCheckin.generalFeeling : null,
        lastCheckinDate: latestCheckin ? latestCheckin.createdAt : null,
        hasRedFlag: latestCheckin ? latestCheckin.isRedFlag : false,
      });
    }

    const overallAdherenceRate =
      totalAllScheduled > 0 ? Math.round((totalAllTaken / totalAllScheduled) * 100) : 100;

    return req.http.ok(
      {
        overallAdherenceRate,
        totalMonitoredPatients: patientAnalyticsList.length,
        patientsNeedsFollowUp: patientAnalyticsList.filter((p) => p.needsFollowUp).length,
        patients: patientAnalyticsList,
      },
      "Recovery analytics retrieved."
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Refill Reminder Cron Helper (dispatches when prescription has 2 days remaining)
 */
export const checkAndSendRefillReminders = async (referenceTime = new Date()) => {
  const summary = { remindersSent: 0 };
  try {
    const nowMs = referenceTime.getTime();
    // 2 days = 48 hours. Target window: 40 hours to 56 hours before endDate
    const windowStart = new Date(nowMs + 40 * 60 * 60 * 1000);
    const windowEnd = new Date(nowMs + 56 * 60 * 60 * 1000);

    const activePrescriptions = await Prescription.find({
      status: "confirmed",
      refillReminderSent: { $ne: true },
      $or: [
        { endDate: { $gte: windowStart, $lte: windowEnd } },
        { validUntil: { $gte: windowStart, $lte: windowEnd } },
      ],
    }).populate("patientId", "name email phone");

    for (const pres of activePrescriptions) {
      pres.refillReminderSent = true;
      await pres.save();
      summary.remindersSent++;

      const patientUserId = pres.patientId?._id || pres.patientId;
      const drugList = (pres.medications || []).map((m) => m.drug).join(", ") || "Medication";

      if (patientUserId) {
        await dispatchNotification({
          userId: patientUserId,
          eventType: EVENT_TYPES.REFILL_DUE,
          title: "Medication Refill Due Soon",
          message: `Your prescription (${drugList}) runs out in approximately 2 days. Request a refill or book a follow-up consultation.`,
          channels: ["in_app", "email", "sms"],
          data: {
            entityType: "prescription",
            entityId: pres._id,
            deepLink: "/recovery-plan",
            metadata: {
              drug: drugList,
            },
          },
        });
      }
    }
  } catch (err) {
    console.error("[RecoveryCron] Refill reminder error:", err.message);
  }
  return summary;
};

/**
 * 6. Medical ID Card Management & Offline Sharing
 */
export const getMedicalId = async (req, res, next) => {
  try {
    let medicalId = await MedicalId.findOne({ userId: req.user._id });
    if (!medicalId) {
      // Auto-initialize with User details
      const user = await User.findById(req.user._id);
      medicalId = await MedicalId.create({
        userId: req.user._id,
        fullName: user?.name || "",
        bloodGroup: user?.bloodGroup || "Unknown",
        emergencyContacts: user?.emergencyContact ? [{ name: "Primary Contact", phone: user.emergencyContact }] : [],
      });
    }

    // Dynamically query active medications from confirmed prescriptions
    const activePrescriptions = await Prescription.find({
      patientId: req.user._id,
      status: "confirmed",
      endDate: { $gte: new Date() },
    }).lean();

    const activeMeds = [];
    activePrescriptions.forEach((p) => {
      p.medications?.forEach((m) => {
        activeMeds.push({
          drug: m.drug,
          strength: m.strength,
          frequency: m.frequency,
        });
      });
    });

    const result = {
      ...medicalId.toObject(),
      activeMedications: activeMeds.length > 0 ? activeMeds : medicalId.activeMedications,
    };

    return req.http.ok(result, "Medical ID retrieved.");
  } catch (err) {
    next(err);
  }
};

export const updateMedicalId = async (req, res, next) => {
  try {
    const { bloodGroup, allergies, chronicConditions, emergencyContacts, organDonor, notes } =
      req.body;

    let medicalId = await MedicalId.findOne({ userId: req.user._id });
    if (!medicalId) {
      medicalId = new MedicalId({ userId: req.user._id });
    }

    if (bloodGroup) medicalId.bloodGroup = bloodGroup;
    if (Array.isArray(allergies)) medicalId.allergies = allergies;
    if (Array.isArray(chronicConditions)) medicalId.chronicConditions = chronicConditions;
    if (Array.isArray(emergencyContacts)) medicalId.emergencyContacts = emergencyContacts;
    if (organDonor !== undefined) medicalId.organDonor = organDonor;
    if (notes !== undefined) medicalId.notes = notes;

    await medicalId.save();
    return req.http.ok(medicalId, "Medical ID updated successfully.");
  } catch (err) {
    next(err);
  }
};

export const generateShareableMedicalIdToken = async (req, res, next) => {
  try {
    let medicalId = await MedicalId.findOne({ userId: req.user._id });
    if (!medicalId) {
      medicalId = await MedicalId.create({ userId: req.user._id });
    }

    // 24 hour expiry token
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    medicalId.shareableTokens.push({
      token,
      expiresAt,
      isRevoked: false,
    });
    await medicalId.save();

    const shareUrl = `/medical-id/share/${token}`;
    return req.http.created(
      { token, expiresAt, shareUrl },
      "Shareable medical ID link generated (valid 24h)."
    );
  } catch (err) {
    next(err);
  }
};

export const getPublicMedicalId = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return req.http.badRequest("Token is required.");

    const medicalId = await MedicalId.findOne({
      "shareableTokens.token": token,
    }).populate("userId", "name");

    if (!medicalId) return req.http.notFound("Invalid or expired Medical ID token.");

    const tokenEntry = medicalId.shareableTokens.find((t) => t.token === token);
    if (!tokenEntry || tokenEntry.isRevoked || new Date(tokenEntry.expiresAt) < new Date()) {
      return req.http.forbidden("This Medical ID link has expired or has been revoked.");
    }

    // Return minimal, vital emergency details (privacy preserving)
    const publicProfile = {
      fullName: medicalId.fullName || medicalId.userId?.name || "Patient",
      bloodGroup: medicalId.bloodGroup,
      allergies: medicalId.allergies,
      chronicConditions: medicalId.chronicConditions,
      emergencyContacts: medicalId.emergencyContacts,
      activeMedications: medicalId.activeMedications,
      organDonor: medicalId.organDonor,
      notes: medicalId.notes,
      expiresAt: tokenEntry.expiresAt,
    };

    return req.http.ok(publicProfile, "Public Emergency Medical ID retrieved.");
  } catch (err) {
    next(err);
  }
};

export const revokeMedicalIdToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const medicalId = await MedicalId.findOne({ userId: req.user._id });
    if (!medicalId) return req.http.notFound("Medical ID not found.");

    const entry = medicalId.shareableTokens.find((t) => t.token === token);
    if (entry) {
      entry.isRevoked = true;
      await medicalId.save();
    }

    return req.http.ok({ revoked: true }, "Access token revoked successfully.");
  } catch (err) {
    next(err);
  }
};
