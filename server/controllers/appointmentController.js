import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import DoctorLeave from "../models/DoctorLeave.js";
import User from "../models/User.js";
import PaymentRecord from "../models/PaymentRecord.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { sendBookingConfirmation, sendCancellationEmail, sendRescheduledEmail } from "../service/emailService.js";
import { sendNotificationToUser, triggerDashboardUpdate } from "../socket.js";
import { dispatchNotification, EVENT_TYPES } from "../services/centralNotificationService.js";
import { refundPayment } from "./paymentController.js";

const formatDate = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
};

// ── SERVER-SIDE CONFLICT DETECTION HELPER ──────────────────────────────────
export const checkDoctorConflicts = async ({
  doctorId,
  appointmentDate,
  appointmentTime,
  excludeAppointmentId = null,
}) => {
  const [year, month, day] = typeof appointmentDate === "string" && appointmentDate.includes("-")
    ? appointmentDate.split("T")[0].split("-").map(Number)
    : [
        new Date(appointmentDate).getFullYear(),
        new Date(appointmentDate).getMonth() + 1,
        new Date(appointmentDate).getDate(),
      ];

  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  // 1. Check if doctor is on approved leave on this date
  const leave = await DoctorLeave.findOne({
    doctorId,
    status: "approved",
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  });

  if (leave) {
    return {
      conflict: true,
      reason: `Dr. is unavailable on this date (${leave.type}: ${leave.reason}). Please choose another date.`,
    };
  }

  // 2. Check if doctor already has an active appointment at that exact slot
  const query = {
    doctorId,
    appointmentTime,
    status: { $in: ["pending", "confirmed", "waiting", "called", "in_consultation"] },
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const existingAppt = await Appointment.findOne(query);
  if (existingAppt) {
    return {
      conflict: true,
      reason: `Doctor already has an active appointment scheduled at ${appointmentTime} on this date. Please pick a different slot.`,
    };
  }

  return { conflict: false };
};

// BOOK APPOINTMENT (patient only)
export const bookAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, appointmentTime } = req.body;

    // Check for double-booking or doctor leave
    const conflictCheck = await checkDoctorConflicts({
      doctorId,
      appointmentDate,
      appointmentTime,
    });

    if (conflictCheck.conflict) {
      return req.http.conflict(conflictCheck.reason);
    }

    const appointment = await Appointment.create({
      ...req.body,
      patientId: req.user._id,
    });

    // Record audit log
    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "appointment",
      resourceId: appointment._id,
      after: appointment.toObject(),
      req,
    });

    // Send confirmation email (non-blocking)
    try {
      const populated = await Appointment.findById(appointment._id)
        .populate("patientId", "name email")
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

      await sendBookingConfirmation({
        patientName:  populated.patientId?.name,
        patientEmail: populated.patientId?.email,
        doctorName:   populated.doctorId?.userId?.name,
        date:         populated.appointmentDate,
        time:         populated.appointmentTime,
        amount:       populated.amount,
      });

      // Emit real-time notification to the Doctor
      if (populated.doctorId?.userId?._id) {
        sendNotificationToUser(populated.doctorId.userId._id, {
          type: "NEW_APPOINTMENT",
          title: "New Appointment Booked",
          message: `${populated.patientId?.name || "A patient"} booked a slot on ${new Date(populated.appointmentDate).toLocaleDateString()} at ${populated.appointmentTime}.`
        });
        triggerDashboardUpdate(populated.doctorId.userId._id, "A new appointment was booked");
      }
    } catch (emailErr) {
      console.warn("[Email/Socket] Notification failed:", emailErr.message);
    }

    return req.http.created(appointment, "Appointment booked successfully");
  } catch (err) {
    next(err);
  }
};

// GET APPOINTMENTS (role-scoped, with calendar & date filtering)
export const getAppointments = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    } else if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc) return req.http.ok([], "No appointments found");
      query.doctorId = doctorDoc._id;
    } else if (req.query.doctorId) {
      query.doctorId = req.query.doctorId;
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Specific Date filter (e.g. YYYY-MM-DD for Calendar day view)
    if (req.query.date) {
      const [y, m, d] = req.query.date.split("-").map(Number);
      const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
      const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
      query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (req.query.startDate && req.query.endDate) {
      // Date range filter (e.g. for Week view)
      const start = new Date(req.query.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: start, $lte: end };
    }

    const limit = parseInt(req.query.limit) || 100;

    const appointments = await Appointment.find(query)
      .populate("patientId", "name email phone dob gender bloodGroup emergencyContact profilePicture dependents")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email" } })
      .sort({ appointmentDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Privacy Mask: Hide patient phone from doctors until appointment is completed
    if (req.user.role === "doctor") {
      appointments.forEach((appt) => {
        if (appt.patientId && appt.status !== "completed") {
          appt.patientId.phone = "🔒 Hidden for privacy";
        }
      });
    }

    return req.http.ok(appointments);
  } catch (err) {
    next(err);
  }
};

// UPDATE APPOINTMENT (doctor or admin only)
export const updateAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    const updateData = { ...req.body };
    if (updateData.status === "completed") {
      updateData.paymentStatus = "paid";
    }

    const updated = await Appointment.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate("patientId", "name")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    if (updateData.status && updated.patientId) {
      sendNotificationToUser(updated.patientId._id, {
        type: "STATUS_UPDATE",
        title: `Appointment ${updated.status}`,
        message: `Your appointment with Dr. ${updated.doctorId?.userId?.name || "your doctor"} has been ${updated.status}.`
      });
    }

    if (updated.doctorId?.userId) {
      triggerDashboardUpdate(updated.doctorId.userId, `Appointment status changed to ${updated.status}`);
    }

    return req.http.ok(updated, "Appointment updated");
  } catch (err) {
    next(err);
  }
};

// SUBMIT FEEDBACK (patient only)
export const submitFeedback = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) return req.http.notFound("Appointment not found");

    if (String(appointment.patientId) !== String(req.user._id)) {
      return req.http.forbidden("You can only submit feedback for your own appointments.");
    }

    if (appointment.status !== "completed") {
      return req.http.badRequest("Feedback can only be submitted for completed appointments.");
    }

    appointment.rating = rating;
    appointment.review = review;
    await appointment.save();

    return req.http.ok(appointment, "Feedback submitted successfully");
  } catch (err) {
    next(err);
  }
};

// RESCHEDULE APPOINTMENT (patient, doctor, or admin)
export const rescheduleAppointment = async (req, res, next) => {
  try {
    const { appointmentDate, appointmentTime, reason = "" } = req.body;
    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });
    if (!appointment) return req.http.notFound("Appointment not found");

    const isPatient = req.user.role === "patient";
    const isDoctor = req.user.role === "doctor";

    // Guard: Patient can only reschedule their own pending/confirmed appointments
    if (isPatient) {
      if (String(appointment.patientId?._id || appointment.patientId) !== String(req.user._id)) {
        return req.http.forbidden("You can only reschedule your own appointments.");
      }
      if (!["pending", "confirmed"].includes(appointment.status)) {
        return req.http.badRequest("Only pending or confirmed appointments can be rescheduled.");
      }

      // Notice window: at least 2 hours before scheduled time
      const apptDate = new Date(appointment.appointmentDate);
      if (appointment.appointmentTime) {
        const parts = appointment.appointmentTime.split(" ");
        const timePart = parts[0] || "00:00";
        const ampm = parts[1] ? parts[1].toUpperCase() : "";
        let [hh, mm] = timePart.split(":").map(Number);
        if (ampm === "PM" && hh < 12) hh += 12;
        if (ampm === "AM" && hh === 12) hh = 0;
        apptDate.setHours(hh || 0, mm || 0, 0, 0);
      }
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (apptDate.getTime() - Date.now() < twoHoursMs) {
        return req.http.badRequest("Appointments cannot be rescheduled less than 2 hours before the scheduled time.");
      }

      // Max reschedules check
      if ((appointment.rescheduleCount || 0) >= 3) {
        return req.http.badRequest("Maximum reschedule limit (3 times) has been reached for this appointment.");
      }
    }

    // Guard: Doctor can only reschedule their own clinic's appointments
    if (isDoctor) {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId?._id || appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    // Server-side conflict detection on new date & time
    const docId = appointment.doctorId?._id || appointment.doctorId;
    const conflictCheck = await checkDoctorConflicts({
      doctorId: docId,
      appointmentDate,
      appointmentTime,
      excludeAppointmentId: appointment._id,
    });

    if (conflictCheck.conflict) {
      return req.http.conflict(conflictCheck.reason);
    }

    const before = appointment.toObject();

    // Check if doctor requires approval for patient reschedules
    if (isPatient && appointment.rescheduleApprovalRequired) {
      appointment.rescheduleStatus = "pending_doctor_approval";
      appointment.proposedChange = {
        date: new Date(appointmentDate),
        timeSlot: appointmentTime,
        requestedBy: req.user._id,
        reason: reason || "Patient requested reschedule",
        requestedAt: new Date(),
      };
      if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
      appointment.changeHistory.push({
        changedBy: req.user._id,
        actorRole: "patient",
        changeType: "reschedule_requested",
        before: {
          date: before.appointmentDate,
          timeSlot: before.appointmentTime,
          status: before.status,
        },
        after: {
          date: new Date(appointmentDate),
          timeSlot: appointmentTime,
          status: before.status,
        },
        reason: reason || "Reschedule requested by patient",
        timestamp: new Date(),
      });
      await appointment.save();

      // Notify Doctor
      const doctorUserId = appointment.doctorId?.userId?._id || appointment.doctorId?.userId;
      if (doctorUserId) {
        await dispatchNotification({
          userId: doctorUserId,
          eventType: EVENT_TYPES.APPOINTMENT_RESCHEDULE_REQUESTED,
          title: "Reschedule Requested",
          message: `${appointment.patientId?.name || "Patient"} requested to reschedule appointment to ${formatDate(appointmentDate)} at ${appointmentTime}.`,
          channels: ["in_app", "email"],
          data: {
            entityType: "appointment",
            entityId: appointment._id,
            deepLink: "/doctor/dashboard",
            metadata: {
              proposedDate: appointmentDate,
              proposedTime: appointmentTime,
              reason,
            },
          },
        });
      }

      return req.http.ok(appointment, "Reschedule request submitted for doctor approval.");
    }

    // Direct reschedule
    appointment.appointmentDate = new Date(appointmentDate);
    appointment.appointmentTime = appointmentTime;
    appointment.rescheduleCount = (appointment.rescheduleCount || 0) + 1;
    appointment.rescheduleStatus = "approved";
    appointment.reminderSent24h = false;
    appointment.reminderSent1h = false;
    if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
    appointment.changeHistory.push({
      changedBy: req.user._id,
      actorRole: req.user.role,
      changeType: "rescheduled",
      before: {
        date: before.appointmentDate,
        timeSlot: before.appointmentTime,
        status: before.status,
        paymentStatus: before.paymentStatus,
        amount: before.amount,
      },
      after: {
        date: appointment.appointmentDate,
        timeSlot: appointment.appointmentTime,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        amount: appointment.amount,
      },
      reason: reason || `Rescheduled by ${req.user.role}`,
      timestamp: new Date(),
    });
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "reschedule",
      resource: "appointment",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });

    // Send multi-channel notification to opposite party
    const targetUserId = isPatient
      ? populated.doctorId?.userId?._id || populated.doctorId?.userId
      : populated.patientId?._id || populated.patientId;

    const actorName = isPatient
      ? populated.patientId?.name || "Patient"
      : `Dr. ${populated.doctorId?.userId?.name || "Doctor"}`;
    const diffMsg = `${actorName} rescheduled appointment from ${formatDate(before.appointmentDate)} ${before.appointmentTime} to ${formatDate(appointment.appointmentDate)} ${appointment.appointmentTime}.`;

    if (targetUserId) {
      await dispatchNotification({
        userId: targetUserId,
        eventType: EVENT_TYPES.APPOINTMENT_RESCHEDULED,
        title: "Appointment Rescheduled",
        message: diffMsg,
        channels: ["in_app", "email", "sms"],
        data: {
          entityType: "appointment",
          entityId: appointment._id,
          deepLink: isPatient ? "/doctor/dashboard" : "/appointments",
          metadata: {
            actorName,
            oldDate: formatDate(before.appointmentDate),
            oldTime: before.appointmentTime,
            newDate: formatDate(appointment.appointmentDate),
            newTime: appointment.appointmentTime,
            reason,
          },
        },
      });
    }

    try {
      await sendRescheduledEmail({
        patientName: populated.patientId?.name,
        patientEmail: populated.patientId?.email,
        doctorName: populated.doctorId?.userId?.name,
        date: populated.appointmentDate,
        time: populated.appointmentTime,
      });

      if (targetUserId) {
        sendNotificationToUser(targetUserId, {
          type: "RESCHEDULED",
          title: "Appointment Rescheduled",
          message: diffMsg,
        });
      }
    } catch (err) {
      console.warn("Notifications for reschedule failed:", err.message);
    }

    return req.http.ok(populated, "Appointment rescheduled successfully");
  } catch (err) {
    next(err);
  }
};

// RESCHEDULE DECISION (doctor or clinic_admin approves/rejects patient request)
export const rescheduleDecision = async (req, res, next) => {
  try {
    const { action, reason = "" } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return req.http.badRequest("Invalid decision action. Must be 'approve' or 'reject'.");
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId?._id || appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    if (appointment.rescheduleStatus !== "pending_doctor_approval" || !appointment.proposedChange?.date) {
      return req.http.badRequest("No pending reschedule request found for this appointment.");
    }

    const before = appointment.toObject();

    if (action === "approve") {
      const docId = appointment.doctorId?._id || appointment.doctorId;
      const conflictCheck = await checkDoctorConflicts({
        doctorId: docId,
        appointmentDate: appointment.proposedChange.date,
        appointmentTime: appointment.proposedChange.timeSlot,
        excludeAppointmentId: appointment._id,
      });

      if (conflictCheck.conflict) {
        return req.http.conflict("Cannot approve reschedule: " + conflictCheck.reason);
      }

      appointment.appointmentDate = appointment.proposedChange.date;
      appointment.appointmentTime = appointment.proposedChange.timeSlot;
      appointment.rescheduleCount = (appointment.rescheduleCount || 0) + 1;
      appointment.rescheduleStatus = "approved";
      appointment.reminderSent24h = false;
      appointment.reminderSent1h = false;
      if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
      appointment.changeHistory.push({
        changedBy: req.user._id,
        actorRole: req.user.role,
        changeType: "reschedule_approved",
        before: {
          date: before.appointmentDate,
          timeSlot: before.appointmentTime,
          status: before.status,
        },
        after: {
          date: appointment.appointmentDate,
          timeSlot: appointment.appointmentTime,
          status: appointment.status,
        },
        reason: reason || "Doctor approved reschedule request",
        timestamp: new Date(),
      });
      await appointment.save();

      const patientUserId = appointment.patientId?._id || appointment.patientId;
      if (patientUserId) {
        await dispatchNotification({
          userId: patientUserId,
          eventType: EVENT_TYPES.APPOINTMENT_RESCHEDULED,
          title: "Reschedule Request Approved",
          message: `Dr. ${appointment.doctorId?.userId?.name || "your doctor"} approved your reschedule to ${formatDate(appointment.appointmentDate)} at ${appointment.appointmentTime}.`,
          channels: ["in_app", "email", "sms"],
          data: {
            entityType: "appointment",
            entityId: appointment._id,
            deepLink: "/appointments",
            metadata: {
              actorName: `Dr. ${appointment.doctorId?.userId?.name || "Doctor"}`,
              oldDate: formatDate(before.appointmentDate),
              oldTime: before.appointmentTime,
              newDate: formatDate(appointment.appointmentDate),
              newTime: appointment.appointmentTime,
            },
          },
        });
      }

      return req.http.ok(appointment, "Reschedule request approved successfully");
    } else {
      appointment.rescheduleStatus = "rejected";
      if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
      appointment.changeHistory.push({
        changedBy: req.user._id,
        actorRole: req.user.role,
        changeType: "reschedule_rejected",
        before: {
          date: before.appointmentDate,
          timeSlot: before.appointmentTime,
        },
        after: {
          date: before.appointmentDate,
          timeSlot: before.appointmentTime,
        },
        reason: reason || "Doctor declined reschedule request",
        timestamp: new Date(),
      });
      await appointment.save();

      const patientUserId = appointment.patientId?._id || appointment.patientId;
      if (patientUserId) {
        await dispatchNotification({
          userId: patientUserId,
          eventType: EVENT_TYPES.APPOINTMENT_RESCHEDULED,
          title: "Reschedule Request Declined",
          message: `Dr. ${appointment.doctorId?.userId?.name || "your doctor"} was unable to accommodate the requested time. Your appointment remains on ${formatDate(appointment.appointmentDate)} at ${appointment.appointmentTime}.${reason ? " Reason: " + reason : ""}`,
          channels: ["in_app", "email"],
          data: {
            entityType: "appointment",
            entityId: appointment._id,
            deepLink: "/appointments",
            metadata: { reason },
          },
        });
      }

      return req.http.ok(appointment, "Reschedule request declined");
    }
  } catch (err) {
    next(err);
  }
};

// ADD PRESCRIPTION (doctor only)
export const addPrescription = async (req, res, next) => {
  try {
    const { prescription } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    // Guard: only the assigned doctor can add a prescription
    const doctorDoc = await Doctor.findOne({ userId: req.user._id });
    if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
      return req.http.forbidden("You can only prescribe for your own appointments.");
    }

    appointment.prescription = prescription;
    appointment.status = "completed"; // auto-complete if prescription is uploaded
    appointment.paymentStatus = "paid";
    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate("patientId", "name")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    // Socket notification
    if (populated.patientId?._id) {
      sendNotificationToUser(populated.patientId._id, {
        type: "PRESCRIPTION_ADDED",
        title: "Prescription Added",
        message: `Dr. ${populated.doctorId?.userId?.name || "your doctor"} uploaded a prescription for your appointment.`
      });
    }

    return req.http.ok(populated, "Prescription uploaded successfully");
  } catch (err) {
    next(err);
  }
};

// MARK NO-SHOW (doctor, receptionist, admin)
export const markNoShow = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    const before = appointment.toObject();
    appointment.status = "no_show";
    appointment.queueStatus = "skipped";
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "appointment",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    if (appointment.patientId) {
      sendNotificationToUser(appointment.patientId, {
        type: "STATUS_UPDATE",
        title: "Appointment Marked No-Show",
        message: "Your appointment has been marked as No-Show. Please contact reception to reschedule.",
      });
    }

    return req.http.ok(appointment, "Appointment marked as No-Show");
  } catch (err) {
    next(err);
  }
};

// CANCEL APPOINTMENT (with mandatory reason, refund, changeHistory, and audit log)
export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "patient") {
      if (String(appointment.patientId?._id || appointment.patientId) !== String(req.user._id)) {
        return req.http.forbidden("You can only cancel your own appointments.");
      }
      if (!["pending", "confirmed"].includes(appointment.status)) {
        return req.http.badRequest("Only pending or confirmed appointments can be cancelled.");
      }
    }

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId?._id || appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    const reason = req.body.cancellationReason || req.body.reason;
    if (!reason || !reason.trim()) {
      return req.http.badRequest("A cancellation reason is required.");
    }

    // If payment status is paid, trigger a refund
    if (appointment.paymentStatus === "paid") {
      const refundSuccess = await refundPayment(appointment._id);
      if (refundSuccess) {
        appointment.paymentStatus = "refunded";
      }
    }

    const before = appointment.toObject();
    appointment.status = "cancelled";
    appointment.cancellationReason = reason.trim();
    appointment.cancelledBy = req.user._id;
    appointment.cancelledAt = new Date();

    if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
    appointment.changeHistory.push({
      changedBy: req.user._id,
      actorRole: req.user.role,
      changeType: "cancelled",
      before: {
        date: before.appointmentDate,
        timeSlot: before.appointmentTime,
        status: before.status,
        paymentStatus: before.paymentStatus,
      },
      after: {
        date: appointment.appointmentDate,
        timeSlot: appointment.appointmentTime,
        status: "cancelled",
        paymentStatus: appointment.paymentStatus,
      },
      reason: reason.trim(),
      timestamp: new Date(),
    });

    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "cancel",
      resource: "appointment",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    const isPatient = req.user.role === "patient";
    const targetUserId = isPatient
      ? appointment.doctorId?.userId?._id || appointment.doctorId?.userId
      : appointment.patientId?._id || appointment.patientId;

    const actorName = isPatient
      ? appointment.patientId?.name || "Patient"
      : `Dr. ${appointment.doctorId?.userId?.name || "Doctor"}`;

    if (targetUserId) {
      await dispatchNotification({
        userId: targetUserId,
        eventType: EVENT_TYPES.APPOINTMENT_CANCELLED,
        title: "Appointment Cancelled",
        message: `${actorName} cancelled the appointment for ${formatDate(appointment.appointmentDate)} at ${appointment.appointmentTime}. Reason: ${reason.trim()}`,
        channels: ["in_app", "email", "sms"],
        data: {
          entityType: "appointment",
          entityId: appointment._id,
          deepLink: isPatient ? "/doctor/dashboard" : "/appointments",
          metadata: {
            actorName,
            date: formatDate(appointment.appointmentDate),
            time: appointment.appointmentTime,
            reason: reason.trim(),
          },
        },
      });
    }

    try {
      await sendCancellationEmail({
        patientName:  appointment.patientId?.name,
        patientEmail: appointment.patientId?.email,
        doctorName:   appointment.doctorId?.userId?.name,
        date:         appointment.appointmentDate,
        time:         appointment.appointmentTime,
      });

      if (targetUserId) {
        sendNotificationToUser(targetUserId, {
          type: "CANCEL_APPOINTMENT",
          title: "Appointment Cancelled",
          message: `${actorName} cancelled the appointment for ${formatDate(appointment.appointmentDate)}. Reason: ${reason.trim()}`
        });
      }
    } catch (emailErr) {
      console.warn("[Email/Socket] Notification failed:", emailErr.message);
    }

    return req.http.ok(appointment, "Appointment cancelled successfully");
  } catch (err) {
    next(err);
  }
};

// DOCTOR ACTIVITY FEED (rescheduled, cancelled, booked, payment marked timeline)
export const getDoctorActivityFeed = async (req, res, next) => {
  try {
    let doctorId = null;
    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc) return req.http.ok({ feed: [], count: 0 });
      doctorId = doctorDoc._id;
    } else if (req.query.doctorId && ["admin", "clinic_admin"].includes(req.user.role)) {
      doctorId = req.query.doctorId;
    } else {
      return req.http.forbidden("Doctor access required");
    }

    const filterType = req.query.type; // "rescheduled", "cancelled", "booked", "all"
    const limit = parseInt(req.query.limit) || 50;

    const appointments = await Appointment.find({ doctorId })
      .populate("patientId", "name email phone")
      .populate("changeHistory.changedBy", "name role")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const feedEvents = [];

    appointments.forEach((appt) => {
      // 1. Initial booking event
      if (!filterType || filterType === "all" || filterType === "booked") {
        feedEvents.push({
          id: `book-${appt._id}`,
          appointmentId: appt._id,
          patientName: appt.patientId?.name || "Patient",
          type: "booked",
          title: "New Appointment Booked",
          description: `Booked for ${formatDate(appt.appointmentDate)} at ${appt.appointmentTime}`,
          amount: appt.amount,
          paymentStatus: appt.paymentStatus,
          timestamp: appt.createdAt,
          actor: appt.patientId?.name || "Patient",
        });
      }

      // 2. Change history events
      if (Array.isArray(appt.changeHistory)) {
        appt.changeHistory.forEach((item, index) => {
          if (filterType && filterType !== "all" && item.changeType !== filterType) {
            return;
          }

          let title = "Appointment Updated";
          let desc = item.reason || "";
          if (item.changeType === "rescheduled") {
            title = "Appointment Rescheduled";
            desc = `Changed from ${formatDate(item.before?.date)} ${item.before?.timeSlot || ""} to ${formatDate(item.after?.date)} ${item.after?.timeSlot || ""}${item.reason ? " (" + item.reason + ")" : ""}`;
          } else if (item.changeType === "cancelled") {
            title = "Appointment Cancelled";
            desc = `Reason: ${item.reason || "No reason specified"}`;
          } else if (item.changeType === "reschedule_requested") {
            title = "Reschedule Requested";
            desc = `Patient requested ${formatDate(item.after?.date)} ${item.after?.timeSlot || ""}`;
          } else if (item.changeType === "reschedule_approved") {
            title = "Reschedule Approved";
            desc = `New slot confirmed: ${formatDate(item.after?.date)} ${item.after?.timeSlot || ""}`;
          } else if (item.changeType === "reschedule_rejected") {
            title = "Reschedule Declined";
            desc = `Request declined: ${item.reason || "Slot unavailable"}`;
          } else if (item.changeType === "payment_marked") {
            title = "Payment Recorded (Offline)";
            desc = `Amount: ₹${item.after?.amount || appt.amount} (${item.after?.paymentMode || appt.paymentMode})`;
          } else if (item.changeType === "payment_corrected") {
            title = "Payment Adjusted";
            desc = `Updated to ₹${item.after?.amount || appt.amount}. Reason: ${item.reason || ""}`;
          } else if (item.changeType === "payment_disputed") {
            title = "Payment Disputed by Patient";
            desc = `Patient disputed amount: ${item.reason || ""}`;
          }

          feedEvents.push({
            id: `chg-${appt._id}-${index}`,
            appointmentId: appt._id,
            patientName: appt.patientId?.name || "Patient",
            type: item.changeType,
            title,
            description: desc,
            before: item.before,
            after: item.after,
            reason: item.reason,
            actorRole: item.actorRole,
            actor: item.changedBy?.name || item.actorRole,
            timestamp: item.timestamp,
          });
        });
      }
    });

    feedEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const sliced = feedEvents.slice(0, limit);

    return req.http.ok({ feed: sliced, count: sliced.length });
  } catch (err) {
    next(err);
  }
};

// MARK OFFLINE PAYMENT (doctor / receptionist / admin)
export const markOfflinePayment = async (req, res, next) => {
  try {
    const { amount, paymentMode, notes = "", referenceNumber = "" } = req.body;
    if (!amount || amount <= 0) return req.http.badRequest("A valid payment amount is required.");
    if (!["cash", "upi_clinic", "card_clinic", "other"].includes(paymentMode)) {
      return req.http.badRequest("Invalid offline payment mode. Must be cash, upi_clinic, card_clinic, or other.");
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId?._id || appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only record payments for your own appointments.");
      }
    }

    const before = appointment.toObject();
    const docId = appointment.doctorId?._id || appointment.doctorId;

    // Create PaymentRecord
    const paymentRecord = await PaymentRecord.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId?._id || appointment.patientId,
      doctorId: docId,
      amount: Number(amount),
      paymentMode,
      paymentStatus: "paid",
      transactionReference: referenceNumber,
      markedBy: req.user._id,
      markedRole: req.user.role,
      notes,
    });

    // Update Appointment
    appointment.paymentStatus = "paid";
    appointment.paymentMode = paymentMode;
    appointment.amountPaid = Number(amount);
    appointment.amountDue = Math.max(0, (appointment.amount || 0) - Number(amount));
    appointment.offlinePaymentReceipt = paymentRecord.receiptNumber;
    appointment.paymentMarkedBy = req.user._id;
    appointment.paymentMarkedAt = new Date();

    if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
    appointment.changeHistory.push({
      changedBy: req.user._id,
      actorRole: req.user.role,
      changeType: "payment_marked",
      before: {
        paymentStatus: before.paymentStatus,
        paymentMode: before.paymentMode,
        amount: before.amountPaid || 0,
      },
      after: {
        paymentStatus: "paid",
        paymentMode,
        amount: Number(amount),
      },
      reason: `Offline payment marked via ${paymentMode}${notes ? ': ' + notes : ''}`,
      timestamp: new Date(),
    });
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "payment_marked_offline",
      resource: "appointment",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    // Notify patient
    const patientUserId = appointment.patientId?._id || appointment.patientId;
    if (patientUserId) {
      const doctorName = appointment.doctorId?.userId?.name || "Clinic";
      await dispatchNotification({
        userId: patientUserId,
        eventType: EVENT_TYPES.PAYMENT_MARKED_OFFLINE,
        title: "Payment Recorded",
        message: `${doctorName} marked payment of ₹${amount} (${paymentMode.replace('_', ' ')}) as received for appointment on ${formatDate(appointment.appointmentDate)}. Receipt #${paymentRecord.receiptNumber}.`,
        channels: ["in_app", "email", "sms"],
        data: {
          entityType: "payment",
          entityId: paymentRecord._id,
          deepLink: "/appointments",
          metadata: {
            doctorName,
            amount: Number(amount),
            mode: paymentMode.replace('_', ' '),
            date: formatDate(appointment.appointmentDate),
            receiptNumber: paymentRecord.receiptNumber,
          },
        },
      });
    }

    return req.http.ok({ appointment, paymentRecord }, "Offline payment recorded successfully");
  } catch (err) {
    next(err);
  }
};

// CORRECT PAYMENT (doctor or admin adjusts payment with mandatory audit reason)
export const correctPayment = async (req, res, next) => {
  try {
    const { newAmount, newMode, reason } = req.body;
    if (!reason || !reason.trim()) {
      return req.http.badRequest("A mandatory reason is required to correct a payment record.");
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId?._id || appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    let paymentRecord = await PaymentRecord.findOne({ appointmentId: appointment._id }).sort({ createdAt: -1 });
    const before = appointment.toObject();

    const prevAmount = paymentRecord ? paymentRecord.amount : appointment.amountPaid;
    const prevMode = paymentRecord ? paymentRecord.paymentMode : appointment.paymentMode;

    if (paymentRecord) {
      paymentRecord.corrections.push({
        correctedBy: req.user._id,
        role: req.user.role,
        previousAmount: prevAmount,
        newAmount: newAmount !== undefined ? Number(newAmount) : prevAmount,
        previousMode: prevMode,
        newMode: newMode || prevMode,
        reason: reason.trim(),
        correctedAt: new Date(),
      });
      if (newAmount !== undefined) paymentRecord.amount = Number(newAmount);
      if (newMode) paymentRecord.paymentMode = newMode;
      paymentRecord.paymentStatus = "corrected";
      await paymentRecord.save();
    }

    if (newAmount !== undefined) {
      appointment.amountPaid = Number(newAmount);
      appointment.amountDue = Math.max(0, (appointment.amount || 0) - Number(newAmount));
    }
    if (newMode) appointment.paymentMode = newMode;

    if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
    appointment.changeHistory.push({
      changedBy: req.user._id,
      actorRole: req.user.role,
      changeType: "payment_corrected",
      before: {
        amount: prevAmount,
        paymentMode: prevMode,
      },
      after: {
        amount: appointment.amountPaid,
        paymentMode: appointment.paymentMode,
      },
      reason: reason.trim(),
      timestamp: new Date(),
    });
    await appointment.save();

    // Notify patient
    const patientUserId = appointment.patientId?._id || appointment.patientId;
    if (patientUserId) {
      await dispatchNotification({
        userId: patientUserId,
        eventType: EVENT_TYPES.PAYMENT_CORRECTED,
        title: "Payment Record Adjusted",
        message: `Payment record for appointment on ${formatDate(appointment.appointmentDate)} was updated to ₹${appointment.amountPaid}. Reason: ${reason.trim()}`,
        channels: ["in_app", "email"],
        data: {
          entityType: "payment",
          entityId: paymentRecord?._id || appointment._id,
          deepLink: "/appointments",
          metadata: {
            date: formatDate(appointment.appointmentDate),
            amount: appointment.amountPaid,
            reason: reason.trim(),
          },
        },
      });
    }

    return req.http.ok({ appointment, paymentRecord }, "Payment record corrected successfully");
  } catch (err) {
    next(err);
  }
};

// DISPUTE PAYMENT (patient disputes offline marked payment)
export const disputePayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return req.http.badRequest("Dispute reason is required.");
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });
    if (!appointment) return req.http.notFound("Appointment not found");

    if (String(appointment.patientId?._id || appointment.patientId) !== String(req.user._id)) {
      return req.http.forbidden("You can only dispute payments for your own appointments.");
    }

    let paymentRecord = await PaymentRecord.findOne({ appointmentId: appointment._id }).sort({ createdAt: -1 });
    if (paymentRecord) {
      paymentRecord.dispute = {
        isDisputed: true,
        reason: reason.trim(),
        disputedBy: req.user._id,
        disputedAt: new Date(),
        resolution: "open",
      };
      paymentRecord.paymentStatus = "disputed";
      await paymentRecord.save();
    }

    if (!Array.isArray(appointment.changeHistory)) appointment.changeHistory = [];
    appointment.changeHistory.push({
      changedBy: req.user._id,
      actorRole: "patient",
      changeType: "payment_disputed",
      reason: reason.trim(),
      timestamp: new Date(),
    });
    await appointment.save();

    // Notify doctor
    const doctorUserId = appointment.doctorId?.userId?._id || appointment.doctorId?.userId;
    if (doctorUserId) {
      await dispatchNotification({
        userId: doctorUserId,
        eventType: EVENT_TYPES.PAYMENT_DISPUTED,
        title: "Payment Dispute Raised",
        message: `Patient ${appointment.patientId?.name || "Patient"} raised a dispute regarding the marked payment for appointment on ${formatDate(appointment.appointmentDate)}. Reason: ${reason.trim()}`,
        channels: ["in_app", "email"],
        data: {
          entityType: "payment",
          entityId: paymentRecord?._id || appointment._id,
          deepLink: "/doctor/dashboard",
          metadata: {
            patientName: appointment.patientId?.name || "Patient",
            date: formatDate(appointment.appointmentDate),
            amount: appointment.amountPaid || appointment.amount,
            reason: reason.trim(),
          },
        },
      });
    }

    return req.http.ok(appointment, "Payment dispute submitted successfully");
  } catch (err) {
    next(err);
  }
};

// DOCTOR PAYMENTS SUMMARY (online vs offline breakdown, CSV export)
export const getDoctorPaymentsSummary = async (req, res, next) => {
  try {
    let doctorId = null;
    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc) return req.http.ok({ totals: {}, transactions: [] });
      doctorId = doctorDoc._id;
    } else if (req.query.doctorId && ["admin", "clinic_admin"].includes(req.user.role)) {
      doctorId = req.query.doctorId;
    } else {
      return req.http.forbidden("Doctor access required");
    }

    const { format: exportFormat, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const appointments = await Appointment.find({ doctorId, ...dateFilter })
      .populate("patientId", "name email phone")
      .sort({ appointmentDate: -1 })
      .lean();

    let totalRevenue = 0;
    let onlineTotal = 0;
    let cashTotal = 0;
    let upiClinicTotal = 0;
    let upiDirectTotal = 0;
    let cardClinicTotal = 0;
    let unpaidTotal = 0;
    let claimedTotal = 0;
    let claimedCount = 0;
    let duplicateFlaggedTotal = 0;
    let duplicateFlaggedCount = 0;

    const transactions = appointments.map((appt) => {
      const paid = appt.paymentStatus === "paid";
      const isClaimed = appt.paymentStatus === "claimed";
      const isDuplicate = Boolean(appt.duplicatePaymentFlag);
      const amt = paid ? (appt.amountPaid || appt.amount || 0) : 0;

      if (paid) {
        totalRevenue += amt;
        if (appt.paymentMode === "online") onlineTotal += amt;
        else if (appt.paymentMode === "cash") cashTotal += amt;
        else if (appt.paymentMode === "upi_clinic") upiClinicTotal += amt;
        else if (appt.paymentMode === "upi_direct") upiDirectTotal += amt;
        else if (appt.paymentMode === "card_clinic") cardClinicTotal += amt;
      } else if (isClaimed) {
        claimedTotal += (appt.amount || 0);
        claimedCount += 1;
      } else {
        unpaidTotal += (appt.amount || 0);
      }

      if (isDuplicate) {
        duplicateFlaggedCount += 1;
        duplicateFlaggedTotal += (appt.duplicatePaymentReview?.amount || appt.amount || 0);
      }

      return {
        id: appt._id,
        date: formatDate(appt.appointmentDate),
        time: appt.appointmentTime,
        patientName: appt.patientId?.name || "Patient",
        patientPhone: appt.patientId?.phone || "",
        status: appt.status,
        amount: appt.amount,
        amountPaid: appt.amountPaid || (paid ? appt.amount : 0),
        paymentStatus: appt.paymentStatus,
        paymentMode: appt.paymentMode || "none",
        paymentSource: appt.paymentSource || "none",
        receipt: appt.offlinePaymentReceipt || "N/A",
        claimedUtr: appt.claimedPayment?.utr || "",
        duplicatePaymentFlag: isDuplicate,
      };
    });

    if (exportFormat === "csv") {
      const headers = "ID,Date,Time,Patient,Amount,AmountPaid,PaymentStatus,PaymentMode,Source,Receipt,ClaimedUTR,DuplicateFlag\n";
      const rows = transactions.map((t) =>
        `"${t.id}","${t.date}","${t.time}","${t.patientName}",${t.amount},${t.amountPaid},"${t.paymentStatus}","${t.paymentMode}","${t.paymentSource}","${t.receipt}","${t.claimedUtr}",${t.duplicatePaymentFlag ? "YES" : "NO"}`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=Doctor_Payments_${Date.now()}.csv`);
      return res.status(200).send(headers + rows);
    }

    return req.http.ok({
      totals: {
        totalRevenue,
        onlineTotal,
        cashTotal,
        upiClinicTotal,
        upiDirectTotal,
        cardClinicTotal,
        unpaidTotal,
        claimedTotal,
        claimedCount,
        duplicateFlaggedTotal,
        duplicateFlaggedCount,
        totalAppointments: appointments.length,
      },
      transactions,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE APPOINTMENT
export const deleteAppointment = async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return req.http.notFound("Appointment not found");
    return req.http.ok(null, "Appointment deleted");
  } catch (err) {
    next(err);
  }
};

// GET DAILY.CO ROOM URL
export const getAppointmentRoom = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    // Check authorization (patient or doctor of this appointment)
    if (req.user.role === "patient" && String(appointment.patientId) !== String(req.user._id)) {
      return req.http.forbidden("Not authorized to join this room.");
    }
    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("Not authorized to join this room.");
      }
    }

    // In a production app with Daily.co API Key:
    // 1. Check if room exists in DB, if not, create it via Daily.co REST API
    // 2. Return the unique room URL.
    
    // For this portfolio project, we'll return a static demo URL if API key is not present.
    // If you add a Daily.co API Key to .env later, this logic can dynamically create rooms.
    const roomUrl = process.env.DAILY_CO_DEMO_URL || "https://bookdoctordemo.daily.co/demo";
    
    return req.http.ok({ url: roomUrl }, "Room URL generated");
  } catch (err) {
    next(err);
  }
};