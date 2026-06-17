import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";

// DASHBOARD
export const getDashboard = async (req, res) => {
  try {
    const users = await User.countDocuments();
    const doctors = await Doctor.countDocuments();
    const appointments = await Appointment.countDocuments();

    return req.http.ok({
      users,
      doctors,
      appointments,
    });
  } catch (err) {
    return req.http.serverError(err.message);
  }
};