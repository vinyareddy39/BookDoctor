import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { broadcastQueueUpdate, sendNotificationToUser } from "../socket.js";
import { recordAudit } from "../middleware/auditLogger.js";

// Helper: get today's bounds
const getTodayBounds = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// ── GENERATE WALK-IN TOKEN ──────────────────────────────────────────────────
export const generateToken = async (req, res, next) => {
  try {
    const { patientId, doctorId, amount, notes } = req.body;

    if (!patientId || !doctorId) {
      return req.http.badRequest("patientId and doctorId are required");
    }

    const [patient, doctor] = await Promise.all([
      User.findById(patientId),
      Doctor.findById(doctorId).populate("userId", "name"),
    ]);

    if (!patient) return req.http.notFound("Patient not found");
    if (!doctor) return req.http.notFound("Doctor not found");

    const { start, end } = getTodayBounds();

    // Find highest token number for this doctor today
    const lastAppt = await Appointment.findOne({
      doctorId,
      appointmentDate: { $gte: start, $lte: end },
      tokenNumber: { $ne: null },
    }).sort({ tokenNumber: -1 });

    const tokenNumber = (lastAppt?.tokenNumber || 0) + 1;
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentDate: now,
      appointmentTime: timeString,
      type: "walk_in",
      tokenNumber,
      queueStatus: "waiting",
      status: "waiting",
      amount: amount || doctor.consultationFee || 500,
      notes: notes || "Walk-in registration",
    });

    const populated = await Appointment.findById(appointment._id)
      .populate("patientId", "name mrn phone bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "walkin_queue",
      resourceId: appointment._id,
      after: appointment.toObject(),
      req,
    });

    // Real-time broadcast to waiting room and doctor console
    broadcastQueueUpdate({
      type: "TOKEN_GENERATED",
      tokenNumber,
      doctorId,
      doctorName: doctor.userId?.name,
      appointment: populated,
    });

    return req.http.created(populated, `Token #${tokenNumber} generated successfully`);
  } catch (err) {
    next(err);
  }
};

// ── GET TODAY'S QUEUE ────────────────────────────────────────────────────────
export const getTodayQueue = async (req, res, next) => {
  try {
    const { doctorId } = req.query;
    const { start, end } = getTodayBounds();

    let query = {
      appointmentDate: { $gte: start, $lte: end },
      $or: [
        { queueStatus: { $in: ["waiting", "called", "in_consultation", "completed", "skipped"] } },
        { status: { $in: ["waiting", "called", "in_consultation"] } },
      ],
    };

    if (doctorId) {
      query.doctorId = doctorId;
    } else if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (doc) query.doctorId = doc._id;
    }

    const queueList = await Appointment.find(query)
      .populate("patientId", "name mrn phone bloodGroup gender")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
      .sort({ createdAt: 1 })
      .lean();

    // Build summary stats
    const waitingList = queueList.filter((a) => a.queueStatus === "waiting" || a.status === "waiting");
    const calledList = queueList.filter((a) => a.queueStatus === "called" || a.status === "called");
    const inConsultationList = queueList.filter((a) => a.queueStatus === "in_consultation" || a.status === "in_consultation");
    const completedList = queueList.filter((a) => a.queueStatus === "completed" || a.status === "completed");

    return req.http.ok({
      queue: queueList,
      summary: {
        total: queueList.length,
        waitingCount: waitingList.length,
        calledCount: calledList.length,
        inConsultationCount: inConsultationList.length,
        completedCount: completedList.length,
        nowServing: inConsultationList[0] || calledList[0] || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── CALL TOKEN (Receptionist / Doctor) ──────────────────────────────────────
export const callToken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id)
      .populate("patientId", "name")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    if (!appointment) return req.http.notFound("Queue entry not found");

    const before = appointment.toObject();
    appointment.queueStatus = "called";
    appointment.status = "called";
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "walkin_queue",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    broadcastQueueUpdate({
      type: "TOKEN_CALLED",
      appointmentId: appointment._id,
      tokenNumber: appointment.tokenNumber,
      doctorId: appointment.doctorId?._id,
      doctorName: appointment.doctorId?.userId?.name,
      patientName: appointment.patientId?.name,
    });

    if (appointment.patientId?._id) {
      sendNotificationToUser(appointment.patientId._id, {
        type: "TOKEN_CALLED",
        title: `Token #${appointment.tokenNumber} Called!`,
        message: `Dr. ${appointment.doctorId?.userId?.name || "your doctor"} is ready for you in consultation room.`,
      });
    }

    return req.http.ok(appointment, `Token #${appointment.tokenNumber} called`);
  } catch (err) {
    next(err);
  }
};

// ── START CONSULTATION ───────────────────────────────────────────────────────
export const startConsultation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id)
      .populate("patientId", "name")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    if (!appointment) return req.http.notFound("Queue entry not found");

    const before = appointment.toObject();
    appointment.queueStatus = "in_consultation";
    appointment.status = "in_consultation";
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "walkin_queue",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    broadcastQueueUpdate({
      type: "CONSULTATION_STARTED",
      appointmentId: appointment._id,
      tokenNumber: appointment.tokenNumber,
      doctorId: appointment.doctorId?._id,
      doctorName: appointment.doctorId?.userId?.name,
      patientName: appointment.patientId?.name,
    });

    return req.http.ok(appointment, `Consultation started for Token #${appointment.tokenNumber}`);
  } catch (err) {
    next(err);
  }
};

// ── COMPLETE CONSULTATION ────────────────────────────────────────────────────
export const completeConsultation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return req.http.notFound("Queue entry not found");

    const before = appointment.toObject();
    appointment.queueStatus = "completed";
    appointment.status = "completed";
    appointment.paymentStatus = "paid";
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "walkin_queue",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    broadcastQueueUpdate({
      type: "CONSULTATION_COMPLETED",
      appointmentId: appointment._id,
      tokenNumber: appointment.tokenNumber,
      doctorId: appointment.doctorId,
    });

    return req.http.ok(appointment, `Token #${appointment.tokenNumber} completed`);
  } catch (err) {
    next(err);
  }
};

// ── SKIP / MARK NO-SHOW ─────────────────────────────────────────────────────
export const skipToken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return req.http.notFound("Queue entry not found");

    const before = appointment.toObject();
    appointment.queueStatus = "skipped";
    appointment.status = "no_show";
    await appointment.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "walkin_queue",
      resourceId: appointment._id,
      before,
      after: appointment.toObject(),
      req,
    });

    broadcastQueueUpdate({
      type: "TOKEN_SKIPPED",
      appointmentId: appointment._id,
      tokenNumber: appointment.tokenNumber,
      doctorId: appointment.doctorId,
    });

    return req.http.ok(appointment, `Token #${appointment.tokenNumber} marked as skipped`);
  } catch (err) {
    next(err);
  }
};
