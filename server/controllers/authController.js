import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationEmail, sendResetPasswordEmail } from "../service/emailService.js";

// Generate Access Token (Short-lived: 15 min)
const generateAccessToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

// Generate Refresh Token (Long-lived: 7 days)
const generateRefreshToken = (id, role) => {
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

    const safeRole = ["patient", "doctor"].includes(role) ? role : "patient";

    const user = new User({ name: name.trim(), email, password, role: safeRole });

    // Generate Verification Token
    const verifyToken = user.getEmailVerificationToken();
    await user.save();

    // Send Verification Email
    try {
      await sendVerificationEmail(user.email, user.name, verifyToken);
    } catch (err) {
      console.warn("Verification email sending failed:", err.message);
    }

    return req.http.created(
      {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        isEmailVerified: user.isEmailVerified,
      },
      "Account created successfully. Please check your email to verify your account."
    );
  } catch (err) {
    next(err);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+refreshToken");
    if (!user) return req.http.unauthorized("Invalid email or password.");

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return req.http.unauthorized("Invalid email or password.");

    // Enforce email verification (optional block — but highly recommended)
    // Removed to allow users to login since email sending is not configured

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    // Save refresh token to db
    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return req.http.ok(
      {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: accessToken,
      },
      "Login successful"
    );
  } catch (err) {
    next(err);
  }
};

// VERIFY EMAIL
export const verifyEmail = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
    });

    if (!user) {
      return req.http.badRequest("Invalid or expired verification token.");
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    return req.http.ok(null, "Email verified successfully! You can now log in.");
  } catch (err) {
    next(err);
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return req.http.notFound("No account found with this email.");
    }

    const resetToken = user.getResetPasswordToken();
    await user.save();

    try {
      await sendResetPasswordEmail(user.email, user.name, resetToken);
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return req.http.serverError("Email could not be sent. Please try again later.");
    }

    return req.http.ok(null, "Password reset link sent to your email.");
  } catch (err) {
    next(err);
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return req.http.badRequest("Invalid or expired reset token.");
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return req.http.ok(null, "Password updated successfully. You can now log in.");
  } catch (err) {
    next(err);
  }
};

// REFRESH TOKEN
export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return req.http.unauthorized("No refresh token provided.");

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.id, refreshToken }).select("+refreshToken");
    
    if (!user) return req.http.unauthorized("Invalid refresh token.");

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id, user.role);

    return req.http.ok({ token: newAccessToken }, "Token refreshed");
  } catch (err) {
    return req.http.unauthorized("Invalid or expired refresh token.");
  }
};

// LOGOUT
export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await User.findOneAndUpdate({ refreshToken }, { refreshToken: "" });
    }
    res.clearCookie("refreshToken");
    return req.http.ok(null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  return req.http.ok(req.user, "User profile fetched");
};