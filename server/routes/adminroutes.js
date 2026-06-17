import express from "express";
import {
  getDashboard,
} from "../controllers/adminController.js";

import {
  auth,
  role,
} from "../middleware/index.js";

const router = express.Router();

// Admin dashboard
router.get(
  "/dashboard",
  auth,
  role("admin"),
  getDashboard
);

export default router;