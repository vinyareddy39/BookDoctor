import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import DoctorLeave from "../models/DoctorLeave.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { sendBookingConfirmation, sendCancellationEmail, sendRescheduledEmail } from "../service/emailService.js";
import { sendNotificationToUser, triggerDashboardUpdate } from "../socket.js";
import { refundPayment } from "./paymentController.js";

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
    const { appointmentDate, appointmentTime } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    // Guard: Patient can only reschedule their own pending/confirmed appointments
    if (req.user.role === "patient") {
      if (String(appointment.patientId) !== String(req.user._id)) {
        return req.http.forbidden("You can only reschedule your own appointments.");
      }
      if (!["pending", "confirmed"].includes(appointment.status)) {
        return req.http.badRequest("Only pending or confirmed appointments can be rescheduled.");
      }
    }

    // Guard: Doctor can only reschedule their own clinic's appointments
    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    // Server-side conflict detection on new date & time
    const conflictCheck = await checkDoctorConflicts({
      doctorId: appointment.doctorId,
      appointmentDate,
      appointmentTime,
      excludeAppointmentId: appointment._id,
    });

    if (conflictCheck.conflict) {
      return req.http.conflict(conflictCheck.reason);
    }

    const before = appointment.toObject();
    appointment.appointmentDate = appointmentDate;
    appointment.appointmentTime = appointmentTime;
    appointment.rescheduleCount += 1;
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
      .populate("patientId", "name email")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    // Send email notifications
    try {
      await sendRescheduledEmail({
        patientName: populated.patientId?.name,
        patientEmail: populated.patientId?.email,
        doctorName: populated.doctorId?.userId?.name,
        date: populated.appointmentDate,
        time: populated.appointmentTime,
      });

      // Send socket notifications to opposite party
      const notifyTarget = req.user.role === "patient" ? populated.doctorId?.userId?._id : populated.patientId?._id;
      if (notifyTarget) {
        sendNotificationToUser(notifyTarget, {
          type: "RESCHEDULED",
          title: "Appointment Rescheduled",
          message: `The appointment has been rescheduled to ${new Date(populated.appointmentDate).toLocaleDateString()} at ${populated.appointmentTime}.`
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

// CANCEL APPOINTMENT (with reason and audit log)
export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    if (req.user.role === "patient") {
      if (String(appointment.patientId) !== String(req.user._id)) {
        return req.http.forbidden("You can only cancel your own appointments.");
      }
      if (!["pending", "confirmed"].includes(appointment.status)) {
        return req.http.badRequest("Only pending or confirmed appointments can be cancelled.");
      }
    }

    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    const reason = req.body.cancellationReason || req.body.reason || "Cancelled by user";

    // If payment status is paid, trigger a refund
    if (appointment.paymentStatus === "paid") {
      const refundSuccess = await refundPayment(appointment._id);
      if (refundSuccess) {
        appointment.paymentStatus = "refunded";
      }
    }

    const before = appointment.toObject();
    appointment.status = "cancelled";
    appointment.cancellationReason = reason;
    appointment.cancelledBy = req.user._id;
    appointment.cancelledAt = new Date();
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

    try {
      const populated = await Appointment.findById(appointment._id)
        .populate("patientId", "name email")
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

      await sendCancellationEmail({
        patientName:  populated.patientId?.name,
        patientEmail: populated.patientId?.email,
        doctorName:   populated.doctorId?.userId?.name,
        date:         populated.appointmentDate,
        time:         populated.appointmentTime,
      });

      if (req.user.role === "patient") {
        if (populated.doctorId?.userId?._id) {
          sendNotificationToUser(populated.doctorId.userId._id, {
            type: "CANCEL_APPOINTMENT",
            title: "Appointment Cancelled",
            message: `${populated.patientId?.name || "A patient"} cancelled their appointment on ${new Date(populated.appointmentDate).toLocaleDateString()}.`
          });
        }
      } else if (req.user.role === "doctor") {
        if (populated.patientId?._id) {
          sendNotificationToUser(populated.patientId._id, {
            type: "CANCEL_APPOINTMENT",
            title: "Appointment Cancelled",
            message: `Dr. ${populated.doctorId?.userId?.name || "your doctor"} cancelled your appointment on ${new Date(populated.appointmentDate).toLocaleDateString()}.`
          });
        }
      }
    } catch (emailErr) {
      console.warn("[Email/Socket] Notification failed:", emailErr.message);
    }

    return req.http.ok({ status: "cancelled" }, "Appointment cancelled successfully");
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