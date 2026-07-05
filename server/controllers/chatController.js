import Message from "../models/Message.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";

// GET messages for an appointment
export const getMessages = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return req.http.notFound("Appointment not found.");

    // Authorization: must be patient or doctor of this appointment
    const userId = String(req.user._id);
    const isPatient = String(appointment.patientId) === userId;

    let isDoctor = false;
    if (req.user.role === "doctor") {
      const doc = await Doctor.findOne({ userId: req.user._id });
      isDoctor = doc && String(appointment.doctorId) === String(doc._id);
    }

    if (!isPatient && !isDoctor && req.user.role !== "admin") {
      return req.http.forbidden("Not authorized to view these messages.");
    }

    const messages = await Message.find({ appointmentId })
      .populate("senderId", "name role profilePicture")
      .sort({ createdAt: 1 });

    return req.http.ok(messages, "Messages retrieved.");
  } catch (err) {
    next(err);
  }
};

// POST a message (REST fallback — Socket.io is preferred)
export const sendMessage = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { text, receiverId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return req.http.notFound("Appointment not found.");

    const message = await Message.create({
      appointmentId,
      senderId: req.user._id,
      receiverId,
      text,
    });

    const populated = await message.populate("senderId", "name role profilePicture");

    return req.http.created(populated, "Message sent.");
  } catch (err) {
    next(err);
  }
};
