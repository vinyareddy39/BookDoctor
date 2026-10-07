import Clinic from "../models/Clinic.js";
import { recordAudit } from "../middleware/auditLogger.js";

/**
 * GET /api/clinic
 * Fetches current clinic configuration or creates initial singleton default.
 */
export const getClinicSettings = async (req, res, next) => {
  try {
    let clinic = await Clinic.findOne();
    if (!clinic) {
      clinic = await Clinic.create({
        name: "MedAssist Multi-Specialty Clinic",
        city: "Hyderabad",
      });
    }
    return req.http.ok({ clinic }, "Clinic settings retrieved");
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/clinic
 * Updates clinic configuration (Clinic Admin only).
 */
export const updateClinicSettings = async (req, res, next) => {
  try {
    let clinic = await Clinic.findOne();
    const beforeState = clinic ? clinic.toObject() : null;

    if (!clinic) {
      clinic = new Clinic(req.body);
    } else {
      Object.assign(clinic, req.body);
    }

    await clinic.save();

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "UPDATE",
      resource: "Clinic",
      resourceId: String(clinic._id),
      details: "Updated clinic operating, tax, and billing configurations",
      diff: { before: beforeState, after: clinic.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.ok({ clinic }, "Clinic settings updated successfully");
  } catch (err) {
    next(err);
  }
};
