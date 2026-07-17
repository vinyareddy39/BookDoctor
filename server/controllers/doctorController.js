import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";

// CREATE DOCTOR (Admin only)
export const createDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.create(req.body);
    return req.http.created(doctor, "Doctor created");
  } catch (err) {
    next(err);
  }
};

// GET ALL DOCTORS (public with filtering & sorting)
export const getDoctors = async (req, res, next) => {
  try {
    const { city, specialization, available, minFee, maxFee, gender, sortBy } = req.query;
    const filter = {}; // Removed isVerified: true constraint for testing

    if (city)           filter.city           = { $regex: city, $options: "i" };
    if (specialization) filter.specialization = { $regex: specialization, $options: "i" };
    if (available === "true") filter.isAvailable = true;

    // Consultation Fee Filters
    if (minFee || maxFee) {
      filter.consultationFee = {};
      if (minFee) filter.consultationFee.$gte = Number(minFee);
      if (maxFee) filter.consultationFee.$lte = Number(maxFee);
    }

    // Gender Filter (Lookup corresponding User accounts)
    if (gender) {
      const usersOfGender = await User.find({ gender, role: "doctor" }).select("_id");
      const userIds = usersOfGender.map(u => u._id);
      filter.userId = { $in: userIds };
    }

    // Sorting Logic
    let sortOptions = {};
    if (sortBy === "rating") {
      sortOptions.averageRating = -1;
    } else if (sortBy === "fee-asc") {
      sortOptions.consultationFee = 1;
    } else if (sortBy === "fee-desc") {
      sortOptions.consultationFee = -1;
    } else {
      sortOptions.createdAt = -1;
    }

    const limit = parseInt(req.query.limit) || 50;

    const doctors = await Doctor.find(filter)
      .populate("userId", "name email phone gender")
      .sort(sortOptions)
      .limit(limit)
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
      .populate("userId", "name email phone gender")
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
    let doctor = await Doctor.findOne({ userId: req.user._id }).populate("userId", "name email phone gender");
    if (!doctor) {
      // Auto-create a stub profile for newly registered doctors
      const newDoctor = await Doctor.create({
        userId:          req.user._id,
        specialization:  "General Physician",
        consultationFee: 500,
      });
      doctor = await newDoctor.populate("userId", "name email phone gender");
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
      name, phone, gender,
      specialization, qualification, experience,
      consultationFee, bio, availableDays, availableTime,
      isAvailable, city, clinicName, address, mapUrl,
    } = req.body;

    // Update user name/phone/gender in User collection if provided
    const userUpdates = {};
    if (name) userUpdates.name = name;
    if (phone) userUpdates.phone = phone;
    if (gender) userUpdates.gender = gender;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.user._id, userUpdates);
    }

    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      {
        specialization, qualification, experience,
        consultationFee, bio, availableDays, availableTime,
        isAvailable, city, clinicName, address, mapUrl,
      },
      { new: true, runValidators: true }
    ).populate("userId", "name email phone gender");

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

// GET DOCTOR ANALYTICS (Charts)
export const getDoctorAnalytics = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return req.http.notFound("Doctor profile not found");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Appointment.aggregate([
      {
        $match: {
          doctorId: doctor._id,
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