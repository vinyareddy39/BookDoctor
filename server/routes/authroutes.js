import express from "express";
import { register, login, getProfile } from "../controllers/authController.js";
import { auth, validate } from "../middleware/index.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Rate-limited auth endpoints
router.post("/register", authLimiter, validate(["name", "email", "password", "role"]), register);
router.post("/login",    authLimiter, validate(["email", "password"]), login);

// Protected profile
router.get("/profile", auth, getProfile);

export default router;