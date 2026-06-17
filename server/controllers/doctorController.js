import Doctor from "../models/Doctor.js";
import User from "../models/User.js";

// CREATE DOCTOR (Admin or self-register)
export const createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    return req.http.created(doctor, "Doctor created");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// GET ALL DOCTORS (with city & specialization filter)
export const getDoctors = async (req, res) => {
  try {
    const { city, specialization, available } = req.query;
    const filter = {};

    if (city) filter.city = { $regex: city, $options: "i" };
    if (specialization) filter.specialization = { $regex: specialization, $options: "i" };
    if (available === "true") filter.isAvailable = true;

    const doctors = await Doctor.find(filter).populate("userId", "name email phone");
    return req.http.ok(doctors, "Doctors fetched");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// GET SINGLE DOCTOR
export const getDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate("userId", "name email phone");
    if (!doctor) return req.http.notFound("Doctor not found");
    return req.http.ok(doctor);
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// UPDATE DOCTOR (Admin)
export const updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return req.http.ok(doctor, "Doctor updated");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// DELETE DOCTOR (Admin)
export const deleteDoctor = async (req, res) => {
  try {
    await Doctor.findByIdAndDelete(req.params.id);
    return req.http.ok(null, "Doctor deleted");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// GET MY DOCTOR PROFILE (Doctor self)
export const getMyDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id }).populate("userId", "name email phone");
    if (!doctor) {
      // Auto-create a stub doctor profile for newly registered doctors
      const newDoctor = await Doctor.create({
        userId: req.user._id,
        specialization: "General Physician",
        consultationFee: 500,
      });
      const populated = await newDoctor.populate("userId", "name email phone");
      return req.http.ok(populated, "Doctor profile created");
    }
    return req.http.ok(doctor, "Doctor profile fetched");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// UPDATE MY DOCTOR PROFILE (Doctor self)
export const updateMyDoctorProfile = async (req, res) => {
  try {
    const {
      name, phone,
      specialization, qualification, experience,
      consultationFee, bio, availableDays, availableTime,
      isAvailable, city, clinicName, address, mapUrl,
    } = req.body;

    // Update user name/phone if provided
    if (name || phone) {
      await User.findByIdAndUpdate(req.user._id, { name, phone });
    }

    // Update doctor profile
    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      {
        specialization, qualification, experience,
        consultationFee, bio, availableDays, availableTime,
        isAvailable, city, clinicName, address, mapUrl,
      },
      { new: true, runValidators: true }
    ).populate("userId", "name email phone");

    if (!doctor) return req.http.notFound("Doctor profile not found");
    return req.http.ok(doctor, "Profile updated");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// TOGGLE AVAILABILITY (Doctor self - quick toggle)
export const toggleAvailability = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return req.http.notFound("Doctor profile not found");

    doctor.isAvailable = !doctor.isAvailable;
    await doctor.save();

    return req.http.ok(
      { isAvailable: doctor.isAvailable },
      `You are now ${doctor.isAvailable ? "Available" : "Unavailable"}`
    );
  } catch (err) {
    return req.http.serverError(err.message);
  }
};