import express from "express";
import {
  getUsers,
  updateProfile,
  getMyProfile,
} from "../controllers/userController.js";

import {
  auth,
  role,
} from "../middleware/index.js";

const router = express.Router();

// Admin only
router.get("/", auth, role("admin"), getUsers);

// User profile
router.get("/profile", auth, getMyProfile);
router.put("/profile", auth, updateProfile);

export default router;