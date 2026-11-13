import express from "express";
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  getProfile,
  getSessions,
  revokeSession,
  logoutAll,
  deviceSession,
  validateDeviceIdMiddleware
} from "../controllers/authController.js";
import { auth, validate } from "../middleware/index.js";
import {
  authLimiter,
  deviceSessionIpLimiter,
  deviceSessionIdLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

// Public auth routes
router.post("/register", authLimiter, validate(["name", "email", "password", "role"]), register);
router.post("/login",    authLimiter, validate(["email", "password"]), login);
router.post(
  "/device-session",
  deviceSessionIpLimiter,
  validateDeviceIdMiddleware,
  deviceSessionIdLimiter,
  deviceSession
);

// Verification and Reset
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", authLimiter, validate(["email"]), forgotPassword);
router.post("/reset-password/:token", authLimiter, validate(["password"]), resetPassword);

// Token refreshing & logout
router.post("/refresh", refresh);
router.post("/logout", logout);

// Multi-device Session Management
router.get("/sessions", auth, getSessions);
router.delete("/sessions/:id/revoke", auth, revokeSession);
router.post("/logout-all", auth, logoutAll);

// Protected profile
router.get("/profile", auth, getProfile);

export default router;