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
        .limit(100)
        .lean(),
      User.find({ role: "patient" })
        .select("-password")
        .sort({ createdAt: -1 })
        .limit(100)
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

// VERIFY / APPROVE DOCTOR (Admin only)
export const verifyDoctor = async (req, res, next) => {
  try {
    const { isVerified } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { isVerified },
      { new: true }
    ).populate("userId", "name email");

    if (!doctor) return req.http.notFound("Doctor profile not found.");

    return req.http.ok(doctor, `Doctor verified status updated to ${isVerified}`);
  } catch (err) {
    next(err);
  }
};

// GET ADMIN ANALYTICS (Charts)
export const getAnalytics = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          appointments: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format for Recharts
    const chartData = dailyStats.map(stat => ({
      date: stat._id,
      appointments: stat.appointments,
      revenue: stat.revenue
    }));

    return req.http.ok(chartData);
  } catch (err) {
    next(err);
  }
};

// CLEAR REVIEW (Admin Moderation)
export const clearReview = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { review: "[Review removed by Admin]", rating: null } },
      { new: true }
    );
    if (!appointment) return req.http.notFound("Appointment not found");
    return req.http.ok(appointment, "Review cleared");
  } catch (err) {
    next(err);
  }
};

// FORCE REFUND (Admin Dispute Resolution)
export const forceRefund = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { paymentStatus: "refunded", status: "cancelled" } },
      { new: true }
    );
    if (!appointment) return req.http.notFound("Appointment not found");
    return req.http.ok(appointment, "Appointment cancelled and payment marked as refunded");
  } catch (err) {
    next(err);
  }
};