import Appointment from "../models/Appointment.js";

export const createAppointmentService = async (data) => {
  return await Appointment.create(data);
};

export const getAppointmentsService = async (filter) => {
  return await Appointment.find(filter)
    .populate("patientId")
    .populate("doctorId");
};

export const updateAppointmentService = async (id, data) => {
  return await Appointment.findByIdAndUpdate(id, data, {
    new: true,
  });
};

export const deleteAppointmentService = async (id) => {
  return await Appointment.findByIdAndDelete(id);
};