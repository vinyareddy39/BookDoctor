import Doctor from "../models/Doctor.js";
import DoctorAvailability from "../models/DoctorAvailability.js";
import DoctorLeave from "../models/DoctorLeave.js";
import Appointment from "../models/Appointment.js";
import { recordAudit } from "../middleware/auditLogger.js";

// Helper: parse time strings like "10:00 AM" or "09:00" to minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const ampmMatch = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1]);
    const m = parseInt(ampmMatch[2] || "0");
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = timeStr.match(/(\d+):(\d+)/);
  if (match24) {
    return parseInt(match24[1]) * 60 + parseInt(match24[2]);
  }
  return null;
};

// Helper: format minutes from midnight to "HH:MM AM/PM"
const formatMinutesTo12h = (minutes) => {
  const h24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${ampm}`;
};

// ── GET DOCTOR AVAILABILITY CONFIG ──────────────────────────────────────────
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    let availability = await DoctorAvailability.findOne({ doctorId }).populate({
      path: "doctorId",
      populate: { path: "userId", select: "name email" },
    });

    if (!availability) {
      const doctor = await Doctor.findById(doctorId).populate("userId", "name email");
      if (!doctor) return req.http.notFound("Doctor not found");

      availability = await DoctorAvailability.create({
        doctorId,
        slotDuration: 30,
        maxPatientsPerSlot: 1,
      });
    }

    return req.http.ok(availability);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE DOCTOR AVAILABILITY CONFIG ───────────────────────────────────────
export const updateDoctorAvailability = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { slotDuration, maxPatientsPerSlot, weeklySchedule } = req.body;

    // Permission guard: doctor can only update their own, or admin
    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (!doc || String(doc._id) !== String(doctorId)) {
        return req.http.forbidden("You can only manage your own schedule.");
      }
    }

    const before = await DoctorAvailability.findOne({ doctorId });
    const updated = await DoctorAvailability.findOneAndUpdate(
      { doctorId },
      { slotDuration, maxPatientsPerSlot, weeklySchedule },
      { new: true, upsert: true }
    );

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: before ? "update" : "create",
      resource: "doctor_availability",
      resourceId: updated._id,
      before: before ? before.toObject() : null,
      after: updated.toObject(),
      req,
    });

    return req.http.ok(updated, "Doctor availability updated successfully");
  } catch (err) {
    next(err);
  }
};

// ── GET DOCTOR LEAVES ────────────────────────────────────────────────────────
export const getDoctorLeaves = async (req, res, next) => {
  try {
    const { doctorId, upcomingOnly } = req.query;
    let filter = {};

    if (doctorId) {
      filter.doctorId = doctorId;
    } else if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (doc) filter.doctorId = doc._id;
    }

    if (upcomingOnly === "true") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.endDate = { $gte: today };
    }

    const leaves = await DoctorLeave.find(filter)
      .populate({
        path: "doctorId",
        populate: { path: "userId", select: "name email" },
      })
      .populate("approvedBy", "name")
      .sort({ startDate: 1 });

    return req.http.ok(leaves);
  } catch (err) {
    next(err);
  }
};

// ── ADD DOCTOR LEAVE / EXCEPTION ─────────────────────────────────────────────
export const addDoctorLeave = async (req, res, next) => {
  try {
    const { doctorId, startDate, endDate, reason, type } = req.body;

    let targetDoctorId = doctorId;
    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (!doc) return req.http.badRequest("Doctor profile not found");
      targetDoctorId = doc._id;
    }

    if (!targetDoctorId || !startDate || !endDate || !reason) {
      return req.http.badRequest("Missing required fields: doctorId, startDate, endDate, reason");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return req.http.badRequest("End date cannot be earlier than start date");
    }

    const leave = await DoctorLeave.create({
      doctorId: targetDoctorId,
      startDate: start,
      endDate: end,
      reason,
      type: type || "leave",
      status: "approved",
      approvedBy: req.user._id,
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "doctor_leave",
      resourceId: leave._id,
      after: leave.toObject(),
      req,
    });

    return req.http.created(leave, "Doctor leave recorded successfully");
  } catch (err) {
    next(err);
  }
};

// ── DELETE DOCTOR LEAVE ──────────────────────────────────────────────────────
export const deleteDoctorLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await DoctorLeave.findById(id);
    if (!leave) return req.http.notFound("Leave record not found");

    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (!doc || String(doc._id) !== String(leave.doctorId)) {
        return req.http.forbidden("You can only manage your own leaves.");
      }
    }

    await DoctorLeave.findByIdAndDelete(id);

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "delete",
      resource: "doctor_leave",
      resourceId: id,
      before: leave.toObject(),
      req,
    });

    return req.http.ok(null, "Leave record deleted successfully");
  } catch (err) {
    next(err);
  }
};

// ── GET AVAILABLE SLOTS (WITH LEAVE & OVERLAP CHECKS) ───────────────────────
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return req.http.badRequest("doctorId and date query parameters are required");
    }

    const doctor = await Doctor.findById(doctorId).populate("userId", "name");
    if (!doctor) return req.http.notFound("Doctor not found");

    const [year, month, day] = date.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay(); // 0=Sun..6=Sat

    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    // 1. Check if doctor is on approved leave
    const activeLeave = await DoctorLeave.findOne({
      doctorId,
      status: "approved",
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    });

    if (activeLeave) {
      return req.http.ok({
        doctorId,
        doctorName: doctor.userId?.name,
        date,
        onLeave: true,
        leaveType: activeLeave.type,
        leaveReason: activeLeave.reason,
        slots: [],
      });
    }

    // 2. Fetch DoctorAvailability or construct from doctor profile
    const availability = await DoctorAvailability.findOne({ doctorId });
    const slotDuration = availability?.slotDuration || 30;

    let dayConfig = availability?.weeklySchedule?.find((s) => s.dayOfWeek === dayOfWeek);

    let startMin = 9 * 60; // 09:00 AM default
    let endMin = 17 * 60;  // 05:00 PM default
    let breakStart = 13 * 60;
    let breakEnd = 14 * 60;
    let isWorkingDay = true;

    if (dayConfig) {
      isWorkingDay = dayConfig.isWorking;
      startMin = parseTimeToMinutes(dayConfig.startTime) ?? startMin;
      endMin = parseTimeToMinutes(dayConfig.endTime) ?? endMin;
      breakStart = parseTimeToMinutes(dayConfig.breakStartTime) ?? 0;
      breakEnd = parseTimeToMinutes(dayConfig.breakEndTime) ?? 0;
    } else if (doctor.availableTime) {
      const parts = doctor.availableTime.split("-").map((s) => s.trim());
      if (parts.length >= 2) {
        startMin = parseTimeToMinutes(parts[0]) ?? startMin;
        endMin = parseTimeToMinutes(parts[1]) ?? endMin;
      }
      // Check legacy doctor.availableDays
      if (Array.isArray(doctor.availableDays) && doctor.availableDays.length > 0) {
        const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const curDay = dayNames[dayOfWeek];
        isWorkingDay = doctor.availableDays.some((d) => d.toLowerCase().startsWith(curDay));
      }
    }

    if (!isWorkingDay) {
      return req.http.ok({
        doctorId,
        doctorName: doctor.userId?.name,
        date,
        onLeave: false,
        notWorkingDay: true,
        slots: [],
      });
    }

    // 3. Find active appointments for this doctor on target date
    const bookedAppointments = await Appointment.find({
      doctorId,
      status: { $in: ["pending", "confirmed", "waiting", "called", "in_consultation"] },
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    }).select("appointmentTime status duration");

    const bookedTimeSet = new Set(bookedAppointments.map((a) => a.appointmentTime));

    // 4. Generate slots
    const slots = [];
    for (let m = startMin; m + slotDuration <= endMin; m += slotDuration) {
      // Check if inside break time
      if (breakStart && breakEnd && breakStart < breakEnd) {
        if (m >= breakStart && m < breakEnd) continue;
      }

      const timeLabel = formatMinutesTo12h(m);
      const isBooked = bookedTimeSet.has(timeLabel);

      slots.push({
        time: timeLabel,
        minutes: m,
        available: !isBooked,
      });
    }

    return req.http.ok({
      doctorId,
      doctorName: doctor.userId?.name,
      date,
      onLeave: false,
      notWorkingDay: false,
      slotDuration,
      slots,
    });
  } catch (err) {
    next(err);
  }
};
