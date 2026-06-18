import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";

// BOOK APPOINTMENT
export const bookAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.create({
      ...req.body,
      patientId: req.user._id,
    });
    return req.http.created(appointment, "Appointment booked");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// GET APPOINTMENTS
export const getAppointments = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "patient") {
      query = { patientId: req.user._id };
    } else if (req.user.role === "doctor") {
      // Find the Doctor document linked to this user
      const doctorDoc = await Doctor.findOne({ userId: req.user._id });
      if (!doctorDoc) return req.http.ok([], "No appointments found");
      query = { doctorId: doctorDoc._id };
    }
    // admin sees all

    const appointments = await Appointment.find(query)
      .populate("patientId", "name email phone dob gender bloodGroup emergencyContact profilePicture")
      .populate({
        path: "doctorId",
        populate: { path: "userId", select: "name email" },
      })
      .sort({ createdAt: -1 });

    return req.http.ok(appointments);
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// UPDATE APPOINTMENT STATUS (doctor or admin)
export const updateAppointment = async (req, res) => {
  try {
    const updateData = { ...req.body };
    // Auto-mark payment as paid when appointment is completed
    if (updateData.status === "completed") {
      updateData.paymentStatus = "paid";
    }
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!appointment) return req.http.notFound("Appointment not found");
    return req.http.ok(appointment, "Appointment updated");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// DELETE / CANCEL APPOINTMENT
export const deleteAppointment = async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    return req.http.ok(null, "Appointment cancelled");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};