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