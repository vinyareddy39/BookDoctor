import express from "express";
import {
  register,
  login,
  getProfile,
} from "../controllers/authController.js";
import { auth, validate } from "../middleware/index.js";

const router = express.Router();

// validate() ensures required fields exist before the controller runs
router.post("/register", validate(["name", "email", "password", "role"]), register);
router.post("/login",    validate(["email", "password"]), login);
router.get("/profile",   auth, getProfile);

export default router;