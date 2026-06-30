import Doctor from "../models/Doctor.js";
import User from "../models/User.js";

// CREATE DOCTOR (Admin only)
export const createDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.create(req.body);
    return req.http.created(doctor, "Doctor created");
  } catch (err) {
    next(err);
  }
};

// GET ALL DOCTORS (public — supports ?city= &specialization= &available=true)
export const getDoctors = async (req, res, next) => {
  try {
    const { city, specialization, available } = req.query;
    const filter = {};

    if (city)           filter.city           = { $regex: city, $options: "i" };
    if (specialization) filter.specialization = { $regex: specialization, $options: "i" };
    if (available === "true") filter.isAvailable = true;

    const doctors = await Doctor.find(filter)
      .populate("userId", "name email phone")
      .lean();

    return req.http.ok(doctors, "Doctors fetched");
  } catch (err) {
    next(err);
  }
};

// GET SINGLE DOCTOR (public)
export const getDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate("userId", "name email phone")
      .lean();
    if (!doctor) return req.http.notFound("Doctor not found");
    return req.http.ok(doctor);
  } catch (err) {
    next(err);
  }
};

// UPDATE DOCTOR (Admin)
export const updateDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doctor) return req.http.notFound("Doctor not found");
    return req.http.ok(doctor, "Doctor updated");
  } catch (err) {
    next(err);
  }
};

// DELETE DOCTOR (Admin)
export const deleteDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return req.http.notFound("Doctor not found");
    return req.http.ok(null, "Doctor deleted");
  } catch (err) {
    next(err);
  }
};

// GET MY DOCTOR PROFILE (Doctor self)
export const getMyDoctorProfile = async (req, res, next) => {
  try {
    let doctor = await Doctor.findOne({ userId: req.user._id }).populate("userId", "name email phone");
    if (!doctor) {
      // Auto-create a stub profile for newly registered doctors
      const newDoctor = await Doctor.create({
        userId:          req.user._id,
        specialization:  "General Physician",
        consultationFee: 500,
      });
      doctor = await newDoctor.populate("userId", "name email phone");
    }
    return req.http.ok(doctor, "Doctor profile fetched");
  } catch (err) {
    next(err);
  }
};

// UPDATE MY DOCTOR PROFILE (Doctor self)
export const updateMyDoctorProfile = async (req, res, next) => {
  try {
    const {
      name, phone,
      specialization, qualification, experience,
      consultationFee, bio, availableDays, availableTime,
      isAvailable, city, clinicName, address, mapUrl,
    } = req.body;

    // Update user name/phone in User collection if provided
    if (name || phone) {
      await User.findByIdAndUpdate(req.user._id, { name, phone });
    }

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
    next(err);
  }
};

// TOGGLE AVAILABILITY (Doctor self)
export const toggleAvailability = async (req, res, next) => {
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
    next(err);
  }
};