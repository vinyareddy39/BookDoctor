import express from "express";
import {
  createOrder,
  createAppointmentOnlineOrder,
  verifyPayment,
  razorpayWebhook,
  setupDoctorPayout,
  getDoctorPayoutStatus,
  simulateDoctorPayoutStatus,
  testPayAppointment,
  getDirectUpiDetails,
  claimDirectUpiPayment,
  confirmDirectUpiPayment,
  updateDoctorUpiProfile,
  sendUnpaidReminder,
} from "../controllers/paymentController.js";

import { auth, role } from "../middleware/index.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// ── Path A: Online Gateway via Razorpay ──
router.post("/appointments/:id/online-order", paymentLimiter, auth, createAppointmentOnlineOrder);
router.post("/create-order", paymentLimiter, auth, createOrder);
router.post("/verify", paymentLimiter, auth, verifyPayment);
router.post("/test-pay", auth, testPayAppointment);
router.post("/razorpay/webhook", razorpayWebhook);
router.post("/webhook", razorpayWebhook);

// ── Path B: Doctor's Direct UPI (QR / VPA) ──
router.get("/appointments/:id/direct-upi", auth, getDirectUpiDetails);
router.post("/appointments/:id/claim", paymentLimiter, auth, claimDirectUpiPayment);
router.post(
  "/appointments/:id/confirm",
  auth,
  role("doctor", "receptionist", "clinic_admin", "admin"),
  confirmDirectUpiPayment
);
router.put("/doctor/upi-profile", auth, role("doctor"), updateDoctorUpiProfile);

// ── Path C: Clinic Counter Payment Reminder ──
router.post(
  "/appointments/:id/remind-unpaid",
  auth,
  role("doctor", "receptionist", "clinic_admin", "admin"),
  sendUnpaidReminder
);

// Doctor Route Payout Setup
router.post("/doctor/payout-setup", auth, setupDoctorPayout);
router.get("/doctor/payout-status", auth, getDoctorPayoutStatus);
router.post("/doctor/simulate-status", auth, simulateDoctorPayoutStatus);

export default router;