import User from "../models/User.js";

export const getUsersService = async () => {
  return await User.find().select("-password");
};

export const updateUserService = async (id, data) => {
  return await User.findByIdAndUpdate(id, data, {
    new: true,
  });
};