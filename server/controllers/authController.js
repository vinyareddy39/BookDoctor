import User from "../models/User.js";
import Session from "../models/Session.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationEmail, sendResetPasswordEmail } from "../service/emailService.js";
import { recordAudit } from "../middleware/auditLogger.js";

// Helper to extract device name from User-Agent
const parseDeviceInfo = (userAgent = "") => {
  if (/mobile/i.test(userAgent)) return "Mobile Device";
  if (/tablet|ipad/i.test(userAgent)) return "Tablet Device";
  if (/macintosh|mac os/i.test(userAgent)) return "macOS (Desktop)";
  if (/windows/i.test(userAgent)) return "Windows (Desktop)";
  if (/linux/i.test(userAgent)) return "Linux (Desktop)";
  return "Web Browser";
};

// Generate Access Token (Persistent: 365 days / 1 year so user stays logged in until manual logout)
const generateAccessToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "365d" }
  );
};

// Generate Refresh Token (Persistent: 365 days)
const generateRefreshToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: "365d" }
  );
};

// REGISTER
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, uberAccount } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return req.http.badRequest("An account with this email already exists.");
    }

    const safeRole = ["patient", "doctor"].includes(role) ? role : "patient";

    const user = new User({ 
      name: name.trim(), 
      email, 
      password, 
      role: safeRole,
      uberAccount: uberAccount || { isConnected: false }
    });

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

    // Auto-migrate legacy 'admin' to 'clinic_admin'
    if (user.role === "admin") {
      user.role = "clinic_admin";
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    // Save refresh token to user for backward compatibility
    user.refreshToken = refreshToken;
    await user.save();

    // Track multi-device session
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const device = parseDeviceInfo(userAgent);

    await Session.create({
      userId: user._id,
      refreshToken,
      userAgent,
      ip,
      device,
      isValid: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days
      lastActive: new Date(),
    }).catch((err) => console.warn("Session tracking error:", err.message));

    // Record login audit log
    recordAudit({
      userId: user._id,
      userName: user.name,
      role: user.role,
      action: "LOGIN",
      resource: "Session",
      resourceId: String(user._id),
      details: `User logged in from ${device} (${ip})`,
      ip,
      userAgent,
    });

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days
    });

    return req.http.ok(
      {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        token:        accessToken,
        refreshToken: refreshToken,
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

// REFRESH TOKEN (with Token Rotation & Session Sync)
export const refresh = async (req, res, next) => {
  try {
    const oldRefreshToken =
      req.body?.refreshToken ||
      req.headers["x-refresh-token"] ||
      req.cookies?.refreshToken;

    if (!oldRefreshToken) return req.http.unauthorized("No refresh token provided.");

    const decoded = jwt.verify(oldRefreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("+refreshToken");
    if (!user) return req.http.unauthorized("Invalid refresh token.");

    // Check session validity if session tracking exists
    const session = await Session.findOne({
      userId: user._id,
      refreshToken: oldRefreshToken,
      isValid: true,
      expiresAt: { $gt: new Date() },
    });

    // If session was revoked or explicitly invalid
    if (session && !session.isValid) {
      return req.http.unauthorized("Session has been revoked or expired. Please log in again.");
    }

    // Token Rotation: generate fresh access & refresh tokens
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id, user.role);

    // Update Session record if present, or create one for legacy migrations
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (session) {
      session.refreshToken = newRefreshToken;
      session.lastActive = new Date();
      session.ip = ip;
      session.userAgent = userAgent;
      await session.save();
    } else {
      await Session.create({
        userId: user._id,
        refreshToken: newRefreshToken,
        userAgent,
        ip,
        device: parseDeviceInfo(userAgent),
        isValid: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastActive: new Date(),
      }).catch(() => {});
    }

    // Update User model
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set updated cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    return req.http.ok(
      { token: newAccessToken, refreshToken: newRefreshToken },
      "Token rotated and refreshed successfully"
    );
  } catch (err) {
    return req.http.unauthorized("Invalid or expired refresh token.");
  }
};

// LOGOUT
export const logout = async (req, res, next) => {
  try {
    const refreshToken =
      req.body?.refreshToken ||
      req.headers["x-refresh-token"] ||
      req.cookies?.refreshToken;

    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (refreshToken) {
      await Session.findOneAndUpdate({ refreshToken }, { isValid: false });
      await User.findOneAndUpdate({ refreshToken }, { refreshToken: "" });
    }

    if (req.user) {
      recordAudit({
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role,
        action: "LOGOUT",
        resource: "Session",
        resourceId: String(req.user._id),
        details: "User logged out of current session",
        ip,
        userAgent,
      });
    }

    res.clearCookie("refreshToken");
    return req.http.ok(null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
};

// GET ACTIVE SESSIONS FOR CURRENT USER
export const getSessions = async (req, res, next) => {
  try {
    const currentToken =
      req.body?.refreshToken ||
      req.headers["x-refresh-token"] ||
      req.cookies?.refreshToken;

    const sessions = await Session.find({
      userId: req.user._id,
      isValid: true,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActive: -1 });

    const formatted = sessions.map((s) => ({
      _id: s._id,
      device: s.device,
      ip: s.ip,
      userAgent: s.userAgent,
      lastActive: s.lastActive,
      createdAt: s.createdAt,
      isCurrent: currentToken ? s.refreshToken === currentToken : false,
    }));

    return req.http.ok({ sessions: formatted }, "Active sessions retrieved");
  } catch (err) {
    next(err);
  }
};

// REVOKE SPECIFIC SESSION
export const revokeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findOne({ _id: id, userId: req.user._id });

    if (!session) {
      return req.http.notFound("Session not found or already revoked.");
    }

    session.isValid = false;
    await session.save();

    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "REVOKE_SESSION",
      resource: "Session",
      resourceId: id,
      details: `Revoked session on device: ${session.device} (${session.ip})`,
      ip,
      userAgent,
    });

    return req.http.ok(null, "Session revoked successfully");
  } catch (err) {
    next(err);
  }
};

// LOGOUT ALL DEVICES
export const logoutAll = async (req, res, next) => {
  try {
    await Session.updateMany({ userId: req.user._id }, { isValid: false });
    await User.findByIdAndUpdate(req.user._id, { refreshToken: "" });

    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "LOGOUT_ALL_DEVICES",
      resource: "Session",
      resourceId: String(req.user._id),
      details: "User revoked and terminated all active sessions across all devices",
      ip,
      userAgent,
    });

    res.clearCookie("refreshToken");
    return req.http.ok(null, "All active sessions have been terminated.");
  } catch (err) {
    next(err);
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  return req.http.ok(req.user, "User profile fetched");
};