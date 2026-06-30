import User from "../models/User.js";

// GET ALL USERS (Admin only)
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    return req.http.ok(users);
  } catch (err) {
    next(err);
  }
};

// UPDATE MY PROFILE
// ⚠️  SECURITY: only whitelisted fields — never allow role/isVerified from client
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, dob, gender, bloodGroup, emergencyContact, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, dob, gender, bloodGroup, emergencyContact, profilePicture },
      { new: true, runValidators: true }
    ).select("-password");

    return req.http.ok(user, "Profile updated");
  } catch (err) {
    next(err);
  }
};

// GET MY PROFILE
export const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return req.http.notFound("User not found");
    return req.http.ok(user, "User profile fetched");
  } catch (err) {
    next(err);
  }
};