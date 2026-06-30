import User from "../models/User.js";
import jwt from "jsonwebtoken";

// Generate Token — pulls secret from env ONLY
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// REGISTER
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return req.http.badRequest("An account with this email already exists.");
    }

    // Never accept admin role from public registration
    const safeRole = ["patient", "doctor"].includes(role) ? role : "patient";

    const user = await User.create({ name: name.trim(), email, password, role: safeRole });

    return req.http.created(
      {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id, user.role),
      },
      "Account created successfully"
    );
  } catch (err) {
    next(err);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return req.http.unauthorized("Invalid email or password.");

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return req.http.unauthorized("Invalid email or password.");

    return req.http.ok(
      {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id, user.role),
      },
      "Login successful"
    );
  } catch (err) {
    next(err);
  }
};

// GET PROFILE (current user)
export const getProfile = async (req, res) => {
  // req.user is already populated by auth middleware (without password)
  return req.http.ok(req.user, "User profile fetched");
};