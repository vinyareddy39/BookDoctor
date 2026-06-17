import User from "../models/User.js";

// GET ALL USERS (Admin)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    return req.http.ok(users);
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      req.body,
      { new: true }
    );

    return req.http.ok(user, "Profile updated");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// GET MY PROFILE
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return req.http.notFound("User not found");
    return req.http.ok(user, "User profile fetched");
  } catch (err) {
    return req.http.serverError(err.message);
  }
};