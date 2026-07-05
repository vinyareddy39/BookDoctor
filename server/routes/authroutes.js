import express from "express";
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  getProfile
} from "../controllers/authController.js";
import { auth, validate } from "../middleware/index.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public auth routes
router.post("/register", authLimiter, validate(["name", "email", "password", "role"]), register);
router.post("/login",    authLimiter, validate(["email", "password"]), login);

// Verification and Reset
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", validate(["email"]), forgotPassword);
router.post("/reset-password/:token", validate(["password"]), resetPassword);

// Token refreshing & logout
router.post("/refresh", refresh);
router.post("/logout", logout);

// Protected profile
router.get("/profile", auth, getProfile);

export default router;