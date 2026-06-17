import Doctor from "../models/Doctor.js";

export const createDoctorService = async (data) => {
  return await Doctor.create(data);
};

export const getDoctorsService = async () => {
  return await Doctor.find().populate("userId");
};

export const getDoctorByIdService = async (id) => {
  return await Doctor.findById(id);
};

export const updateDoctorService = async (id, data) => {
  return await Doctor.findByIdAndUpdate(id, data, {
    new: true,
  });
};

export const deleteDoctorService = async (id) => {
  return await Doctor.findByIdAndDelete(id);
};