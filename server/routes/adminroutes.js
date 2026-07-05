import express from "express";
import {
  getDashboard,
  verifyDoctor,
  getAnalytics,
  clearReview,
  forceRefund,
} from "../controllers/adminController.js";

import {
  auth,
  role,
  validate
} from "../middleware/index.js";

const router = express.Router();

// Admin dashboard
router.get(
  "/dashboard",
  auth,
  role("admin"),
  getDashboard
);

// Admin analytics
router.get(
  "/analytics",
  auth,
  role("admin"),
  getAnalytics
);

// Verify doctor profile
router.put(
  "/doctors/:id/verify",
  auth,
  role("admin"),
  validate(["isVerified"]),
  verifyDoctor
);

// Clear inappropriate review
router.delete(
  "/appointments/:id/review",
  auth,
  role("admin"),
  clearReview
);

// Force refund (dispute resolution)
router.put(
  "/appointments/:id/refund",
  auth,
  role("admin"),
  forceRefund
);

export default router;