import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";

export const getDashboardService = async () => {
  const users = await User.countDocuments();
  const doctors = await Doctor.countDocuments();
  const appointments = await Appointment.countDocuments();

  return {
    users,
    doctors,
    appointments,
  };
};