import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import { sendBookingConfirmation, sendCancellationEmail } from "../service/emailService.js";

// BOOK APPOINTMENT (patient only)
export const bookAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.create({
      ...req.body,
      patientId: req.user._id,
    });

    // Send confirmation email (non-blocking — failure won't break booking)
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
    } catch (emailErr) {
      console.warn("[Email] Booking confirmation failed:", emailErr.message);
    }

    return req.http.created(appointment, "Appointment booked successfully");
  } catch (err) {
    next(err);
  }
};

// GET APPOINTMENTS (role-scoped)
export const getAppointments = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === "patient") {
      query = { patientId: req.user._id };
    } else if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc) return req.http.ok([], "No appointments found");
      query = { doctorId: doctorDoc._id };
    }
    // admin sees all (no filter)

    const appointments = await Appointment.find(query)
      .populate("patientId", "name email phone dob gender bloodGroup emergencyContact profilePicture")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email" } })
      .sort({ appointmentDate: -1, createdAt: -1 })
      .lean();

    return req.http.ok(appointments);
  } catch (err) {
    next(err);
  }
};

// UPDATE APPOINTMENT (doctor or admin only — with ownership check)
export const updateAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    // Ownership guard: doctor can only update their own clinic's appointments
    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    const updateData = { ...req.body };
    // Auto-mark payment as paid when appointment is completed
    if (updateData.status === "completed") {
      updateData.paymentStatus = "paid";
    }

    const updated = await Appointment.findByIdAndUpdate(req.params.id, updateData, { new: true });
    return req.http.ok(updated, "Appointment updated");
  } catch (err) {
    next(err);
  }
};

// CANCEL APPOINTMENT — soft cancel (sets status to "cancelled", never hard-deletes)
// Patients can only cancel their OWN pending/confirmed appointments
export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return req.http.notFound("Appointment not found");

    // Patients can only cancel their own appointments
    if (req.user.role === "patient") {
      if (String(appointment.patientId) !== String(req.user._id)) {
        return req.http.forbidden("You can only cancel your own appointments.");
      }
      if (!["pending", "confirmed"].includes(appointment.status)) {
        return req.http.badRequest("Only pending or confirmed appointments can be cancelled.");
      }
    }

    // Doctors can cancel appointments for their own clinic
    if (req.user.role === "doctor") {
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc || String(appointment.doctorId) !== String(doctorDoc._id)) {
        return req.http.forbidden("You can only manage your own appointments.");
      }
    }

    appointment.status = "cancelled";
    await appointment.save();

    // Send cancellation email (non-blocking)
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
    } catch (emailErr) {
      console.warn("[Email] Cancellation email failed:", emailErr.message);
    }

    return req.http.ok({ status: "cancelled" }, "Appointment cancelled successfully");
  } catch (err) {
    next(err);
  }
};

// DELETE APPOINTMENT (admin only — hard delete for cleanup)
export const deleteAppointment = async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return req.http.notFound("Appointment not found");
    return req.http.ok(null, "Appointment deleted");
  } catch (err) {
    next(err);
  }
};