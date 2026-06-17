import User from "../models/User.js";
import jwt from "jsonwebtoken";

// Generate Token
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return req.http.badRequest("User already exists");
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "patient",
    });

    return req.http.created(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role),
      },
      "User registered successfully"
    );
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return req.http.unauthorized("Invalid credentials");
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return req.http.unauthorized("Invalid credentials");
    }

    return req.http.ok(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role),
      },
      "Login successful"
    );
  } catch (err) {
    return req.http.serverError(err.message);
  }
};

// PROFILE
export const getProfile = async (req, res) => {
  return req.http.ok(req.user, "User profile fetched");
};