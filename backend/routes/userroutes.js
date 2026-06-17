import express from "express";
import {
  getUsers,
  updateProfile,
} from "../controllers/userController.js";

import {
  auth,
  role,
} from "../middleware/index.js";

const router = express.Router();

// Admin only
router.get("/", auth, role("admin"), getUsers);

// User profile
router.put("/profile", auth, updateProfile);

export default router;