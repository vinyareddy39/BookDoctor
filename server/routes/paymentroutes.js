import express from "express";
import {
  createOrder,
  verifyPayment,
  razorpayWebhook,
  setupDoctorPayout,
  getDoctorPayoutStatus,
  simulateDoctorPayoutStatus,
  testPayAppointment,
} from "../controllers/paymentController.js";

import { auth } from "../middleware/index.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/create-order", paymentLimiter, auth, createOrder);
router.post("/verify", paymentLimiter, auth, verifyPayment);
router.post("/test-pay", auth, testPayAppointment);
router.post("/webhook", razorpayWebhook);

// Doctor Route Payout Setup
router.post("/doctor/payout-setup", auth, setupDoctorPayout);
router.get("/doctor/payout-status", auth, getDoctorPayoutStatus);
router.post("/doctor/simulate-status", auth, simulateDoctorPayoutStatus);

export default router;