import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";

// GET ADMIN DASHBOARD STATS + LISTS
export const getDashboard = async (req, res, next) => {
  try {
    const [userCount, doctorCount, appointmentCount,
           recentAppointments, doctors, patients] = await Promise.all([
      User.countDocuments(),
      Doctor.countDocuments(),
      Appointment.countDocuments(),
      Appointment.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("patientId", "name email")
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
        .lean(),
      Doctor.find()
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .lean(),
      User.find({ role: "patient" })
        .select("-password")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Appointment breakdown by status
    const [pending, confirmed, completed, cancelled] = await Promise.all([
      Appointment.countDocuments({ status: "pending" }),
      Appointment.countDocuments({ status: "confirmed" }),
      Appointment.countDocuments({ status: "completed" }),
      Appointment.countDocuments({ status: "cancelled" }),
    ]);

    return req.http.ok({
      stats: {
        users: userCount,
        doctors: doctorCount,
        appointments: appointmentCount,
        pending, confirmed, completed, cancelled,
      },
      recentAppointments,
      doctors,
      patients,
    });
  } catch (err) {
    next(err);
  }
};